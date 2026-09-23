import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { BiometricDevice, BiometricUserMapping, BiometricPunchLog, parseBiometricPunchFile } from "@/lib/biometric";

/**
 * Standard ZKTeco ADMS / iClock Protocol Handler
 * 
 * ZKTeco machines handshake via GET /iclock/cdata?SN=...&options=all
 * and push punch logs via POST /iclock/cdata?SN=...&table=ATTLOG
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sn = searchParams.get("SN") || "";

  // Handshake response expected by ZKTeco firmware
  const responseBody = [
    `GET OPTION FROM: ${sn}`,
    `Stamp=9999`,
    `OpStamp=9999`,
    `PhotoStamp=9999`,
    `ErrorDelay=60`,
    `Delay=30`,
    `TransTimes=00:00;14:05`,
    `TransInterval=1`,
    `TransFlag=1111000000`,
    `TimeZone=6`,
    `Realtime=1`,
    `Encrypt=0`,
    `ServerVersion=3.4.1`,
  ].join("\n");

  return new NextResponse(responseBody, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sn = searchParams.get("SN") || "";
    const rawBody = await req.text();

    if (!rawBody || rawBody.trim().length === 0) {
      return new NextResponse("OK: 0", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const adminClient = await createAdminClient();
    const { data: madrasas } = await adminClient
      .from("madrasas")
      .select("id, name, registration_no");

    let matchedMadrasaId: string | null = null;
    let matchedDevice: BiometricDevice | null = null;
    let matchedMeta: any = null;

    for (const m of madrasas || []) {
      if (!m.registration_no || !m.registration_no.startsWith("{")) continue;
      try {
        const meta = JSON.parse(m.registration_no);
        const devices: BiometricDevice[] = meta.biometric_devices || [];
        const found = devices.find(
          (d) => (sn && d.serial_number === sn) || d.protocol === "cloud_push"
        );
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

    if (!matchedMadrasaId || !matchedMeta) {
      return new NextResponse("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const parsedRecords = parseBiometricPunchFile(rawBody);
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

    const studentAttendanceToUpsert: any[] = [];
    const teacherAttendanceToUpsert: any[] = [];
    const newLogs: BiometricPunchLog[] = [];
    let processedCount = 0;
    const now = new Date().toISOString();

    for (const record of parsedRecords) {
      const mapped = mappingMap.get(record.device_user_id);
      let targetId = mapped?.target_id;
      let targetName = mapped?.target_name;
      let targetIdentifier = mapped?.target_identifier;
      let userType: "student" | "teacher" | "unknown" = mapped?.user_type || "unknown";
      let className = mapped?.class_name;

      if (!mapped) {
        const matchedStd = studentRollMap.get(record.device_user_id) || studentIdCodeMap.get(record.device_user_id);
        if (matchedStd) {
          targetId = matchedStd.id;
          targetName = `${matchedStd.first_name || ""} ${matchedStd.last_name || ""}`.trim();
          targetIdentifier = matchedStd.student_id || `রোল: ${matchedStd.roll_number}`;
          userType = "student";
          className = Array.isArray(matchedStd.classes) ? matchedStd.classes[0]?.name : matchedStd.classes?.name;
        }
      }

      if (targetId) {
        if (userType === "student") {
          studentAttendanceToUpsert.push({
            madrasa_id: matchedMadrasaId,
            student_id: targetId,
            date: record.date,
            status: "Present",
          });
        } else if (userType === "teacher") {
          teacherAttendanceToUpsert.push({
            madrasa_id: matchedMadrasaId,
            teacher_id: targetId,
            date: record.date,
            status: "Present",
          });
        }
        processedCount++;

        newLogs.push({
          id: `log_zk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          madrasa_id: matchedMadrasaId,
          device_id: matchedDevice?.id || "zk_device",
          device_name: matchedDevice?.name || "ZKTeco Machine",
          device_user_id: record.device_user_id,
          user_type: userType,
          target_id: targetId,
          target_name: targetName,
          target_identifier: targetIdentifier,
          class_name: className,
          punch_time: record.timestamp,
          punch_date: record.date,
          punch_type: record.punch_type || "check_in",
          status: "processed",
          sync_mode: "cloud_push",
          raw_data: record.raw_line,
          created_at: now,
        });
      }
    }

    if (studentAttendanceToUpsert.length > 0) {
      await adminClient
        .from("attendance")
        .upsert(studentAttendanceToUpsert, { onConflict: "student_id, date" });
    }

    if (teacherAttendanceToUpsert.length > 0) {
      await adminClient
        .from("teacher_attendance")
        .upsert(teacherAttendanceToUpsert, { onConflict: "teacher_id, date" });
    }

    // Save logs and stats
    const existingLogs: BiometricPunchLog[] = matchedMeta.biometric_logs || [];
    matchedMeta.biometric_logs = [...newLogs, ...existingLogs].slice(0, 500);

    if (matchedDevice) {
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
    }

    await saveMadrasaMetadata(matchedMadrasaId, matchedMeta);

    return new NextResponse(`OK: ${processedCount}`, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    console.error("ZKTeco ADMS Error:", err);
    return new NextResponse("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
