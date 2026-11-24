// Internal implementation: the approval executor can resume an approved workflow;
// the public Server Action never accepts a client-controlled approval bypass.
import { writeGuard } from "@/lib/action-authorization";
import { webIdentity, hasRole } from "./identity";
import { studentRoles, teacherRoles } from "./rules";
import { submitWorkflowHookApproval } from "@/lib/approval-workflow";
import { revalidatePath } from "next/cache";
export async function publishExam(
  examId: string,
  isPublished: boolean,
  note?: string,
  _approvalBypass: boolean = false,
) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  const i = await webIdentity();
  if (!i || hasRole(i, [...studentRoles, ...teacherRoles]))
    return { error: "ফল প্রকাশের প্রশাসনিক অনুমতি নেই।" };
  try {
    const { db, user, tenant: madrasaId } = i;
    if (typeof isPublished !== "boolean")
      return { error: "প্রকাশের অবস্থা বৈধ নয়।" };
    const { data: examRow } = await db
      .from("exams")
      .select("id,title,year,status")
      .eq("madrasa_id", madrasaId)
      .eq("id", examId)
      .maybeSingle();
    if (!examRow) return { error: "পরীক্ষাটি পাওয়া যায়নি।" };
    if (!_approvalBypass && isPublished) {
      const hook = await submitWorkflowHookApproval({
        madrasaId,
        actorId: user.id,
        actorName: user.user_metadata?.full_name || user.email || "অফিসার",
        actorRole: i.userRow.role,
        requestType: "RESULT_PUBLISH",
        amount: 0,
        title: `পরীক্ষার ফলাফল প্রকাশ অনুমোদন (${examId})`,
        description: note || "পরীক্ষার চূড়ান্ত ফলাফল প্রকাশ",
        entityType: "exam",
        targetId: examId,
        payload: { action: "publish_exam_result", examId, isPublished, note },
      });
      if (hook.matched) {
        return {
          success: true,
          pendingApproval: true,
          approvalRequestId: hook.approvalRequestId,
          message: "ফলাফল প্রকাশের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
        };
      }
    }

    const publisherName = i.userRow.full_name || user.email || "কর্তৃপক্ষ";
    const nextPublish = {
      is_published: isPublished,
      published_at: new Date().toISOString(),
      published_by: publisherName,
      note: note || "",
    };

    // One transaction changes publish_info, the legacy JSON mirror and exams.status.
    const { data: prevPublish, error } = await db.rpc(
      "set_portal_exam_publication",
      {
        p_tenant: madrasaId,
        p_exam: examId,
        p_info: nextPublish,
        p_actor: user.id,
      },
    );
    if (error) return { error: `ফল প্রকাশের অবস্থা বদলায়নি: ${error.message}` };
    await __authz.logAudit({
      action: isPublished ? "EXAM_RESULT_PUBLISHED" : "EXAM_RESULT_UNPUBLISHED",
      entityType: "exam",
      entityId: examId,
      entityLabel: examRow ? `${examRow.title} (${examRow.year})` : examId,
      summary: isPublished
        ? `পরীক্ষার ফলাফল আনুষ্ঠানিকভাবে প্রকাশ করা হয়েছে (${examRow?.title || examId})।`
        : `পরীক্ষার ফলাফল স্থগিত/অপ্রকাশিত করা হয়েছে (${examRow?.title || examId})।`,
      oldValue: prevPublish,
      newValue: nextPublish,
      severity: isPublished ? "WARNING" : "CRITICAL",
    });

    revalidatePath("/dashboard/exams");
    revalidatePath(`/dashboard/exams/${examId}/results`);
    revalidatePath(`/dashboard/exams/${examId}/merit-list`);
    revalidatePath(`/dashboard/exams/${examId}/report-cards`);
    revalidatePath("/portal/exams");
    revalidatePath("/portal");

    if (isPublished) {
      try {
        const { dispatchWebhookEvent } =
          await import("@/lib/webhooks/dispatcher");
        await dispatchWebhookEvent(madrasaId, "exam.result_published", {
          exam_id: examId,
          title: examRow?.title || examId,
          year: examRow?.year || null,
          published_by: publisherName,
          published_at: nextPublish.published_at,
        });
      } catch {
        // non-blocking webhook dispatch
      }
    }

    return {
      success: true,
      is_published: isPublished,
      message: isPublished
        ? "পরীক্ষার ফলাফল আনুষ্ঠানিকভাবে সফলভাবে প্রকাশিত হয়েছে! অভিভাবক ও শিক্ষার্থীরা এখন পোর্টালে রেজাল্ট ও মার্কশিট দেখতে পাবেন।"
        : "পরীক্ষার ফলাফল স্থগিত/অপ্রকাশিত করা হয়েছে। পোর্টাল থেকে ফলাফল লুকানো হয়েছে।",
    };
  } catch (err: any) {
    console.error("toggleExamPublish error:", err);
    return { error: err.message || "একটি ত্রুটি হয়েছে" };
  }
}
