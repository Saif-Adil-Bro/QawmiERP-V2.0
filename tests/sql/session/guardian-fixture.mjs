// Create *provider* accounts and posted receipts, not app sessions or browser storage.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

export function securityProfile(guardian, status) {
  return {
    user_security_profiles: {
      [guardian.uid]: {
        status,
        linkedStudentIds: guardian.children.slice(0, 2).map((c) => c.id),
      },
    },
  };
}
export async function seedGuardians({ db, lite, anon }) {
  const guardians = [];
  const amounts = [45.25, 72.5, 19.75, 30, 91.75];
  let n = 0;
  for (const label of ["A", "B"]) {
    const email = `guardian-${label.toLowerCase()}@example.test`,
      password = randomBytes(32).toString("hex");
    const { data, error } = await lite
      .getClient({ apikey: anon })
      .auth.signUp({ email, password });
    assert.ok(!error && data.session, "disposable provider sign-up");
    const tenant = randomUUID(),
      uid = data.user.id,
      name = `Fixture Guardian ${label}`;
    const children = Array.from({ length: label === "A" ? 3 : 2 }, (_, i) => {
      const amount = amounts[n++];
      return {
        id: randomUUID(),
        tenant,
        name: `Pupil-${label}${i + 1}`,
        receipt: `FIXTURE-${n}`,
        amount,
      };
    });
    const g = {
      email,
      password,
      tenant,
      uid,
      name,
      children,
      providerSession: data.session,
    };
    await db`INSERT INTO public.madrasas(id,name,contact_email,metadata,security_metadata)
      VALUES (${tenant},${`Fixture school ${label}`},${email},'{}',${db.json(securityProfile(g, "ACTIVE"))})`;
    await db`INSERT INTO public.users(id,madrasa_id,role,full_name,email) VALUES (${uid},${tenant},'parent',${name},${email})`;
    for (const [i, c] of children.entries()) {
      await db`INSERT INTO public.students(id,madrasa_id,first_name,last_name,roll_number) VALUES (${c.id},${tenant},${c.name},'Fixture',${String(i + 1)})`;
      await db`INSERT INTO public.fee_payments(madrasa_id,session_id,student_id,student_name,receipt_no,total_amount_received)
        VALUES (${tenant},'fixture-term',${c.id},${c.name},${c.receipt},${c.amount})`;
    }
    guardians.push(g);
  }
  return guardians;
}
