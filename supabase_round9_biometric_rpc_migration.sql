-- Round 9 / FOLLOWUP10: Fix biometric_apply_events RPC replay & attendance upgrade semantics,
-- plus align biometric_event_counts with Asia/Dhaka date boundaries.
-- Idempotent: safe to run on any Supabase project that has supabase_round7_migration.sql applied.
BEGIN;

CREATE OR REPLACE FUNCTION public.biometric_event_counts(t uuid, today date)
RETURNS TABLE(device text, total bigint, today_count bigint) LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT device_id,
         count(*),
         count(*) FILTER (WHERE (punch_time AT TIME ZONE 'Asia/Dhaka')::date = today)
    FROM public.biometric_punch_events
   WHERE madrasa_id = t
   GROUP BY device_id
$$;

-- Server provides STRICTLY parsed UTC instants. Resolve mapping at write time,
-- not from browser-supplied FK/display fields. Receipt of the punch, its status
-- and attendance are one transaction.
-- Attendance rules:
--   * No row exists -> INSERT 'Present' (added_days += 1, status = 'processed')
--   * Pending / unmarked / absent / empty placeholder (without leave_request_id)
--     -> UPGRADE to 'Present' and ensure madrasa_id = t (added_days += 1, status = 'processed')
--   * Existing 'present' or 'late' (without leave_request_id)
--     -> Keep existing saved attendance (added_days += 0, status = 'processed')
--   * Approved leave (leave_request_id IS NOT NULL or status = 'leave')
--     -> NEVER overwrite (status = 'error', failed += 1)
CREATE OR REPLACE FUNCTION public.biometric_apply_events(
  t uuid, dev text, src text, events jsonb, audience text, credential jsonb, replay jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path='' SET qawmi.registry_write='on' AS $$
DECLARE
  m jsonb := public.portal_locked_metadata(t);
  d jsonb;
  r jsonb;
  mappings jsonb;
  link jsonb;
  old jsonb;
  e public.biometric_punch_events;
  at_time timestamptz;
  day date;
  pin text;
  person uuid;
  attendance_status text;
  existing_att_id uuid;
  existing_att_status text;
  existing_att_leave text;
  norm_status text;
  resolved_device_name text;
  mapped int := 0;
  unknown_count int := 0;
  duplicates int := 0;
  skipped int := 0;
  failed int := 0;
  added_days int := 0;
  n int;
  unknown_ids text[] := '{}';
  failure_reason text;
  legacy_id text;
BEGIN
  IF replay IS NULL THEN
    SELECT value INTO STRICT d
      FROM jsonb_array_elements(coalesce(m->'biometric_devices', '[]'::jsonb))
     WHERE value->>'id' = dev;
  ELSE
    SELECT value INTO d
      FROM jsonb_array_elements(coalesce(m->'biometric_devices', '[]'::jsonb))
     WHERE value->>'id' = dev;
    IF d IS NULL THEN
      d := jsonb_build_object('id', dev, 'name', dev, 'target_audience', 'all');
    END IF;
  END IF;

  IF src NOT IN ('usb_import','cloud_push','manual_sync') OR audience NOT IN ('all','student','teacher') THEN
    RAISE EXCEPTION 'Invalid import mode';
  END IF;

  IF src = 'cloud_push' AND replay IS NULL AND (
    (d->>'status') IS DISTINCT FROM 'active' OR
    (d->>'protocol') NOT IN ('cloud_push','webhook') OR
    (nullif(credential->>'token','') IS NULL AND
      (d->>'protocol' IS DISTINCT FROM 'cloud_push' OR nullif(credential->>'sn','') IS NULL)) OR
    (credential ? 'token' AND d->>'secret_token' IS DISTINCT FROM credential->>'token') OR
    (credential ? 'sn' AND d->>'serial_number' IS DISTINCT FROM credential->>'sn')
  ) THEN
    RAISE EXCEPTION 'Device credentials changed';
  END IF;

  IF jsonb_typeof(events) IS DISTINCT FROM 'array' OR jsonb_array_length(events) > 10000 OR
    (replay IS NOT NULL AND jsonb_array_length(events) <> 1) THEN
    RAISE EXCEPTION 'Invalid event batch';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(events) LOOP
    pin := r->>'pin';
    legacy_id := NULL;
    failure_reason := NULL;
    person := NULL;
    attendance_status := NULL;
    existing_att_id := NULL;
    existing_att_status := NULL;
    existing_att_leave := NULL;
    norm_status := NULL;
    old := NULL;

    IF pin IS NULL OR pin !~ '^[0-9]{1,32}$' OR coalesce(r->>'instant','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$' THEN
      RAISE EXCEPTION 'Invalid event';
    END IF;

    at_time := (r->>'instant')::timestamptz;
    day := (at_time AT TIME ZONE 'Asia/Dhaka')::date;

    SELECT jsonb_agg(value) INTO mappings
      FROM jsonb_array_elements(coalesce(m->'biometric_mappings', '[]'::jsonb))
     WHERE pin IN (value->>'device_user_id', value->>'rfid_card_no');
    link := CASE WHEN jsonb_array_length(mappings) = 1 THEN mappings->0 ELSE NULL END;

    IF replay IS NOT NULL THEN
      SELECT * INTO e
        FROM public.biometric_punch_events b
       WHERE b.madrasa_id = t
         AND (
           b.id = replay->>'id'
           OR b.legacy_id = replay->>'id'
           OR (b.device_id = dev AND b.device_user_id = pin AND b.punch_time = at_time)
         )
       LIMIT 1
       FOR UPDATE;
    ELSE
      SELECT * INTO e
        FROM public.biometric_punch_events b
       WHERE (b.madrasa_id, b.device_id, b.device_user_id, b.punch_time) = (t, dev, pin, at_time)
       FOR UPDATE;
    END IF;

    IF e.id IS NOT NULL AND (replay IS NULL OR e.status = 'processed') THEN
      duplicates := duplicates + 1;
      CONTINUE;
    END IF;

    IF replay IS NOT NULL THEN
      IF e.id IS NULL THEN
        SELECT value INTO STRICT old
          FROM jsonb_array_elements(coalesce(m->'biometric_logs', '[]'::jsonb))
         WHERE value->>'id' = replay->>'id'
           AND value->>'device_id' = dev
           AND value->>'device_user_id' = pin;
        IF old->>'status' = 'processed' THEN
          duplicates := duplicates + 1;
          CONTINUE;
        END IF;
        legacy_id := old->>'id';
      ELSIF e.id IS DISTINCT FROM replay->>'id' AND e.legacy_id IS DISTINCT FROM replay->>'id' THEN
        RAISE EXCEPTION 'Event changed';
      END IF;

      IF link IS NULL OR
        (link->>'id', link->>'target_id') IS DISTINCT FROM (replay->>'mapping', replay->>'target') OR
        coalesce(nullif(e.target_id, ''), nullif(old->>'target_id', ''), link->>'target_id') IS DISTINCT FROM link->>'target_id' THEN
        RAISE EXCEPTION 'Review the mapping again';
      END IF;
    END IF;

    IF link IS NOT NULL AND (
      (audience <> 'all' AND link->>'user_type' IS DISTINCT FROM audience) OR
      (d->>'target_audience' = 'students' AND link->>'user_type' <> 'student') OR
      (d->>'target_audience' = 'teachers' AND link->>'user_type' <> 'teacher')
    ) THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    resolved_device_name := coalesce(nullif(d->>'name', ''), nullif(e.device_name, ''), nullif(old->>'device_name', ''), dev);

    IF e.id IS NULL THEN
      INSERT INTO public.biometric_punch_events(
        id, madrasa_id, device_id, device_name, device_user_id,
        punch_time, punch_date, punch_type, sync_mode, status, legacy_id
      )
      VALUES (
        coalesce(legacy_id, gen_random_uuid()::text),
        t, dev, resolved_device_name, pin,
        at_time, day, coalesce(r->>'kind','auto'), src, 'unmapped', legacy_id
      )
      ON CONFLICT(madrasa_id, device_id, device_user_id, punch_time) DO NOTHING
      RETURNING * INTO e;
      IF e.id IS NULL THEN
        duplicates := duplicates + 1;
        CONTINUE;
      END IF;
    END IF;

    IF link IS NULL THEN
      unknown_count := unknown_count + 1;
      IF NOT pin = ANY(unknown_ids) THEN
        unknown_ids := array_append(unknown_ids, pin);
      END IF;
      CONTINUE;
    END IF;

    IF link->>'user_type' = 'student' THEN
      SELECT id INTO person FROM public.students WHERE madrasa_id = t AND id::text = link->>'target_id';
      IF person IS NOT NULL THEN
        SELECT a.id, a.status, nullif(to_jsonb(a)->>'leave_request_id', '')
          INTO existing_att_id, existing_att_status, existing_att_leave
          FROM public.attendance a
         WHERE a.student_id = person
           AND a.date = day
           AND (a.madrasa_id = t OR a.madrasa_id IS NULL)
         LIMIT 1
         FOR UPDATE;

        IF existing_att_id IS NULL THEN
          INSERT INTO public.attendance(madrasa_id, student_id, date, status)
            VALUES (t, person, day, 'Present')
            ON CONFLICT(student_id, date) DO NOTHING;
          GET DIAGNOSTICS n = ROW_COUNT;
          IF n > 0 THEN
            added_days := added_days + n;
            attendance_status := 'present';
          ELSE
            SELECT a.id, a.status, nullif(to_jsonb(a)->>'leave_request_id', '')
              INTO existing_att_id, existing_att_status, existing_att_leave
              FROM public.attendance a
             WHERE a.student_id = person
               AND a.date = day
               AND (a.madrasa_id = t OR a.madrasa_id IS NULL)
             LIMIT 1
             FOR UPDATE;
          END IF;
        END IF;

        IF existing_att_id IS NOT NULL THEN
          norm_status := lower(trim(coalesce(existing_att_status, '')));
          IF existing_att_leave IS NOT NULL OR norm_status = 'leave' THEN
            failure_reason := 'অনুমোদিত ছুটি বদলানো হয়নি; পর্যালোচনা করুন';
          ELSIF norm_status IN ('present', 'late') THEN
            UPDATE public.attendance SET madrasa_id = t WHERE id = existing_att_id AND madrasa_id IS NULL;
            attendance_status := norm_status;
          ELSIF norm_status IN ('', 'pending', 'unmarked', 'absent') THEN
            UPDATE public.attendance SET status = 'Present', madrasa_id = t WHERE id = existing_att_id;
            added_days := added_days + 1;
            attendance_status := 'present';
          ELSE
            failure_reason := 'বিদ্যমান হাজিরা বদলানো হয়নি; পর্যালোচনা করুন';
          END IF;
        END IF;
      END IF;
    ELSIF link->>'user_type' = 'teacher' THEN
      SELECT id INTO person FROM public.teachers WHERE madrasa_id = t AND id::text = link->>'target_id';
      IF person IS NOT NULL THEN
        SELECT a.id, a.status, nullif(to_jsonb(a)->>'leave_request_id', '')
          INTO existing_att_id, existing_att_status, existing_att_leave
          FROM public.teacher_attendance a
         WHERE a.teacher_id = person
           AND a.date = day
           AND (a.madrasa_id = t OR a.madrasa_id IS NULL)
         LIMIT 1
         FOR UPDATE;

        IF existing_att_id IS NULL THEN
          INSERT INTO public.teacher_attendance(madrasa_id, teacher_id, date, status)
            VALUES (t, person, day, 'Present')
            ON CONFLICT(teacher_id, date) DO NOTHING;
          GET DIAGNOSTICS n = ROW_COUNT;
          IF n > 0 THEN
            added_days := added_days + n;
            attendance_status := 'present';
          ELSE
            SELECT a.id, a.status, nullif(to_jsonb(a)->>'leave_request_id', '')
              INTO existing_att_id, existing_att_status, existing_att_leave
              FROM public.teacher_attendance a
             WHERE a.teacher_id = person
               AND a.date = day
               AND (a.madrasa_id = t OR a.madrasa_id IS NULL)
             LIMIT 1
             FOR UPDATE;
          END IF;
        END IF;

        IF existing_att_id IS NOT NULL THEN
          norm_status := lower(trim(coalesce(existing_att_status, '')));
          IF existing_att_leave IS NOT NULL OR norm_status = 'leave' THEN
            failure_reason := 'অনুমোদিত ছুটি বদলানো হয়নি; পর্যালোচনা করুন';
          ELSIF norm_status IN ('present', 'late') THEN
            UPDATE public.teacher_attendance SET madrasa_id = t WHERE id = existing_att_id AND madrasa_id IS NULL;
            attendance_status := norm_status;
          ELSIF norm_status IN ('', 'pending', 'unmarked', 'absent') THEN
            UPDATE public.teacher_attendance SET status = 'Present', madrasa_id = t WHERE id = existing_att_id;
            added_days := added_days + 1;
            attendance_status := 'present';
          ELSE
            failure_reason := 'বিদ্যমান হাজিরা বদলানো হয়নি; পর্যালোচনা করুন';
          END IF;
        END IF;
      END IF;
    END IF;

    IF person IS NULL THEN
      failure_reason := 'প্রতিষ্ঠানের ম্যাপিং যাচাই করুন';
    ELSIF failure_reason IS NULL AND coalesce(attendance_status, '') NOT IN ('present', 'late') THEN
      failure_reason := 'বিদ্যমান হাজিরা বদলানো হয়নি; পর্যালোচনা করুন';
    END IF;

    UPDATE public.biometric_punch_events b
       SET status = CASE WHEN failure_reason IS NULL THEN 'processed' ELSE 'error' END,
           user_type = coalesce(link->>'user_type', 'unknown'),
           target_id = person::text,
           target_name = link->>'target_name',
           target_identifier = link->>'target_identifier',
           class_name = link->>'class_name',
           issue = failure_reason
     WHERE b.id = e.id AND b.madrasa_id = t;

    IF failure_reason IS NULL THEN
      mapped := mapped + 1;
    ELSE
      failed := failed + 1;
    END IF;
  END LOOP;

  IF src = 'cloud_push' AND replay IS NULL THEN
    UPDATE public.madrasas
       SET registration_no = jsonb_set(
         m,
         '{biometric_devices}',
         (SELECT jsonb_agg(
            CASE
              WHEN value->>'id' = dev THEN value || jsonb_build_object('last_ping_at', now(), 'last_sync_at', now())
              ELSE value
            END
            ORDER BY ordinality
          )
          FROM jsonb_array_elements(coalesce(m->'biometric_devices', '[]'::jsonb)) WITH ORDINALITY)
       )::text
     WHERE id = t;
  END IF;

  RETURN jsonb_build_object(
    'totalProcessed', mapped,
    'attendanceDaysCreated', added_days,
    'unmappedCount', unknown_count,
    'duplicates', duplicates,
    'skipped', skipped,
    'failed', failed,
    'unknownIds', to_jsonb(unknown_ids)
  );
END $$;

REVOKE ALL ON FUNCTION public.biometric_event_counts(uuid,date), public.biometric_apply_events(uuid,text,text,jsonb,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.biometric_event_counts(uuid,date), public.biometric_apply_events(uuid,text,text,jsonb,text,jsonb,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
