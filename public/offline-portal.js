// A hard reload without a server session must never render a cached authenticated document.
// Show a read-only copy of the *already signed-in* user's selected snapshot, not a new login.
(async () => {
  const portal = /^\/teacher-portal(?:\/|$)/.test(location.pathname)
    ? "teacher"
    : /^\/portal(?:\/|$)/.test(location.pathname)
      ? "student"
      : null;
  if (!portal) return;
  // A cold document has no React network listener. Reauthenticate and resync on reconnect.
  window.addEventListener("online", () => location.reload(), { once: true });
  const authKey = "qawmi_offline_auth_session";
  const serialized = localStorage.getItem(authKey);
  if (!serialized) return;
  const session = JSON.parse(serialized);
  const roles =
    portal === "teacher"
      ? ["teacher", "hifz_teacher", "hifz_supervisor", "ustad"]
      : ["parent", "guardian", "student", "guardian_student"];
  if (
    !roles.includes(String(session.role).toLowerCase()) ||
    !session.userId ||
    !session.madrasaId
  )
    return;
  const owner = `${session.madrasaId}:${session.userId}:${portal}`;
  const child =
    portal === "student"
      ? new URLSearchParams(location.search).get("student_id") || ""
      : "";
  const id = `${portal}:${child}`;
  const request = indexedDB.open(`QawmiERP-scope-${owner}`);
  request.onupgradeneeded = () => request.transaction.abort(); // Nothing has been synced yet.
  request.onsuccess = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains("portalSnapshots")) {
      db.close();
      return;
    }
    const read = db
      .transaction("portalSnapshots")
      .objectStore("portalSnapshots")
      .get(id);
    read.onsuccess = () => {
      db.close();
      const row = read.result;
      if (
        localStorage.getItem(authKey) !== serialized ||
        !row ||
        row.owner !== owner ||
        row.id !== id ||
        (child && row.studentId !== child)
      )
        return;
      const d = row.data,
        target = document.querySelector("#snapshot");
      if (
        d.profile?.id !== session.userId ||
        d.profile?.madrasa_id !== session.madrasaId ||
        (portal === "student" && !d.activeStudent)
      )
        return;
      const add = (tag, text) => {
        const n = document.createElement(tag);
        n.textContent = text;
        target.appendChild(n);
      };
      add(
        "h2",
        portal === "teacher"
          ? d.profile.full_name
          : [d.activeStudent.first_name, d.activeStudent.last_name]
              .filter(Boolean)
              .join(" "),
      );
      add(
        "p",
        `সংরক্ষিত কপি • ${new Date(row.syncedAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}`,
      );
      const list = (name, items, format) => {
        add("h3", name);
        if (!items.length) add("p", "কোনো রেকর্ড নেই");
        for (const item of items) add("p", format(item));
      };
      const module = location.pathname.split("/")[2] || "";
      if (portal === "student" && (!module || module === "fees"))
        add("p", `মোট আদায়: ৳${d.totalPaid} • বকেয়া: ৳${d.totalDue}`);
      if (module === "fees") {
        list(
          "বিল",
          d.fees,
          (r) =>
            `${r.fee_type_name} • ${r.billing_period} • ছাড় ৳${r.discount_amount} • বকেয়া ৳${r.due_amount}`,
        );
        list("মওকুফ", d.discounts, (r) => `${r.reason} • ${r.status}`);
      }
      if (module === "fees")
        list(
          "রসিদ",
          d.feePayments,
          (r) =>
            `${r.payment_date} • ${r.receipt_no || "—"} • ৳${r.total_amount_received}`,
        );
      if (!module || module === "routine")
        list(
          "রুটিন",
          d.routines,
          (r) =>
            `${r.day_of_week} ${r.start_time}–${r.end_time} • ${r.display_title} • ${r.display_subtitle || ""} ${r.clean_room || ""}`,
        );
      if (portal === "student" && (!module || module === "exams"))
        list(
          "পরীক্ষা",
          d.examSummaries,
          (r) =>
            `${r.exam_title} • ${r.summary.statusLabel} • ${r.summary.gradeLabel} • মেধাস্থান: ${r.merit.formattedPosition}`,
        );
      if (portal === "teacher" && module === "exams")
        list(
          "নম্বর",
          d.examResults,
          (r) => {
            const exam = d.exams.find(e => e.id === r.exam_id);
            return `${exam?.title || "পরীক্ষা"}${exam?.is_locked === true ? " (লক করা)" : ""} • ${d.students.find(s => s.id === r.student_id)?.first_name || ""} • ${r.subject_name} • ${r.marks_obtained ?? "—"}/${r.total_marks}`;
          },
        );
      if (module === "students")
        list(
          "শিক্ষার্থী",
          d.students,
          (r) =>
            `${r.first_name} ${r.last_name} • ${r.class_name || ""} • ${r.roll_number || "—"}`,
        );
      const month = new URLSearchParams(location.search).get("month");
      if (module === "attendance")
        list(
          "হাজিরা",
          d.attendance.filter((r) => !month || r.date.startsWith(month)),
          (r) => `${r.date} • ${r.status}`,
        );
      if (!module || module === "notices")
        list("নোটিশ", d.notices, (r) => `${r.title} — ${r.content}`);
      if (module === "assignments")
        list(
          "পাঠ",
          d.homework,
          (r) => `${r.assigned_date} • ${r.title} — ${r.description || ""}`,
        );
      if (module === "holidays")
        list(
          "ছুটি",
          d.academicCalendar,
          (r) => `${r.start_date}–${r.end_date} • ${r.title}`,
        );
      if (module === "academic" || module === "hifz")
        list(
          "সবক",
          d.hifzLogs,
          (r) =>
            `${r.log_date} • ${r.sabak_para ?? "—"} • ${r.performance_rating || "—"}`,
        );
      if (module === "academic" || module === "kitab")
        list(
          "কিতাব",
          d.kitabLogs,
          (r) =>
            `${r.log_date} • ${r.kitab_name} • ${r.page_from || "—"}–${r.page_to || "—"}`,
        );
      target.hidden = false;
      window.addEventListener("storage", (e) => {
        if (!e.key || e.key === authKey) {
          target.replaceChildren();
          target.hidden = true;
        }
      });
    };
  };
})().catch(() => {});
