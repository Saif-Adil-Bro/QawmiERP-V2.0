import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { BiometricDevice, BiometricUserMapping, BiometricPunchLog } from "@/lib/biometric";

/**
 * Biometric Live Cloud Push Webhook Endpoint
 * 
 * Usage:
 * POST /api/biometric/push
 * Headers:
 *   Authorization: Bearer <DEVICE_SECRET_TOKEN> (or body { token: "..." })
 * Body:
 * {
 *   "token": "zk_XXXX-XXXX-XXXX-XXXX", // Optional if sent in Authorization header
 *   "device_sn": "CK40-2026-9812", // Optional
 *   "punches": [
 *     {
 *       "user_id": "101",
 *       "timestamp": "2026-09-23T08:30:00Z", // or "2026-09-23 08:30:00"
 *       "punch_type": "check_in" // or "check_out"
 *     }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    let token = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : "";

    const body = await req.json().catch(() => ({}));
    if (!token && body.token) {
      token = String(body.token).trim();
    }

    if (!token) {
      return NextResponse.json(
        { error: "Authentication failed. Device token is required." },
        { status: 401 }
      );
    }

    const punches = Array.isArray(body.punches) ? body.punches : body.user_id ? [body] : [];
    if (punches.length === 0) {
      return NextResponse.json(
        { error: "No punch records provided." },
        { status: 400 }
      );
    }

    // Lookup madrasa and device by secret_token
    const adminClient = await createAdminClient();
    const { data: madrasas, error: mError } = await adminClient
      .from("madrasas")
      .select("id, name, registration_no");

    if (mError || !madrasas) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    let matchedMadrasaId: string | null = null;
    let matchedDevice: BiometricDevice | null = null;
    let matchedMeta: any = null;

    for (const m of madrasas) {
      if (!m.registration_no || !m.registration_no.startsWith("{")) continue;
      try {
        const meta = JSON.parse(m.registration_no);
        const devices: BiometricDevice[] = meta.biometric_devices || [];
        const found = devices.find((d) => d.secret_token === token || (body.device_sn && d.serial_number === body.device_sn));
        if (found) {
          matchedMadrasaId = m.id;
          matchedDevice = found;
          matchedMeta = meta;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!matchedMadrasaId || !matchedDevice || !matchedMeta) {
      return NextResponse.json(
        { error: "Invalid device token or unconfigured device." },
        { status: 403 }
      );
    }

    const mappings: BiometricUserMapping[] = matchedMeta.biometric_mappings || [];
    const mappingMap = new Map<string, BiometricUserMapping>();
    mappings.forEach((m) => {
      if (m.device_user_id) mappingMap.set(m.device_user_id.trim(), m);
      if (m.rfid_card_no) mappingMap.set(m.rfid_card_no.trim(), m);
    });

    // Fallback lookups
    const { data: allStudents } = await adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, student_id, class_id, classes(name)")
      .eq("madrasa_id", matchedMadrasaId);

    const studentRollMap = new Map<string, any>();
    const studentIdCodeMap = new Map<string, any>();
    (allStudents || []).forEach((s) => {
      if (s.roll_number) studentRollMap.set(String(s.roll_number).trim(), s);
      if (s.student_id) studentIdCodeMap.set(String(s.student_id).trim(), s);
    });

    const { data: allTeachers } = await adminClient
      .from("users")
      .select("id, full_name, phone")
      .eq("madrasa_id", matchedMadrasaId);
    const teacherMap = new Map<string, any>();
    (allTeachers || []).forEach((t) => {
      teacherMap.set(t.id, t);
      if (t.phone) teacherMap.set(t.phone.trim(), t);
    });

    const studentAttendanceToUpsert: any[] = [];
    const teacherAttendanceToUpsert: any[] = [];
    const newLogs: BiometricPunchLog[] = [];
    let processedCount = 0;
    const now = new Date().toISOString();

    for (const p of punches) {
      const userId = String(p.user_id || p.userId || "").trim();
      if (!userId) continue;

      const dateObj = p.timestamp ? new Date(p.timestamp) : new Date();
      const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
      const dateStr = validDate.toISOString().split("T")[0];
      const isoTime = validDate.toISOString();

      const mapped = mappingMap.get(userId);
      let targetId = mapped?.target_id;
      let targetName = mapped?.target_name;
      let targetIdentifier = mapped?.target_identifier;
      let userType: "student" | "teacher" | "unknown" = mapped?.user_type || "unknown";
      let className = mapped?.class_name;

      if (!mapped) {
        const matchedStd = studentRollMap.get(userId) || studentIdCodeMap.get(userId);
        if (matchedStd) {
          targetId = matchedStd.id;
          targetName = `${matchedStd.first_name || ""} ${matchedStd.last_name || ""}`.trim();
          targetIdentifier = matchedStd.student_id || `রোল: ${matchedStd.roll_number}`;
          userType = "student";
          className = Array.isArray(matchedStd.classes) ? matchedStd.classes[0]?.name : matchedStd.classes?.name;
        } else {
          const matchedTch = teacherMap.get(userId);
          if (matchedTch) {
            targetId = matchedTch.id;
            targetName = matchedTch.full_name;
            targetIdentifier = matchedTch.phone;
            userType = "teacher";
          }
        }
      }

      if (targetId) {
        if (userType === "student") {
          studentAttendanceToUpsert.push({
            madrasa_id: matchedMadrasaId,
            student_id: targetId,
            date: dateStr,
            status: "Present",
          });
        } else if (userType === "teacher") {
          teacherAttendanceToUpsert.push({
            madrasa_id: matchedMadrasaId,
            teacher_id: targetId,
            date: dateStr,
            status: "Present",
          });
        }
        processedCount++;

        newLogs.push({
          id: `log_live_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          madrasa_id: matchedMadrasaId,
          device_id: matchedDevice.id,
          device_name: matchedDevice.name,
          device_user_id: userId,
          user_type: userType,
          target_id: targetId,
          target_name: targetName,
          target_identifier: targetIdentifier,
          class_name: className,
          punch_time: isoTime,
          punch_date: dateStr,
          punch_type: p.punch_type || "check_in",
          status: "processed",
          sync_mode: "cloud_push",
          created_at: now,
        });
      } else {
        newLogs.push({
          id: `log_unmapped_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          madrasa_id: matchedMadrasaId,
          device_id: matchedDevice.id,
          device_name: matchedDevice.name,
          device_user_id: userId,
          user_type: "unknown",
          punch_time: isoTime,
          punch_date: dateStr,
          punch_type: "auto",
          status: "unmapped",
          sync_mode: "cloud_push",
          created_at: now,
        });
      }
    }

    // Upsert student attendance
    if (studentAttendanceToUpsert.length > 0) {
      await adminClient
        .from("attendance")
        .upsert(studentAttendanceToUpsert, { onConflict: "student_id, date" });
    }

    // Upsert teacher attendance
    if (teacherAttendanceToUpsert.length > 0) {
      await adminClient
        .from("teacher_attendance")
        .upsert(teacherAttendanceToUpsert, { onConflict: "teacher_id, date" });
    }

    // Update metadata with new logs and device sync stats
    const existingLogs: BiometricPunchLog[] = matchedMeta.biometric_logs || [];
    matchedMeta.biometric_logs = [...newLogs, ...existingLogs].slice(0, 500);

    matchedMeta.biometric_devices = (matchedMeta.biometric_devices || []).map((d: BiometricDevice) => {
      if (d.id === matchedDevice?.id) {
        return {
          ...d,
          last_sync_at: now,
          status: "active",
          total_punches_count: (d.total_punches_count || 0) + processedCount,
        };
      }
      return d;
    });

    await saveMadrasaMetadata(matchedMadrasaId, matchedMeta);

    return NextResponse.json({
      success: true,
      message: `${processedCount} punches recorded and attendance updated successfully.`,
      processed: processedCount,
      totalReceived: punches.length,
      device: matchedDevice.name,
    });
  } catch (err: any) {
    console.error("Biometric Cloud Push Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
