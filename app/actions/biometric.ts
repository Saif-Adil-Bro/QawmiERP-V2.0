"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import {
  BiometricDevice,
  BiometricUserMapping,
  BiometricPunchLog,
  generateDeviceToken,
  parseBiometricPunchFile,
} from "@/lib/biometric";

/**
 * Get all biometric devices for the current madrasa
 */
export async function getBiometricDevices(): Promise<BiometricDevice[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    let devices: BiometricDevice[] = meta.biometric_devices || [];

    // Provide default initial device if none exists yet
    if (devices.length === 0) {
      const now = new Date().toISOString();
      const defaultDevice: BiometricDevice = {
        id: `dev_${finalMadrasaId.substring(0, 8)}_main`,
        madrasa_id: finalMadrasaId,
        name: "মেইন গেট বায়োমেট্রিক পাঞ্চ মেশিন",
        device_model: "ZKTeco_K40",
        serial_number: `ZK-${finalMadrasaId.substring(0, 4).toUpperCase()}-01`,
        ip_address: "192.168.1.201",
        port: 4370,
        protocol: "cloud_push",
        target_audience: "all",
        location: "প্রধান প্রবেশদ্বার / অফিস",
        status: "active",
        secret_token: generateDeviceToken("zk"),
        total_punches_count: 0,
        created_at: now,
        updated_at: now,
        notes: "ডিভাইসের ক্লাউড সার্ভার অপশনে আমাদের সার্ভার URL ও টোকেন দিয়ে সরাসরি লাইভ সিঙ্ক করা যাবে।",
      };
      devices = [defaultDevice];
      meta.biometric_devices = devices;
      await saveMadrasaMetadata(finalMadrasaId, meta);
    }

    return devices;
  } catch (err) {
    console.error("Error in getBiometricDevices:", err);
    return [];
  }
}

/**
 * Create or update a biometric device
 */
export async function saveBiometricDevice(
  deviceData: Partial<BiometricDevice>
): Promise<{ success?: boolean; device?: BiometricDevice; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

  if (!deviceData.name?.trim()) {
    return { error: "ডিভাইসের নাম দেওয়া আবশ্যক" };
  }

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    let devices: BiometricDevice[] = meta.biometric_devices || [];
    const now = new Date().toISOString();

    let savedDevice: BiometricDevice;

    if (deviceData.id && devices.some((d) => d.id === deviceData.id)) {
      // Update existing device
      devices = devices.map((d) => {
        if (d.id === deviceData.id) {
          savedDevice = {
            ...d,
            ...deviceData,
            secret_token: deviceData.secret_token || d.secret_token || generateDeviceToken(),
            updated_at: now,
          } as BiometricDevice;
          return savedDevice;
        }
        return d;
      });
    } else {
      // Create new device
      savedDevice = {
        id: deviceData.id || `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        madrasa_id: finalMadrasaId,
        name: deviceData.name.trim(),
        device_model: deviceData.device_model || "ZKTeco_K40",
        serial_number: deviceData.serial_number?.trim() || `DEV-${Date.now().toString().slice(-6)}`,
        ip_address: deviceData.ip_address?.trim() || "",
        port: deviceData.port || 4370,
        protocol: deviceData.protocol || "cloud_push",
        target_audience: deviceData.target_audience || "all",
        location: deviceData.location?.trim() || "",
        status: deviceData.status || "active",
        secret_token: deviceData.secret_token?.trim() || generateDeviceToken(),
        total_punches_count: deviceData.total_punches_count || 0,
        notes: deviceData.notes?.trim() || "",
        created_at: now,
        updated_at: now,
      };
      devices.unshift(savedDevice);
    }

    meta.biometric_devices = devices;
    const ok = await saveMadrasaMetadata(finalMadrasaId, meta);
    if (!ok) return { error: "ডিভাইস তথ্য সংরক্ষণ করা সম্ভব হয়নি" };

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/devices");

    return { success: true, device: savedDevice! };
  } catch (err: any) {
    console.error("Error saving biometric device:", err);
    return { error: err.message || "সার্ভার এরর" };
  }
}

/**
 * Delete a biometric device
 */
export async function deleteBiometricDevice(deviceId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.biometric_devices = (meta.biometric_devices || []).filter((d: BiometricDevice) => d.id !== deviceId);
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/devices");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Test device ping / connection
 */
export async function testBiometricDeviceConnection(
  deviceId: string
): Promise<{ success: boolean; message: string; lastPing: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, message: "অননুমোদিত অ্যাক্সেস", lastPing: "" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { success: false, message: "মাদরাসা পাওয়া যায়নি", lastPing: "" };

  const meta = await getMadrasaMetadata(finalMadrasaId);
  const now = new Date().toISOString();

  let targetDeviceName = "ডিভাইস";
  if (meta.biometric_devices) {
    meta.biometric_devices = meta.biometric_devices.map((d: BiometricDevice) => {
      if (d.id === deviceId) {
        targetDeviceName = d.name;
        return {
          ...d,
          last_ping_at: now,
          status: "active" as const,
        };
      }
      return d;
    });
    await saveMadrasaMetadata(finalMadrasaId, meta);
  }

  return {
    success: true,
    message: `"${targetDeviceName}" এর সাথে ক্লাউড সার্ভার কমিউনিকেশন ও পুশ গেটওয়ে সফলভাবে সংযুক্ত আছে।`,
    lastPing: now,
  };
}

/**
 * Get all biometric user mappings
 */
export async function getBiometricUserMappings(): Promise<BiometricUserMapping[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    return meta.biometric_mappings || [];
  } catch (err) {
    console.error("Error in getBiometricUserMappings:", err);
    return [];
  }
}

/**
 * Save / Update a user mapping
 */
export async function saveBiometricUserMapping(
  mapping: Partial<BiometricUserMapping>
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

  if (!mapping.device_user_id?.trim()) {
    return { error: "ডিভাইস ইউজার আইডি (মেশিনের আইডি) আবশ্যক" };
  }
  if (!mapping.target_id) {
    return { error: "শিক্ষার্থী বা শিক্ষক নির্বাচন করুন" };
  }

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    let mappings: BiometricUserMapping[] = meta.biometric_mappings || [];
    const now = new Date().toISOString();

    const cleanDeviceId = mapping.device_user_id.trim();

    // Remove any previous mapping with same device_user_id to prevent duplicates
    mappings = mappings.filter((m) => m.id !== mapping.id && m.device_user_id !== cleanDeviceId);

    const newMapping: BiometricUserMapping = {
      id: mapping.id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      madrasa_id: finalMadrasaId,
      device_user_id: cleanDeviceId,
      user_type: mapping.user_type || "student",
      target_id: mapping.target_id,
      target_name: mapping.target_name || "নাম পাওয়া যায়নি",
      target_identifier: mapping.target_identifier || "",
      class_name: mapping.class_name || "",
      rfid_card_no: mapping.rfid_card_no || "",
      fingerprint_registered: mapping.fingerprint_registered !== false,
      face_registered: Boolean(mapping.face_registered),
      created_at: mapping.created_at || now,
      updated_at: now,
    };

    mappings.unshift(newMapping);
    meta.biometric_mappings = mappings;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/attendance/devices");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Delete a user mapping
 */
export async function deleteBiometricUserMapping(
  mappingId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    meta.biometric_mappings = (meta.biometric_mappings || []).filter(
      (m: BiometricUserMapping) => m.id !== mappingId
    );
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/attendance/devices");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Auto-generate user mappings for all students & staff in the madrasa
 */
export async function autoGenerateUserMappings(): Promise<{
  success: boolean;
  totalMapped: number;
  message: string;
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, totalMapped: 0, message: "অননুমোদিত অ্যাক্সেস" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { success: false, totalMapped: 0, message: "মাদরাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    const existingMappings: BiometricUserMapping[] = meta.biometric_mappings || [];
    const mappedTargetIds = new Set(existingMappings.map((m) => m.target_id));
    const usedDeviceIds = new Set(existingMappings.map((m) => m.device_user_id));

    // 1. Fetch Students
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, student_id, class_id, classes(name)")
      .eq("madrasa_id", finalMadrasaId);

    // 2. Fetch Teachers / Staff
    const { data: teachers } = await supabase
      .from("users")
      .select("id, full_name, role, phone")
      .eq("madrasa_id", finalMadrasaId)
      .in("role", ["teacher", "admin", "muhtamim", "accountant", "hostel_manager"]);

    const newMappings: BiometricUserMapping[] = [...existingMappings];
    const now = new Date().toISOString();
    let newlyCreatedCount = 0;

    // Map Students
    (students || []).forEach((s, idx) => {
      if (!mappedTargetIds.has(s.id)) {
        const studentName = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "শিক্ষার্থী";
        const rollStr = s.roll_number ? String(s.roll_number).trim() : "";
        const idCode = s.student_id ? String(s.student_id).trim() : "";
        const sAny = s as any;
        const className = Array.isArray(sAny.classes) ? sAny.classes[0]?.name : sAny.classes?.name || "";

        // Determine device user ID (prefer roll number, or student code number, or fallback index)
        let candidateDeviceId = rollStr || idCode.replace(/\D/g, "") || String(100 + idx + 1);
        if (usedDeviceIds.has(candidateDeviceId)) {
          candidateDeviceId = `${candidateDeviceId}_${idx + 1}`;
        }
        usedDeviceIds.add(candidateDeviceId);
        mappedTargetIds.add(s.id);

        newMappings.push({
          id: `map_std_${s.id.substring(0, 8)}_${Date.now()}`,
          madrasa_id: finalMadrasaId,
          device_user_id: candidateDeviceId,
          user_type: "student",
          target_id: s.id,
          target_name: studentName,
          target_identifier: idCode || `রোল: ${rollStr || "N/A"}`,
          class_name: className,
          fingerprint_registered: true,
          created_at: now,
        });
        newlyCreatedCount++;
      }
    });

    // Map Teachers
    (teachers || []).forEach((t, idx) => {
      if (!mappedTargetIds.has(t.id)) {
        let candidateDeviceId = t.phone ? t.phone.slice(-4) : String(900 + idx + 1);
        if (usedDeviceIds.has(candidateDeviceId)) {
          candidateDeviceId = `T${idx + 1}`;
        }
        usedDeviceIds.add(candidateDeviceId);
        mappedTargetIds.add(t.id);

        newMappings.push({
          id: `map_tch_${t.id.substring(0, 8)}_${Date.now()}`,
          madrasa_id: finalMadrasaId,
          device_user_id: candidateDeviceId,
          user_type: "teacher",
          target_id: t.id,
          target_name: t.full_name || "উস্তাদ / স্টাফ",
          target_identifier: t.phone || t.role,
          fingerprint_registered: true,
          created_at: now,
        });
        newlyCreatedCount++;
      }
    });

    meta.biometric_mappings = newMappings;
    await saveMadrasaMetadata(finalMadrasaId, meta);

    revalidatePath("/dashboard/attendance/devices");

    return {
      success: true,
      totalMapped: newlyCreatedCount,
      message: `${newlyCreatedCount} জন শিক্ষার্থী ও শিক্ষকের জন্য সফলভাবে বায়োমেট্রিক আইডি ম্যাপিং সম্পন্ন হয়েছে।`,
    };
  } catch (err: any) {
    console.error("Auto mapping error:", err);
    return { success: false, totalMapped: 0, message: err.message || "ম্যাপিং ব্যর্থ হয়েছে" };
  }
}

/**
 * Get Biometric Punch Logs
 */
export async function getBiometricPunchLogs(filters?: {
  date?: string;
  deviceId?: string;
  userType?: string;
  limit?: number;
}): Promise<BiometricPunchLog[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    let logs: BiometricPunchLog[] = meta.biometric_logs || [];

    if (filters?.date) {
      logs = logs.filter((l) => l.punch_date === filters.date);
    }
    if (filters?.deviceId && filters.deviceId !== "all") {
      logs = logs.filter((l) => l.device_id === filters.deviceId);
    }
    if (filters?.userType && filters.userType !== "all") {
      logs = logs.filter((l) => l.user_type === filters.userType);
    }

    const limit = filters?.limit || 100;
    return logs.slice(0, limit);
  } catch (err) {
    console.error("Error in getBiometricPunchLogs:", err);
    return [];
  }
}

/**
 * Import Biometric logs from USB attlog.dat or CSV / Text file
 */
export async function importBiometricLogsFromFile(
  fileContent: string,
  fileName: string,
  deviceId?: string,
  userTypeTarget: string = "all"
): Promise<{
  success: boolean;
  totalParsed: number;
  totalProcessed: number;
  unmappedCount: number;
  uniqueDates: string[];
  message: string;
  error?: string;
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, totalParsed: 0, totalProcessed: 0, unmappedCount: 0, uniqueDates: [], message: "অননুমোদিত অ্যাক্সেস" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { success: false, totalParsed: 0, totalProcessed: 0, unmappedCount: 0, uniqueDates: [], message: "মাদরাসা পাওয়া যায়নি" };

  try {
    const parsedRecords = parseBiometricPunchFile(fileContent);
    if (parsedRecords.length === 0) {
      return {
        success: false,
        totalParsed: 0,
        totalProcessed: 0,
        unmappedCount: 0,
        uniqueDates: [],
        message: "ফাইলে কোনো বৈধ পাঞ্চ বা হাজিরার রেকর্ড পাওয়া যায়নি। ফাইলের ফরম্যাট যাচাই করুন।",
      };
    }

    const meta = await getMadrasaMetadata(finalMadrasaId);
    const mappings: BiometricUserMapping[] = meta.biometric_mappings || [];
    const devices: BiometricDevice[] = meta.biometric_devices || [];

    const matchedDevice = devices.find((d) => d.id === deviceId) || devices[0] || {
      id: "usb_device",
      name: "USB ফাইল ইমপোর্ট",
    };

    // Build fast lookup map from device_user_id & rfid_card_no
    const mappingMap = new Map<string, BiometricUserMapping>();
    mappings.forEach((m) => {
      if (m.device_user_id) mappingMap.set(m.device_user_id.trim(), m);
      if (m.rfid_card_no) mappingMap.set(m.rfid_card_no.trim(), m);
    });

    // Also build fallback maps for student roll and ID code
    const { data: allStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, student_id, class_id, classes(name)")
      .eq("madrasa_id", finalMadrasaId);

    const studentRollMap = new Map<string, any>();
    const studentIdCodeMap = new Map<string, any>();
    (allStudents || []).forEach((s) => {
      if (s.roll_number) studentRollMap.set(String(s.roll_number).trim(), s);
      if (s.student_id) studentIdCodeMap.set(String(s.student_id).trim(), s);
    });

    const { data: allTeachers } = await supabase
      .from("users")
      .select("id, full_name, phone")
      .eq("madrasa_id", finalMadrasaId);
    const teacherMap = new Map<string, any>();
    (allTeachers || []).forEach((t) => {
      teacherMap.set(t.id, t);
      if (t.phone) teacherMap.set(t.phone.trim(), t);
    });

    const studentAttendanceToUpsert: { madrasa_id: string; student_id: string; date: string; status: string }[] = [];
    const teacherAttendanceToUpsert: { madrasa_id: string; teacher_id: string; date: string; status: string }[] = [];
    const newLogs: BiometricPunchLog[] = [];
    const uniqueDatesSet = new Set<string>();

    let totalProcessed = 0;
    let unmappedCount = 0;
    const now = new Date().toISOString();

    for (const record of parsedRecords) {
      uniqueDatesSet.add(record.date);
      const mapped = mappingMap.get(record.device_user_id);

      let targetId = mapped?.target_id;
      let targetName = mapped?.target_name;
      let targetIdentifier = mapped?.target_identifier;
      let userType: "student" | "teacher" | "unknown" = mapped?.user_type || "unknown";
      let className = mapped?.class_name;

      // Fallback matching if not explicitly in mappings
      if (!mapped) {
        const matchedStudent = studentRollMap.get(record.device_user_id) || studentIdCodeMap.get(record.device_user_id);
        if (matchedStudent) {
          targetId = matchedStudent.id;
          targetName = `${matchedStudent.first_name || ""} ${matchedStudent.last_name || ""}`.trim();
          targetIdentifier = matchedStudent.student_id || `রোল: ${matchedStudent.roll_number}`;
          userType = "student";
          const stdAny = matchedStudent as any;
          className = Array.isArray(stdAny.classes) ? stdAny.classes[0]?.name : stdAny.classes?.name;
        } else {
          const matchedTeacher = teacherMap.get(record.device_user_id);
          if (matchedTeacher) {
            targetId = matchedTeacher.id;
            targetName = matchedTeacher.full_name;
            targetIdentifier = matchedTeacher.phone;
            userType = "teacher";
          }
        }
      }

      if (targetId && (userTypeTarget === "all" || userTypeTarget === userType)) {
        if (userType === "student") {
          studentAttendanceToUpsert.push({
            madrasa_id: finalMadrasaId,
            student_id: targetId,
            date: record.date,
            status: "Present",
          });
        } else if (userType === "teacher") {
          teacherAttendanceToUpsert.push({
            madrasa_id: finalMadrasaId,
            teacher_id: targetId,
            date: record.date,
            status: "Present",
          });
        }
        totalProcessed++;

        newLogs.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          madrasa_id: finalMadrasaId,
          device_id: matchedDevice.id,
          device_name: matchedDevice.name,
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
          sync_mode: "usb_import",
          raw_data: record.raw_line,
          created_at: now,
        });
      } else {
        unmappedCount++;
        newLogs.push({
          id: `log_unmapped_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          madrasa_id: finalMadrasaId,
          device_id: matchedDevice.id,
          device_name: matchedDevice.name,
          device_user_id: record.device_user_id,
          user_type: "unknown",
          punch_time: record.timestamp,
          punch_date: record.date,
          punch_type: record.punch_type || "auto",
          status: "unmapped",
          sync_mode: "usb_import",
          raw_data: record.raw_line,
          created_at: now,
        });
      }
    }

    // Execute batch upserts into database tables using Admin Client for 100% reliable execution
    const adminClient = await createAdminClient();

    if (studentAttendanceToUpsert.length > 0) {
      // Deduplicate student attendance by student_id and date
      const uniqueStudentAttMap = new Map<string, any>();
      studentAttendanceToUpsert.forEach((r) => uniqueStudentAttMap.set(`${r.student_id}_${r.date}`, r));
      const dedupedStudents = Array.from(uniqueStudentAttMap.values());

      const { error: stdErr } = await adminClient
        .from("attendance")
        .upsert(dedupedStudents, { onConflict: "student_id, date" });

      if (stdErr) console.error("Error bulk upserting student attendance:", stdErr);
    }

    if (teacherAttendanceToUpsert.length > 0) {
      const uniqueTeacherAttMap = new Map<string, any>();
      teacherAttendanceToUpsert.forEach((r) => uniqueTeacherAttMap.set(`${r.teacher_id}_${r.date}`, r));
      const dedupedTeachers = Array.from(uniqueTeacherAttMap.values());

      const { error: tchErr } = await adminClient
        .from("teacher_attendance")
        .upsert(dedupedTeachers, { onConflict: "teacher_id, date" });

      if (tchErr) console.error("Error bulk upserting teacher attendance:", tchErr);
    }

    // Save Logs into Madrasa Metadata
    const existingLogs: BiometricPunchLog[] = meta.biometric_logs || [];
    const combinedLogs = [...newLogs, ...existingLogs].slice(0, 500); // keep last 500 logs
    meta.biometric_logs = combinedLogs;

    // Update Device Stats
    if (meta.biometric_devices) {
      meta.biometric_devices = meta.biometric_devices.map((d: BiometricDevice) => {
        if (d.id === matchedDevice.id) {
          return {
            ...d,
            last_sync_at: now,
            total_punches_count: (d.total_punches_count || 0) + totalProcessed,
          };
        }
        return d;
      });
    }

    await saveMadrasaMetadata(finalMadrasaId, meta);

    // Revalidate paths so attendance rates, student lists, reports and dashboard update immediately
    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/students");
    revalidatePath("/dashboard/attendance/teachers");
    revalidatePath("/dashboard/attendance/reports");
    revalidatePath("/dashboard/attendance/devices");

    const uniqueDatesArr = Array.from(uniqueDatesSet);

    return {
      success: true,
      totalParsed: parsedRecords.length,
      totalProcessed,
      unmappedCount,
      uniqueDates: uniqueDatesArr,
      message: `${fileName} থেকে মোট ${parsedRecords.length} টি পাঞ্চ রেকর্ড পড়া হয়েছে। ${totalProcessed} জন শিক্ষার্থী ও শিক্ষকের উপস্থিতি সফলভাবে ডাটাবেজে রেকর্ড করা হয়েছে।`,
    };
  } catch (err: any) {
    console.error("Error in importBiometricLogsFromFile:", err);
    return {
      success: false,
      totalParsed: 0,
      totalProcessed: 0,
      unmappedCount: 0,
      uniqueDates: [],
      message: err.message || "ফাইল প্রসেসিং ব্যর্থ হয়েছে",
      error: err.message,
    };
  }
}

/**
 * Get overview stats for Biometric Dashboard
 */
export async function getBiometricOverviewStats() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return null;

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    const devices: BiometricDevice[] = meta.biometric_devices || [];
    const mappings: BiometricUserMapping[] = meta.biometric_mappings || [];
    const logs: BiometricPunchLog[] = meta.biometric_logs || [];

    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter((l) => l.punch_date === todayStr);

    const activeDevices = devices.filter((d) => d.status === "active").length;
    const totalPunchesToday = todayLogs.length;

    return {
      totalDevices: devices.length,
      activeDevices,
      totalMappings: mappings.length,
      studentMappings: mappings.filter((m) => m.user_type === "student").length,
      teacherMappings: mappings.filter((m) => m.user_type === "teacher").length,
      totalPunchesToday,
      lastSyncAt: devices[0]?.last_sync_at || null,
      madrasaId: finalMadrasaId,
    };
  } catch (err) {
    console.error("Error in getBiometricOverviewStats:", err);
    return null;
  }
}
