-- Run after the base ERP schema. Safe to rerun. Clinical data is not a raw REST API:
-- staff roles and linked-family projections are checked by the authenticated application.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS students_health_tenant_key ON public.students(madrasa_id,id);
CREATE TABLE IF NOT EXISTS public.student_health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id uuid NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  class_id uuid,
  illness_type text NOT NULL CHECK (length(trim(illness_type)) BETWEEN 1 AND 160),
  symptoms text NOT NULL DEFAULT '',
  severity text NOT NULL CHECK (severity IN ('mild','moderate','severe','critical')),
  status text NOT NULL CHECK (status IN ('observing','under_treatment','hospitalized','home_rest','recovered')),
  treatment_notes text NOT NULL DEFAULT '', doctor_or_hospital text, boarding_diet_note text,
  guardian_notified_at timestamptz, guardian_acknowledged_at timestamptz,
  reported_by uuid NOT NULL, reported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), recovered_at timestamptz,
  UNIQUE (madrasa_id,id),
  FOREIGN KEY (madrasa_id,student_id) REFERENCES public.students(madrasa_id,id) ON DELETE CASCADE,
  CHECK ((status='recovered') = (recovered_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS health_records_child_idx ON public.student_health_records(student_id,madrasa_id);
CREATE INDEX IF NOT EXISTS health_records_tenant_status_idx ON public.student_health_records(madrasa_id,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.student_health_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_id uuid NOT NULL, madrasa_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('observing','under_treatment','hospitalized','home_rest','recovered')),
  severity text NOT NULL CHECK (severity IN ('mild','moderate','severe','critical')),
  note text NOT NULL, temperature text, treatment_notes text NOT NULL DEFAULT '',
  logged_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (madrasa_id,record_id) REFERENCES public.student_health_records(madrasa_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS health_timeline_record_idx ON public.student_health_timeline(record_id,madrasa_id,created_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['student_health_records','student_health_timeline'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS health_tenant_scope ON public.%I',t);
    EXECUTE format('CREATE POLICY health_tenant_scope ON public.%I AS RESTRICTIVE TO authenticated USING (madrasa_id = public.get_auth_madrasa_id()) WITH CHECK (madrasa_id = public.get_auth_madrasa_id())',t);
    -- No permissive policy. Even same-tenant families cannot enumerate other children;
    -- direct writes cannot skip the atomic timeline, actor binding or audit.
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
  END LOOP;
  IF to_regclass('public.madrasa_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS health_private_settings ON public.madrasa_settings;
    CREATE POLICY health_private_settings ON public.madrasa_settings AS RESTRICTIVE TO authenticated
      USING (namespace <> 'student_health_v1') WITH CHECK (namespace <> 'student_health_v1');
  END IF;
END $$;

-- Service-role only, invoker rights. One statement for both the clinical state and its
-- immutable visit. A stale edit must never append a visit or overwrite a newer plan.
CREATE OR REPLACE FUNCTION public.write_student_health_visit(p_record jsonb,p_visit jsonb,p_expected timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.student_health_records; v public.student_health_timeline;
BEGIN
  -- Some PostgREST-compatible drivers serialize a JSON parameter as a string
  -- scalar. Accept one encoding layer, never arbitrary/malformed scalar data.
  IF jsonb_typeof(p_record)='string' THEN p_record := (p_record #>> '{}')::jsonb; END IF;
  IF jsonb_typeof(p_visit)='string' THEN p_visit := (p_visit #>> '{}')::jsonb; END IF;
  IF jsonb_typeof(p_record) IS DISTINCT FROM 'object' OR jsonb_typeof(p_visit) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'expected health record and visit objects' USING ERRCODE='22023';
  END IF;
  r := jsonb_populate_record(NULL::public.student_health_records,p_record);
  v := jsonb_populate_record(NULL::public.student_health_timeline,p_visit);
  IF (r.madrasa_id,r.id,r.status,r.severity) IS DISTINCT FROM (v.madrasa_id,v.record_id,v.status,v.severity) THEN
    RAISE EXCEPTION 'health visit scope mismatch';
  END IF;
  IF p_expected IS NULL THEN
    INSERT INTO public.student_health_records SELECT r.*;
  ELSE
    UPDATE public.student_health_records SET status=r.status, severity=r.severity, treatment_notes=r.treatment_notes,
      boarding_diet_note=r.boarding_diet_note, recovered_at=r.recovered_at, updated_at=r.updated_at,
      guardian_notified_at=NULL, guardian_acknowledged_at=NULL
      WHERE madrasa_id=r.madrasa_id AND id=r.id AND student_id=r.student_id AND updated_at=p_expected AND status<>'recovered';
    IF NOT FOUND THEN RAISE EXCEPTION 'stale health visit' USING ERRCODE='40001'; END IF;
  END IF;
  INSERT INTO public.student_health_timeline SELECT v.*;
END $$;
REVOKE ALL ON FUNCTION public.write_student_health_visit(jsonb,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_student_health_visit(jsonb,jsonb,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
