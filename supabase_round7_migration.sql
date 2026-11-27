-- Apply AFTER the updated finance-integrity migration, before enabling the new
-- application. No historical invoices, devices, punches or attendance are rewritten.
BEGIN;
DO $$ BEGIN
  IF public.finance_bill_period('2026-12-01') IS DISTINCT FROM '2026-12' OR
     position('QB001' in pg_get_functiondef('public.finance_edit_bills(uuid,jsonb,jsonb)'::regprocedure))=0 THEN
    RAISE EXCEPTION 'Install the Round 7 finance-integrity update first';
  END IF;
END $$;

-- The scheduler can only INSERT. Missing migration -> missing RPC -> failed
-- job with a retry cursor, never an unguarded write on an older finance schema.
CREATE OR REPLACE FUNCTION public.round7_create_scheduled_bill(t uuid, bill jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  PERFORM public.finance_edit_bills(t,jsonb_build_array(jsonb_build_object('id',bill->>'id','before',null,'after',bill)),null);
  RETURN true;
EXCEPTION WHEN SQLSTATE 'QB001' THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.round7_create_scheduled_bill(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.round7_create_scheduled_bill(uuid,jsonb) TO service_role;

-- Compare only the keys the operator actually read, under a fresh tenant lock.
-- Do not send a whole school document back in an UPDATE or in a URL filter.
CREATE OR REPLACE FUNCTION public.round7_patch_registry(t uuid, expected jsonb, patch jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
DECLARE m jsonb:=public.portal_locked_metadata(t); k text;
BEGIN
  PERFORM set_config('qawmi.registry_write', 'on', true);
  FOR k IN SELECT jsonb_object_keys(patch) LOOP
    IF k NOT IN ('biometric_devices','biometric_mappings','system_audit_logs_fallback') OR jsonb_typeof(patch->k)<>'array'
      THEN RAISE EXCEPTION 'Invalid registry patch'; END IF;
    IF (m->k) IS DISTINCT FROM (expected->k) THEN RETURN false; END IF;
  END LOOP;
  UPDATE public.madrasas SET registration_no=(m||patch)::text WHERE id=t;
  RETURN true;
END $$;

-- Other legacy modules still publish entire metadata documents. Refuse a
-- stale snapshot that would resurrect a deleted device, erase a mapping or
-- undo the audit. An independent edit with unchanged keys still works.
CREATE OR REPLACE FUNCTION public.round7_guard_registry() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE prev jsonb; proposed jsonb; k text;
BEGIN
  IF current_setting('qawmi.registry_write',true)='on' THEN RETURN NEW; END IF;
  prev:=public.finance_metadata(OLD); proposed:=public.finance_metadata(NEW);
  FOREACH k IN ARRAY ARRAY['biometric_devices','biometric_mappings','biometric_logs','system_audit_logs_fallback'] LOOP
    IF prev->k IS DISTINCT FROM proposed->k THEN RAISE EXCEPTION 'Registry changed; reload before saving'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS round7_guard_registry ON public.madrasas;
CREATE TRIGGER round7_guard_registry BEFORE UPDATE ON public.madrasas FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.round7_guard_registry();
REVOKE ALL ON FUNCTION public.round7_guard_registry() FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.biometric_punch_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id uuid NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  device_id text NOT NULL, device_name text NOT NULL,
  device_user_id text NOT NULL CHECK (device_user_id ~ '^[0-9]{1,32}$'),
  punch_time timestamptz NOT NULL, punch_date date NOT NULL,
  punch_type text NOT NULL, sync_mode text NOT NULL,
  status text NOT NULL CHECK(status IN ('unmapped','error','processed')),
  user_type text NOT NULL DEFAULT 'unknown', target_id text, target_name text,
  target_identifier text, class_name text, issue text,
  legacy_id text, parser_version int NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(madrasa_id,device_id,device_user_id,punch_time)
);
CREATE INDEX IF NOT EXISTS biometric_punch_events_day ON public.biometric_punch_events(madrasa_id,punch_date,punch_time DESC);
ALTER TABLE public.biometric_punch_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.biometric_punch_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.biometric_punch_events TO service_role;

-- day is Dhaka-local. Adopted legacy events already count in the read-only
-- historical book. An operator replay updates the same event, never adds a day.
CREATE OR REPLACE FUNCTION public.biometric_event_counts(t uuid, today date)
RETURNS TABLE(device text, total bigint, today_count bigint) LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT device_id,count(*),count(*) FILTER(WHERE punch_date=today) FROM public.biometric_punch_events
    WHERE madrasa_id=t AND legacy_id IS NULL GROUP BY device_id
$$;

-- Server provides STRICTLY parsed UTC instants. Resolve mapping at write time,
-- not from browser-supplied FK/display fields. Receipt of the punch, its status
-- and attendance are one transaction. No machine data can overwrite manual leave.
CREATE OR REPLACE FUNCTION public.biometric_apply_events(
  t uuid, dev text, src text, events jsonb, audience text, credential jsonb, replay jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE m jsonb:=public.portal_locked_metadata(t); d jsonb; r jsonb; mappings jsonb; link jsonb; old jsonb;
  e public.biometric_punch_events; at_time timestamptz; day date; pin text; person uuid; attendance_status text;
  mapped int:=0; unknown_count int:=0; duplicates int:=0; skipped int:=0; failed int:=0; added_days int:=0; n int;
  unknown_ids text[]:='{}'; failure_reason text; legacy_id text;
BEGIN
  PERFORM set_config('qawmi.registry_write', 'on', true);
  SELECT value INTO STRICT d FROM jsonb_array_elements(m->'biometric_devices') WHERE value->>'id'=dev;
  IF src NOT IN ('usb_import','cloud_push','manual_sync') OR audience NOT IN ('all','student','teacher') THEN RAISE EXCEPTION 'Invalid import mode'; END IF;
  IF src='cloud_push' AND replay IS NULL AND ((d->>'status') IS DISTINCT FROM 'active' OR
    (d->>'protocol') NOT IN ('cloud_push','webhook') OR (nullif(credential->>'token','') IS NULL AND
       (d->>'protocol' IS DISTINCT FROM 'cloud_push' OR nullif(credential->>'sn','') IS NULL)) OR
    (credential ? 'token' AND d->>'secret_token' IS DISTINCT FROM credential->>'token') OR
    (credential ? 'sn' AND d->>'serial_number' IS DISTINCT FROM credential->>'sn')) THEN RAISE EXCEPTION 'Device credentials changed'; END IF;
  IF jsonb_typeof(events) IS DISTINCT FROM 'array' OR jsonb_array_length(events)>10000 OR
    (replay IS NOT NULL AND jsonb_array_length(events)<>1) THEN RAISE EXCEPTION 'Invalid event batch'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(events) LOOP
    pin:=r->>'pin'; legacy_id:=NULL; failure_reason:=NULL; person:=NULL; attendance_status:=NULL; old:=NULL;
    IF pin IS NULL OR pin !~ '^[0-9]{1,32}$' OR coalesce(r->>'instant','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$' THEN RAISE EXCEPTION 'Invalid event'; END IF;
    at_time:=(r->>'instant')::timestamptz; day:=(at_time AT TIME ZONE 'Asia/Dhaka')::date;
    SELECT jsonb_agg(value) INTO mappings FROM jsonb_array_elements(m->'biometric_mappings')
      WHERE pin IN (value->>'device_user_id',value->>'rfid_card_no');
    link:=CASE WHEN jsonb_array_length(mappings)=1 THEN mappings->0 ELSE NULL END;
    SELECT * INTO e FROM public.biometric_punch_events b WHERE (b.madrasa_id,b.device_id,b.device_user_id,b.punch_time)=(t,dev,pin,at_time) FOR UPDATE;
    IF e.id IS NOT NULL AND (replay IS NULL OR e.status='processed') THEN duplicates:=duplicates+1; CONTINUE; END IF;
    IF replay IS NOT NULL THEN
      IF e.id IS NULL THEN
        SELECT value INTO STRICT old FROM jsonb_array_elements(m->'biometric_logs') WHERE value->>'id'=replay->>'id' AND value->>'device_id'=dev AND value->>'device_user_id'=pin;
        IF old->>'status'='processed' THEN duplicates:=duplicates+1; CONTINUE; END IF;
        legacy_id:=old->>'id';
      ELSIF e.id IS DISTINCT FROM replay->>'id' THEN RAISE EXCEPTION 'Event changed'; END IF;
      IF link IS NULL OR (link->>'id',link->>'target_id') IS DISTINCT FROM (replay->>'mapping',replay->>'target') OR
        coalesce(e.target_id,old->>'target_id',link->>'target_id') IS DISTINCT FROM link->>'target_id'
        THEN RAISE EXCEPTION 'Review the mapping again'; END IF;
    END IF;
    IF link IS NOT NULL AND ((audience<>'all' AND link->>'user_type' IS DISTINCT FROM audience) OR
       (d->>'target_audience'='students' AND link->>'user_type'<>'student') OR
       (d->>'target_audience'='teachers' AND link->>'user_type'<>'teacher')) THEN skipped:=skipped+1; CONTINUE; END IF;
    IF e.id IS NULL THEN
      INSERT INTO public.biometric_punch_events(id,madrasa_id,device_id,device_name,device_user_id,punch_time,punch_date,punch_type,sync_mode,status,legacy_id)
        VALUES(coalesce(legacy_id,gen_random_uuid()::text),t,dev,coalesce(d->>'name',dev),pin,at_time,day,coalesce(r->>'kind','auto'),src,'unmapped',legacy_id)
        ON CONFLICT(madrasa_id,device_id,device_user_id,punch_time) DO NOTHING RETURNING * INTO e;
      IF e.id IS NULL THEN duplicates:=duplicates+1; CONTINUE; END IF;
    END IF;
    IF link IS NULL THEN
      unknown_count:=unknown_count+1; IF NOT pin=ANY(unknown_ids) THEN unknown_ids:=array_append(unknown_ids,pin); END IF; CONTINUE;
    END IF;
    IF link->>'user_type'='student' THEN
      SELECT id INTO person FROM public.students WHERE madrasa_id=t AND id::text=link->>'target_id';
      IF person IS NOT NULL THEN
        INSERT INTO public.attendance(madrasa_id,student_id,date,status) VALUES(t,person,day,'Present') ON CONFLICT(student_id,date) DO NOTHING;
        GET DIAGNOSTICS n=ROW_COUNT; added_days:=added_days+n;
        SELECT a.status INTO attendance_status FROM public.attendance a WHERE a.madrasa_id=t AND a.student_id=person AND a.date=day AND to_jsonb(a)->>'leave_request_id' IS NULL;
      END IF;
    ELSIF link->>'user_type'='teacher' THEN
      SELECT id INTO person FROM public.teachers WHERE madrasa_id=t AND id::text=link->>'target_id';
      IF person IS NOT NULL THEN
        INSERT INTO public.teacher_attendance(madrasa_id,teacher_id,date,status) VALUES(t,person,day,'Present') ON CONFLICT(teacher_id,date) DO NOTHING;
        GET DIAGNOSTICS n=ROW_COUNT; added_days:=added_days+n;
        SELECT a.status INTO attendance_status FROM public.teacher_attendance a WHERE a.madrasa_id=t AND a.teacher_id=person AND a.date=day AND to_jsonb(a)->>'leave_request_id' IS NULL;
      END IF;
    END IF;
    IF person IS NULL THEN failure_reason:='প্রতিষ্ঠানের ম্যাপিং যাচাই করুন';
    ELSIF lower(attendance_status) IS DISTINCT FROM 'present' THEN failure_reason:='বিদ্যমান হাজিরা বদলানো হয়নি; পর্যালোচনা করুন'; END IF;
    UPDATE public.biometric_punch_events b SET status=CASE WHEN failure_reason IS NULL THEN 'processed' ELSE 'error' END,
      user_type=coalesce(link->>'user_type','unknown'),target_id=person::text,target_name=link->>'target_name',target_identifier=link->>'target_identifier',
      class_name=link->>'class_name',issue=failure_reason WHERE b.id=e.id AND b.madrasa_id=t;
    IF failure_reason IS NULL THEN mapped:=mapped+1; ELSE failed:=failed+1; END IF;
  END LOOP;
  IF src='cloud_push' AND replay IS NULL THEN
    UPDATE public.madrasas SET registration_no=jsonb_set(m,'{biometric_devices}',
      (SELECT jsonb_agg(CASE WHEN value->>'id'=dev THEN value||jsonb_build_object('last_ping_at',now(),'last_sync_at',now()) ELSE value END ORDER BY ordinality)
       FROM jsonb_array_elements(m->'biometric_devices') WITH ORDINALITY))::text WHERE id=t;
  END IF;
  RETURN jsonb_build_object('totalProcessed',mapped,'attendanceDaysCreated',added_days,'unmappedCount',unknown_count,'duplicates',duplicates,'skipped',skipped,'failed',failed,'unknownIds',to_jsonb(unknown_ids));
END $$;
REVOKE ALL ON FUNCTION public.round7_patch_registry(uuid,jsonb,jsonb),public.biometric_event_counts(uuid,date),public.biometric_apply_events(uuid,text,text,jsonb,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.round7_patch_registry(uuid,jsonb,jsonb),public.biometric_event_counts(uuid,date),public.biometric_apply_events(uuid,text,text,jsonb,text,jsonb,jsonb) TO service_role;
-- Class-subject selector updates one existing link, or inserts one under the
-- class lock. A missing FK never costs the teacher their previous assignment.
CREATE OR REPLACE FUNCTION public.round7_set_subject_teacher(t uuid, c uuid, s uuid, replacement uuid)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ids uuid[];
BEGIN
  PERFORM 1 FROM public.classes WHERE id=c AND (madrasa_id=t OR madrasa_id IS NULL) FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT FROM public.class_subjects x WHERE x.class_id=c AND x.subject_id=s
    AND (to_jsonb(x)->>'madrasa_id' IS NULL OR to_jsonb(x)->>'madrasa_id'=t::text)) THEN RAISE EXCEPTION 'জামাতের বিষয় বরাদ্দ পাওয়া যায়নি।'; END IF;
  IF replacement IS NOT NULL AND NOT EXISTS(SELECT FROM public.teachers WHERE id=replacement AND madrasa_id=t) THEN RAISE EXCEPTION 'শিক্ষক এই প্রতিষ্ঠানের নন।'; END IF;
  SELECT array_agg(a.id) INTO ids FROM public.teacher_subjects a JOIN public.teachers p ON p.id=a.teacher_id
    WHERE p.madrasa_id=t AND (a.madrasa_id=t OR a.madrasa_id IS NULL) AND a.class_id=c AND a.subject_id=s;
  IF cardinality(ids)>1 THEN RAISE EXCEPTION 'একাধিক শিক্ষক বরাদ্দ আছে। তালিকায় যাচাই করুন।'; END IF;
  IF replacement IS NULL THEN DELETE FROM public.teacher_subjects WHERE id=ids[1] AND (madrasa_id=t OR madrasa_id IS NULL);
  ELSIF ids IS NULL THEN INSERT INTO public.teacher_subjects(madrasa_id,class_id,subject_id,teacher_id) VALUES(t,c,s,replacement);
  ELSE UPDATE public.teacher_subjects SET teacher_id=replacement WHERE id=ids[1] AND (madrasa_id=t OR madrasa_id IS NULL); END IF;
END $$;
REVOKE ALL ON FUNCTION public.round7_set_subject_teacher(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.round7_set_subject_teacher(uuid,uuid,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
