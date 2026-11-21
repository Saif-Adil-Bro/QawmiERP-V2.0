import { assertExamUnlocked } from "@/lib/lock-guards";
import { mobileError, type MobileWriteCheck } from "@/lib/mobile-api";

async function check(tenant: string, examId: unknown) {
  if (typeof examId !== "string" || !examId)
    return mobileError("পরীক্ষা নির্বাচন করুন।", 400, "INVALID_EXAM");
  const lock = await assertExamUnlocked(tenant, examId);
  return lock.locked
    ? mobileError(lock.error, lock.code === "EXAM_LOCKED" ? 409 : 503, lock.code)
    : undefined;
}

export const guardMobileExam: MobileWriteCheck = async ({ tenant, id, payload }) => {
  // Lock changes belong to the privileged, audited lock action, not generic staff CRUD.
  if (["is_locked", "locked_by", "locked_by_name", "locked_at", "lock_reason"].some((k) => k in payload))
    return mobileError(
      "লক পরিবর্তনের জন্য পরীক্ষা ফ্রিজ প্যানেল ব্যবহার করুন।",
      403,
      "LOCK_ACTION_REQUIRED",
    );
  if (id) return check(tenant, id);
};

export const guardMobileResult: MobileWriteCheck = async ({ db, tenant, id, payload }) => {
  if (!id) return check(tenant, payload.exam_id);
  const { data, error } = await db
    .from("exam_results")
    .select("exam_id")
    .eq("madrasa_id", tenant)
    .eq("id", id)
    .maybeSingle();
  if (error) return mobileError("পরীক্ষার রেকর্ড যাচাই করা যায়নি।", 503, "EXAM_LOCK_UNAVAILABLE");
  if (!data) return mobileError("রেকর্ড পাওয়া যায়নি।", 404, "NOT_FOUND");
  const blocked = await check(tenant, data.exam_id);
  if (blocked) return blocked;
  if ("exam_id" in payload && payload.exam_id !== data.exam_id) return check(tenant, payload.exam_id);
};
