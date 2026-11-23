-- Additive upgrade of the existing daily ledger. Run after supabase_schema.sql
-- and the tenant identity migration (PostgreSQL 15+). Safe to rerun.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS hifz_students_tenant_key ON public.students(madrasa_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS hifz_teachers_tenant_key ON public.teachers(madrasa_id,id);
CREATE TABLE IF NOT EXISTS public.hifz_student_profiles (
  student_id uuid PRIMARY KEY,
  madrasa_id uuid NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  hifz_category text NOT NULL DEFAULT 'sabqi' CHECK(hifz_category IN ('sabqi','khatmi')),
  previously_memorized_paras integer[] NOT NULL DEFAULT '{}',
  current_khatam_paras_done integer[] NOT NULL DEFAULT '{}',
  total_khatams_completed integer NOT NULL DEFAULT 0 CHECK(total_khatams_completed>=0),
  khatam_completion_dates date[] NOT NULL DEFAULT '{}',
  default_sabina_partner_id uuid,
  -- Distinguish an automatic cycle projection from an explicitly saved profile
  -- when an installation also has pre-migration structured settings.
  profile_configured boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(madrasa_id,student_id) REFERENCES public.students(madrasa_id,id) ON DELETE CASCADE,
  FOREIGN KEY(madrasa_id,default_sabina_partner_id) REFERENCES public.students(madrasa_id,id) ON DELETE SET NULL (default_sabina_partner_id),
  CHECK(default_sabina_partner_id<>student_id),
  CHECK(previously_memorized_paras <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30])
);
CREATE INDEX IF NOT EXISTS hifz_profiles_tenant_category ON public.hifz_student_profiles(madrasa_id,hifz_category);
ALTER TABLE public.hifz_logs
  ADD COLUMN IF NOT EXISTS student_category text NOT NULL DEFAULT 'sabqi' CHECK(student_category IN ('sabqi','khatmi')),
  ADD COLUMN IF NOT EXISTS sabak_mistakes integer NOT NULL DEFAULT 0 CHECK(sabak_mistakes>=0),
  ADD COLUMN IF NOT EXISTS sat_sabak_mistakes integer NOT NULL DEFAULT 0 CHECK(sat_sabak_mistakes>=0),
  ADD COLUMN IF NOT EXISTS amukhta_mistakes integer NOT NULL DEFAULT 0 CHECK(amukhta_mistakes>=0),
  ADD COLUMN IF NOT EXISTS morning_session_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS morning_para_from integer CHECK(morning_para_from BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS morning_para_to integer CHECK(morning_para_to BETWEEN morning_para_from AND 30),
  ADD COLUMN IF NOT EXISTS morning_pages integer NOT NULL DEFAULT 0 CHECK(morning_pages>=0),
  ADD COLUMN IF NOT EXISTS morning_mistakes integer NOT NULL DEFAULT 0 CHECK(morning_mistakes>=0),
  ADD COLUMN IF NOT EXISTS afternoon_session_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS afternoon_para_from integer CHECK(afternoon_para_from BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS afternoon_para_to integer CHECK(afternoon_para_to BETWEEN afternoon_para_from AND 30),
  ADD COLUMN IF NOT EXISTS afternoon_pages integer NOT NULL DEFAULT 0 CHECK(afternoon_pages>=0),
  ADD COLUMN IF NOT EXISTS afternoon_mistakes integer NOT NULL DEFAULT 0 CHECK(afternoon_mistakes>=0);
CREATE TABLE IF NOT EXISTS public.hifz_weekly_sabina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), madrasa_id uuid NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  sabina_date date NOT NULL CHECK(extract(isodow FROM sabina_date)=4), student_id uuid NOT NULL,
  listener_student_id uuid, listener_name text, verified_by_teacher_id uuid,
  assigned_para_from integer NOT NULL CHECK(assigned_para_from BETWEEN 1 AND 30),
  assigned_para_to integer NOT NULL CHECK(assigned_para_to BETWEEN assigned_para_from AND 30),
  para_breakdown jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(para_breakdown)='array'),
  total_paras_recited integer NOT NULL DEFAULT 0 CHECK(total_paras_recited BETWEEN 0 AND 30),
  total_mistakes integer NOT NULL DEFAULT 0 CHECK(total_mistakes>=0),
  status text NOT NULL DEFAULT 'completed' CHECK(status IN ('assigned','completed')),
  remarks text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(student_id,sabina_date),
  FOREIGN KEY(madrasa_id,student_id) REFERENCES public.students(madrasa_id,id) ON DELETE CASCADE,
  FOREIGN KEY(madrasa_id,listener_student_id) REFERENCES public.students(madrasa_id,id) ON DELETE SET NULL (listener_student_id),
  FOREIGN KEY(madrasa_id,verified_by_teacher_id) REFERENCES public.teachers(madrasa_id,id) ON DELETE SET NULL (verified_by_teacher_id),
  CHECK(listener_student_id<>student_id)
);
CREATE INDEX IF NOT EXISTS hifz_weekly_tenant_date ON public.hifz_weekly_sabina(madrasa_id,sabina_date);
CREATE TABLE IF NOT EXISTS public.hifz_special_sabina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), madrasa_id uuid NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
  duration_days integer NOT NULL DEFAULT 3 CHECK(duration_days IN (1,3,7)),
  start_date date NOT NULL, end_date date NOT NULL CHECK(end_date=start_date+duration_days-1),
  status text NOT NULL DEFAULT 'ongoing' CHECK(status IN ('ongoing','completed')),
  listening_mode text NOT NULL CHECK(listening_mode IN ('one_to_one','group_to_group','one_to_many')),
  participants jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(participants)='object'),
  session_logs jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(session_logs)='array'),
  revision uuid NOT NULL DEFAULT gen_random_uuid(), created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hifz_special_tenant_status ON public.hifz_special_sabina(madrasa_id,status,start_date);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['hifz_student_profiles','hifz_weekly_sabina','hifz_special_sabina'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS hifz_tenant_scope ON public.%I',t);
    EXECUTE format('CREATE POLICY hifz_tenant_scope ON public.%I AS RESTRICTIVE TO authenticated USING (madrasa_id = public.get_auth_madrasa_id()) WITH CHECK (madrasa_id = public.get_auth_madrasa_id())',t);
    -- No raw REST path around teacher rosters, family projections or audit.
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
  END LOOP;
  IF to_regclass('public.madrasa_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS hifz_private_settings ON public.madrasa_settings;
    CREATE POLICY hifz_private_settings ON public.madrasa_settings AS RESTRICTIVE TO authenticated
      USING(namespace NOT IN ('hifz_profile_v1','hifz_weekly_v1','hifz_special_v1'))
      WITH CHECK(namespace NOT IN ('hifz_profile_v1','hifz_weekly_v1','hifz_special_v1'));
  END IF;
END $$;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.hifz_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.hifz_logs TO service_role;

CREATE OR REPLACE FUNCTION public.hifz_recount(t uuid, s uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE seen integer[] := '{}'; dates date[] := '{}'; r record;
BEGIN
  -- Serialize sessions for this student before reading the ledger. Ignore a
  -- cascading student deletion; never recreate its profile in the DELETE trigger.
  PERFORM pg_advisory_xact_lock(hashtextextended('hifz:' || t::text || ':' || s::text, 0));
  PERFORM 1 FROM public.students WHERE madrasa_id=t AND id=s;
  IF NOT FOUND THEN RETURN; END IF;
  FOR r IN SELECT l.log_date,p FROM public.hifz_logs l CROSS JOIN LATERAL
    (VALUES(1,l.morning_session_done,l.morning_para_from,l.morning_para_to),
           (2,l.afternoon_session_done,l.afternoon_para_from,l.afternoon_para_to)) AS v(slot,done,lo,hi)
    CROSS JOIN LATERAL generate_series(v.lo,v.hi) p
    WHERE l.madrasa_id=t AND l.student_id=s AND l.student_category='khatmi' AND done
    ORDER BY l.log_date,slot,p LOOP
    IF NOT r.p=ANY(seen) THEN seen:=array_append(seen,r.p); END IF;
    IF cardinality(seen)=30 THEN dates:=array_append(dates,r.log_date); seen:='{}'; END IF;
  END LOOP;
  INSERT INTO public.hifz_student_profiles(student_id,madrasa_id,current_khatam_paras_done,total_khatams_completed,khatam_completion_dates)
    VALUES(s,t,ARRAY(SELECT unnest(seen) ORDER BY 1),cardinality(dates),dates)
    ON CONFLICT(student_id) DO UPDATE SET current_khatam_paras_done=excluded.current_khatam_paras_done,
      total_khatams_completed=excluded.total_khatams_completed,khatam_completion_dates=excluded.khatam_completion_dates,updated_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.hifz_daily_changed() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP<>'INSERT' AND OLD.student_category='khatmi' THEN PERFORM public.hifz_recount(OLD.madrasa_id,OLD.student_id); END IF;
  IF TG_OP<>'DELETE' AND NEW.student_category='khatmi' AND (TG_OP='INSERT' OR OLD.student_category<>'khatmi' OR (OLD.madrasa_id,OLD.student_id) IS DISTINCT FROM (NEW.madrasa_id,NEW.student_id)) THEN PERFORM public.hifz_recount(NEW.madrasa_id,NEW.student_id); END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.hifz_recount(uuid,uuid),public.hifz_daily_changed() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hifz_recount(uuid,uuid),public.hifz_daily_changed() TO service_role;
DROP TRIGGER IF EXISTS hifz_daily_projection ON public.hifz_logs;
-- A stale PostgREST schema cache can still force a notes-only write immediately
-- after the migration commits. Project exactly the daily whitelist before recount.
CREATE OR REPLACE FUNCTION public.hifz_project_note_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m jsonb; fields jsonb;
BEGIN
  IF NEW.notes IS NULL OR strpos(NEW.notes,'"hifz_version":1')=0 THEN RETURN NEW; END IF;
  m:=substring(NEW.notes FROM '\[HIFZ_META:(\{.*\})\]\s*$')::jsonb;
  IF m->>'hifz_version'='1' THEN
    SELECT jsonb_object_agg(key,value) INTO fields FROM jsonb_each(m) WHERE key IN (
      'student_category','sabak_mistakes','sat_sabak_mistakes','amukhta_mistakes',
      'morning_session_done','morning_para_from','morning_para_to','morning_pages','morning_mistakes',
      'afternoon_session_done','afternoon_para_from','afternoon_para_to','afternoon_pages','afternoon_mistakes');
    NEW:=jsonb_populate_record(NEW,fields);
  END IF;
  RETURN NEW;
EXCEPTION WHEN data_exception THEN RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hifz_project_note_fields() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hifz_project_note_fields() TO service_role;
DROP TRIGGER IF EXISTS hifz_note_projection ON public.hifz_logs;
CREATE TRIGGER hifz_note_projection BEFORE INSERT OR UPDATE OF notes ON public.hifz_logs FOR EACH ROW EXECUTE FUNCTION public.hifz_project_note_fields();
-- Promote only versioned fallback notes, never rewrite notes, IDs or legacy rows.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.hifz_logs WHERE notes LIKE '%"hifz_version":1%' LOOP
    BEGIN
      UPDATE public.hifz_logs SET notes=notes WHERE id=r.id;
    EXCEPTION WHEN data_exception OR integrity_constraint_violation THEN NULL; -- malformed historical note
    END;
  END LOOP;
  FOR r IN SELECT DISTINCT madrasa_id,student_id FROM public.hifz_logs WHERE student_category='khatmi' LOOP PERFORM public.hifz_recount(r.madrasa_id,r.student_id); END LOOP;
END $$;
CREATE TRIGGER hifz_daily_projection AFTER INSERT OR UPDATE OR DELETE ON public.hifz_logs FOR EACH ROW EXECUTE FUNCTION public.hifz_daily_changed();
-- Aggregate in PostgreSQL: the dashboard never needs to download years of daily
-- lesson text, nor one log record per day in order to calculate today's rate.
CREATE OR REPLACE FUNCTION public.hifz_log_activity(p_tenant uuid,p_date date)
RETURNS TABLE(student_id uuid,entered_today boolean) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT l.student_id,bool_or(l.log_date=p_date) FROM public.hifz_logs l
  WHERE l.madrasa_id=p_tenant GROUP BY l.student_id
$$;
REVOKE ALL ON FUNCTION public.hifz_log_activity(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hifz_log_activity(uuid,date) TO service_role;
-- Qawmi 610-page Mushaf progress: Completed Para revision tracking & Khatmi partial-Para page persistence
ALTER TABLE public.hifz_student_profiles
  ADD COLUMN IF NOT EXISTS para_revisions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_khatam_para_pages JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Custom Week Selector metadata for Weekly Sabina Khata reports
ALTER TABLE public.hifz_weekly_sabina
  ADD COLUMN IF NOT EXISTS week_number INTEGER CHECK (week_number BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS month_key TEXT,
  ADD COLUMN IF NOT EXISTS hijri_month_label TEXT;
NOTIFY pgrst,'reload schema';
COMMIT;
