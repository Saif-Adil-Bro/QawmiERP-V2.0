-- Read-only operator readback, AFTER installing the updated integrity + Round 7
-- functions. In this SAME SQL session, set qawmi.review_tenant to the verified
-- institution UUID. No default tenant. No device credentials or raw punches.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $$
DECLARE t uuid:=nullif(current_setting('qawmi.review_tenant',true),'')::uuid; k text;
BEGIN
  IF t IS NULL OR NOT EXISTS(SELECT FROM public.madrasas WHERE id=t) THEN
    RAISE EXCEPTION 'Set qawmi.review_tenant to the verified institution UUID in this session';
  END IF;
  FOREACH k IN ARRAY ARRAY['madrasas','student_fees','automation_rules','job_execution_logs','madrasa_settings','biometric_punch_events'] LOOP
    IF row_security_active(format('public.%I',k)::regclass) THEN
      RAISE EXCEPTION 'RLS may hide records from this reviewer: %. Stop; do not interpret a zero count.', k;
    END IF;
  END LOOP;
END $$;

-- Count physical rows, logical invoice keys, amounts and a deterministic
-- full-row fingerprint. A legacy mirror or unexpected key is a review item,
-- never a reason to delete a row or to sum a duplicated book as new income.
WITH school AS (SELECT * FROM public.madrasas WHERE id=current_setting('qawmi.review_tenant')::uuid),
book AS (
  SELECT 'sql' AS src,to_jsonb(b) AS bill FROM public.student_fees b JOIN school m ON m.id=b.madrasa_id
  UNION ALL
  SELECT 'legacy',b FROM school m,jsonb_array_elements(public.finance_metadata(m)->'student_fees') b
), december AS (SELECT * FROM book WHERE public.finance_bill_period(bill->>'billing_period')='2026-12')
SELECT current_setting('qawmi.review_tenant') AS reviewed_tenant,
       count(*) AS physical_rows, count(*) FILTER(WHERE src='sql') AS sql_rows,
       count(*) FILTER(WHERE src='legacy') AS legacy_rows,
       count(DISTINCT (bill->>'student_id',bill->>'fee_type_id')) AS december_keys,
       sum((bill->>'payable_amount')::numeric) AS payable, sum((bill->>'paid_amount')::numeric) AS paid,
       sum((bill->>'due_amount')::numeric) AS due,
       md5(string_agg(src||':'||bill::text,E'\n' ORDER BY src,bill->>'id',bill::text)) AS rows_fingerprint
FROM december;

SELECT rule_key,is_enabled,cron_expression,config->>'timezone' AS zone,
       last_run_at AT TIME ZONE 'Asia/Dhaka' AS last_attempt_bdt,
       next_run_at AT TIME ZONE 'Asia/Dhaka' AS persisted_next_bdt
FROM public.automation_rules WHERE madrasa_id=current_setting('qawmi.review_tenant')::uuid ORDER BY rule_key;
SELECT setting_key,setting_value->>'lastTriggerSource' AS source,setting_value->>'lastTickAt' AS last_tick,
       setting_value->>'lastSuccessAt' AS last_success,setting_value->>'lastError' AS last_error
FROM public.madrasa_settings WHERE madrasa_id=current_setting('qawmi.review_tenant')::uuid
  AND namespace='automation' AND setting_key='scheduler_heartbeat';
SELECT id,job_key,trigger_source,status,started_at,finished_at,summary->>'billingPeriod' AS period,
       summary->>'generatedCount' AS generated,summary->>'skippedExisting' AS skipped,failed_count,error_message
FROM public.job_execution_logs WHERE madrasa_id=current_setting('qawmi.review_tenant')::uuid
ORDER BY started_at DESC LIMIT 20;

-- Candidate identity ONLY. Verify all four fields in the authorized UI before
-- removing the test registry entry. The operator must not delete punch history.
SELECT m.id AS tenant,d->>'id' AS device_id,d->>'name' AS candidate_name,d->>'serial_number' AS candidate_serial
FROM public.madrasas m,jsonb_array_elements(public.finance_metadata(m)->'biometric_devices') d
WHERE m.id=current_setting('qawmi.review_tenant')::uuid
  AND d->>'name'='TEST-BIOMETRIC-DELETE-ME' AND d->>'serial_number'='TESTSERIAL0001';
SELECT device_id,punch_date,status,count(*) AS durable_events
FROM public.biometric_punch_events WHERE madrasa_id=current_setting('qawmi.review_tenant')::uuid
  AND punch_date BETWEEN DATE '2026-11-22' AND DATE '2026-11-25'
GROUP BY device_id,punch_date,status ORDER BY device_id,punch_date,status;
SELECT jsonb_array_length(coalesce(public.finance_metadata(m)->'biometric_logs','[]'::jsonb)) AS original_legacy_log_rows,
       jsonb_array_length(coalesce(public.finance_metadata(m)->'biometric_devices','[]'::jsonb)) AS registered_devices
FROM public.madrasas m WHERE id=current_setting('qawmi.review_tenant')::uuid;
ROLLBACK;
