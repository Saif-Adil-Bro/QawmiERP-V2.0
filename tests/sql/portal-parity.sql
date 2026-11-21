-- CI/disposable database only: create fixture identities, exercise authenticated RLS, roll back.
-- Run as schema owner AFTER the base, account-model and portal-parity migrations.
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.students,public.madrasas,public.users,public.classes,public.exam_results TO authenticated;
INSERT INTO public.madrasas(id,name,contact_email) VALUES ('a0000000-0000-4000-8000-000000000001','A','a@example.test'),('b0000000-0000-4000-8000-000000000001','B','b@example.test');
INSERT INTO auth.users(id) VALUES ('a0000000-0000-4000-8000-000000000011'),('a0000000-0000-4000-8000-000000000012'),('a0000000-0000-4000-8000-000000000013');
INSERT INTO public.users(id,madrasa_id,full_name,email,role) SELECT id,'a0000000-0000-4000-8000-000000000001','Fixture',id::text||'@example.test', CASE right(id::text,2) WHEN '11' THEN 'teacher' WHEN '12' THEN 'parent' ELSE 'admin' END FROM auth.users WHERE id::text LIKE 'a0000000-0000-4000-8000-00000000001_';
-- Fixtures simulate PostgREST's verified claims. No real tokens or provider involved here.
INSERT INTO public.user_sessions(user_id,madrasa_id,provider_session_id,expires_at)
 SELECT id,madrasa_id,('f'||substr(id::text,2))::uuid,now()+interval '1 day' FROM public.users;
INSERT INTO public.classes(id,madrasa_id,name) VALUES ('a0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000001','New class');
INSERT INTO public.students(id,madrasa_id,first_name,last_name) VALUES ('a0000000-0000-4000-8000-000000000031','a0000000-0000-4000-8000-000000000001','A','Student'),('b0000000-0000-4000-8000-000000000031','b0000000-0000-4000-8000-000000000001','B','Student');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000011',true);
SELECT set_config('request.jwt.claims','{"session_id":"f0000000-0000-4000-8000-000000000011"}',true);
DO $$ BEGIN
 IF public.portal_may_use_raw_erp_tables() OR EXISTS(SELECT 1 FROM public.students) OR EXISTS(SELECT 1 FROM public.madrasas) OR (SELECT count(*) FROM public.users)<>1 THEN RAISE EXCEPTION 'teacher raw access'; END IF;
 IF has_function_privilege(current_user,'public.apply_portal_promotion(uuid,jsonb,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'client promotion privilege'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000012',true);
SELECT set_config('request.jwt.claims','{"session_id":"f0000000-0000-4000-8000-000000000012"}',true);
DO $$ BEGIN IF public.portal_may_use_raw_erp_tables() OR EXISTS(SELECT 1 FROM public.classes) THEN RAISE EXCEPTION 'parent raw access'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000013',true);
SELECT set_config('request.jwt.claims','{"session_id":"f0000000-0000-4000-8000-000000000013"}',true);
DO $$ BEGIN IF NOT public.portal_may_use_raw_erp_tables() OR (SELECT count(*) FROM public.students)<>1 OR EXISTS(SELECT 1 FROM public.students WHERE first_name='B') THEN RAISE EXCEPTION 'admin tenant scope'; END IF; END $$;
DO $$ BEGIN
 IF public.current_app_session()->>'user_id' IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'missing own session'; END IF;
 IF has_any_column_privilege('authenticated','public.user_sessions','SELECT,INSERT,UPDATE') OR
    has_any_column_privilege('anon','public.user_sessions','SELECT,INSERT,UPDATE') OR
    has_function_privilege('anon','public.current_app_session()','EXECUTE') THEN RAISE EXCEPTION 'exposed session registry'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE tenant uuid:='a0000000-0000-4000-8000-000000000001'; change jsonb:='{"id":"a0000000-0000-4000-8000-000000000031","class_id":"a0000000-0000-4000-8000-000000000021","roll_number":"1"}'; BEGIN
 BEGIN
  PERFORM public.apply_portal_promotion(tenant,'{}','{"success":true}',jsonb_build_array(change, change || '{"id":"b0000000-0000-4000-8000-000000000031"}'::jsonb));
  RAISE EXCEPTION 'expected refusal';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Roster changed; refresh and retry' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.students WHERE class_id IS NOT NULL AND madrasa_id=tenant) THEN RAISE EXCEPTION 'partial promotion'; END IF;
 PERFORM public.apply_portal_promotion(tenant,'{}','{"enrollments":[]}',jsonb_build_array(change));
 IF NOT EXISTS(SELECT 1 FROM public.students WHERE madrasa_id=tenant AND class_name='New class' AND roll_number='1') THEN RAISE EXCEPTION 'promotion not applied'; END IF;
END $$;
-- A raw admin role does not override a disabled account or an additional portal role.
UPDATE public.madrasas SET security_metadata='{"user_security_profiles":{"a0000000-0000-4000-8000-000000000013":{"roles":["admin","ustad"]}}}' WHERE id='a0000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.students) THEN RAISE EXCEPTION 'mixed role'; END IF; END $$;
RESET ROLE;
UPDATE public.madrasas SET security_metadata='{"user_security_profiles":{"a0000000-0000-4000-8000-000000000013":{"status":"DISABLED"}}}' WHERE id='a0000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ DECLARE f text; BEGIN
 IF public.portal_may_use_raw_erp_tables() THEN RAISE EXCEPTION 'disabled account'; END IF;
 FOREACH f IN ARRAY ARRAY['public.set_portal_exam_publication(uuid,uuid,jsonb,uuid)','public.write_portal_fee_intent(uuid,jsonb,boolean)','public.settle_portal_fee_intent(uuid,jsonb,text,text)','public.confirm_portal_donation_return(uuid,jsonb,text)','public.replace_portal_gateway_key(uuid,text,jsonb,jsonb)','public.get_executive_bi_snapshot(uuid,int,text)'] LOOP
  IF has_function_privilege(current_user,f,'EXECUTE') OR NOT has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'RPC grant: %',f; END IF;
 END LOOP;
 IF has_any_column_privilege('authenticated','public.portal_fee_checkouts','SELECT,INSERT,UPDATE') OR has_any_column_privilege('anon','public.portal_fee_checkouts','SELECT,INSERT,UPDATE')
   OR NOT has_column_privilege('service_role','public.portal_fee_checkouts','validation_id','UPDATE') OR has_column_privilege('service_role','public.portal_fee_checkouts','merchant_scope','UPDATE') THEN RAISE EXCEPTION 'checkout access'; END IF;
 IF has_table_privilege(current_user,'public.mv_bi_class_fee_dues','SELECT') THEN RAISE EXCEPTION 'raw BI'; END IF;
END $$;
RESET ROLE;
-- Expiry, revocation, old/unregistered sessions and a changed tenant must not grant continuity.
DO $$ DECLARE uid uuid:=auth.uid(); BEGIN
 UPDATE public.user_sessions SET expires_at=now() WHERE user_id=uid;
 IF public.current_app_session() IS NOT NULL THEN RAISE EXCEPTION 'expired session'; END IF;
 UPDATE public.user_sessions SET expires_at=now()+interval '1 day', is_active=false WHERE user_id=uid;
 IF public.current_app_session() IS NOT NULL THEN RAISE EXCEPTION 'inactive session'; END IF;
 UPDATE public.user_sessions SET is_active=true,revoked_at=now() WHERE user_id=uid;
 IF public.current_app_session() IS NOT NULL THEN RAISE EXCEPTION 'revoked session'; END IF;
 UPDATE public.user_sessions SET revoked_at=null,madrasa_id='b0000000-0000-4000-8000-000000000001' WHERE user_id=uid;
 IF public.current_app_session() IS NOT NULL THEN RAISE EXCEPTION 'tenant transfer'; END IF;
 UPDATE public.user_sessions SET madrasa_id='a0000000-0000-4000-8000-000000000001',provider_session_id=null WHERE user_id=uid;
 IF public.current_app_session() IS NOT NULL THEN RAISE EXCEPTION 'legacy unbound session'; END IF;
END $$;
-- Publication: an invalid audit actor rolls back both mirrors. Unpublishing writes an explicit false.
DO $$ DECLARE tenant uuid:='a0000000-0000-4000-8000-000000000001'; ex uuid; prior jsonb; BEGIN
 INSERT INTO public.exams(madrasa_id,title,year) VALUES(tenant,'Fixture','2026') RETURNING id INTO ex;
 PERFORM public.set_portal_exam_publication(tenant,ex,'{"is_published":true}',null);
 BEGIN
  PERFORM public.set_portal_exam_publication(tenant,ex,'{"is_published":false}','a0000000-0000-4000-8000-000000000099');
  RAISE EXCEPTION 'expected invalid actor';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.exams WHERE id=ex AND status='Published') THEN RAISE EXCEPTION 'partial publication'; END IF;
 prior:=public.set_portal_exam_publication(tenant,ex,'{"is_published":false}',null);
 IF prior->>'is_published'<>'true' OR NOT EXISTS(SELECT 1 FROM public.exam_settings WHERE exam_id=ex AND setting_value->>'is_published'='false') OR NOT EXISTS(SELECT 1 FROM public.madrasas WHERE id=tenant AND registration_no::jsonb->'published_exams'->(ex::text)->>'is_published'='false') OR NOT EXISTS(SELECT 1 FROM public.exams WHERE id=ex AND status='Completed') THEN RAISE EXCEPTION 'publication mismatch'; END IF;
END $$;
-- Verified online fee: competing payment changes balance, retry after rollback, duplicate IPN.
DO $$ DECLARE tenant uuid:='a0000000-0000-4000-8000-000000000001'; pupil uuid:='a0000000-0000-4000-8000-000000000031'; intent jsonb; receipt jsonb; second jsonb; BEGIN
 INSERT INTO public.fee_types(id,madrasa_id,name,code) VALUES('typ',tenant,'Fee','F');
 INSERT INTO public.student_fees(id,madrasa_id,session_id,student_id,fee_type_id,fee_type_name,billing_period,payable_amount,due_amount) VALUES ('bill',tenant,'term',pupil,'typ','Fee','2026-01',80,80);
 intent:=jsonb_build_object('madrasa_id',tenant,'student_id',pupil,'student_name','Pupil','status','PENDING','transaction_id','txn-1','amount',60,'total_payable',61,'payment_channel','bKash','allocations',jsonb_build_array(jsonb_build_object('student_fee_id','bill','allocated_amount',60)));
 PERFORM public.write_portal_fee_intent(tenant,intent);
 UPDATE public.student_fees SET due_amount=40 WHERE id='bill';
 BEGIN
  PERFORM public.settle_portal_fee_intent(tenant,intent,'verified','bank');
  RAISE EXCEPTION 'expected balance conflict';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Bill balance changed; reconciliation required' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.fees WHERE student_id=pupil) OR EXISTS(SELECT 1 FROM public.fee_payments WHERE student_id=pupil) THEN RAISE EXCEPTION 'partial receipt'; END IF;
 UPDATE public.student_fees SET due_amount=80 WHERE id='bill';
 receipt:=public.settle_portal_fee_intent(tenant,intent,'verified','bank');
 second:=public.settle_portal_fee_intent(tenant,intent,'verified','bank');
 IF second->>'already_paid' <> 'true' OR receipt->>'receipt_no' IS DISTINCT FROM second->>'receipt_no' OR NOT EXISTS(SELECT 1 FROM public.student_fees WHERE id='bill' AND due_amount=20 AND paid_amount=60) OR (SELECT count(*) FROM public.fee_payment_allocations WHERE student_fee_id='bill')<>1 OR (SELECT count(*) FROM public.fee_payments WHERE student_id=pupil AND session_id='term')<>1 OR (SELECT count(*) FROM public.fees WHERE student_id=pupil)<>1 THEN RAISE EXCEPTION 'receipt replay'; END IF;
END $$;
-- A settings/donation save changes only its key. A stale same-key save fails closed.
DO $$ DECLARE tenant uuid:='a0000000-0000-4000-8000-000000000001'; initial jsonb:=public.portal_locked_metadata(tenant); BEGIN
 PERFORM public.replace_portal_gateway_key(tenant,'online_donations',null,'[]');
 PERFORM public.replace_portal_gateway_key(tenant,'payment_gateway_config',null,'{"is_enabled":false}');
 BEGIN
  PERFORM public.replace_portal_gateway_key(tenant,'payment_gateway_config',null,'{"is_enabled":true}');
  RAISE EXCEPTION 'expected refusal';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Gateway records changed; refresh and retry' THEN RAISE; END IF; END;
 IF public.portal_locked_metadata(tenant) IS DISTINCT FROM (initial||'{"online_donations":[],"payment_gateway_config":{"is_enabled":false}}'::jsonb) THEN RAISE EXCEPTION 'unrelated metadata changed'; END IF;
END $$;
ROLLBACK;
