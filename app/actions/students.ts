"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  getMadrasaMetadata,
  saveMadrasaMetadata,
  ExtendedStudentProfile,
  getDefaultSessions,
  hydrateStudentWithMetadata,
} from "@/lib/sessions";

export async function getStudents() {
  try {
    const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
    const scope = await getUserDataAccessScope();

    const supabase = await createClient();
    let query = supabase.from("students").select("*, classes(*)").order("created_at", { ascending: false });

    if (!scope.isUnrestricted) {
      if (scope.allowedStudentIds.length === 0) {
        return [];
      }
      query = query.in("id", scope.allowedStudentIds);
    }

    let { data, error } = await query;

    if (error || !data) {
      console.warn("Retrying students fetch with admin fallback...");
      try {
        const adminClient = await createAdminClient();
        let adminQuery = adminClient.from("students").select("*, classes(*)").order("created_at", { ascending: false });
        if (!scope.isUnrestricted) {
          if (scope.allowedStudentIds.length === 0) return [];
          adminQuery = adminQuery.in("id", scope.allowedStudentIds);
        }
        const { data: adminData } = await adminQuery;
        if (adminData && adminData.length > 0) {
          data = adminData;
        } else {
          let fallbackQuery = adminClient.from("students").select("*").order("created_at", { ascending: false });
          if (!scope.isUnrestricted) {
            if (scope.allowedStudentIds.length === 0) return [];
            fallbackQuery = fallbackQuery.in("id", scope.allowedStudentIds);
          }
          const { data: fallbackData } = await fallbackQuery;
          data = fallbackData || [];
        }
      } catch {
        data = [];
      }
    }

    const rawStudents = data || [];
    if (rawStudents.length === 0) return [];

    try {
      const madrasaId = rawStudents[0]?.madrasa_id || (await getAuthMadrasaId(supabase));
      if (madrasaId) {
        const meta = await getMadrasaMetadata(madrasaId);
        return rawStudents.map((std: any) => hydrateStudentWithMetadata(std, meta));
      }
    } catch (hydrateErr) {
      console.warn("Hydrate students metadata warning:", hydrateErr);
    }

    return rawStudents;
  } catch (err) {
    console.error("Exception in getStudents:", err);
    return [];
  }
}

export async function getClasses() {
  try {
    const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
    const scope = await getUserDataAccessScope();

    const supabase = await createClient();
    let query = supabase.from("classes").select("*").order("name");

    if (!scope.isUnrestricted && scope.userRole === "teacher") {
      if (scope.allowedClassIds.length === 0) {
        return [];
      }
      query = query.in("id", scope.allowedClassIds);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      try {
        const adminClient = await createAdminClient();
        let adminQuery = adminClient.from("classes").select("*").order("name");
        if (!scope.isUnrestricted && scope.userRole === "teacher") {
          if (scope.allowedClassIds.length === 0) return [];
          adminQuery = adminQuery.in("id", scope.allowedClassIds);
        }
        const { data: adminData } = await adminQuery;
        return adminData || [];
      } catch {
        return [];
      }
    }
    return data;
  } catch (err) {
    console.error("Exception in getClasses:", err);
    return [];
  }
}

export async function getStudentById(id: string) {
  try {
    const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
    const scope = await getUserDataAccessScope();

    if (!scope.isUnrestricted && !scope.allowedStudentIds.includes(id)) {
      console.warn(`Unauthorized attempt to view student ${id}`);
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select("*, classes(*)")
      .eq("id", id)
      .single();

    let student = data;
    if (!student) {
      try {
        const adminClient = await createAdminClient();
        const { data: fallbackData } = await adminClient
          .from("students")
          .select("*, classes(*)")
          .eq("id", id)
          .single();
        student = fallbackData || null;
      } catch {
        student = null;
      }
    }

    if (student) {
      try {
        const mId = student.madrasa_id || (await getAuthMadrasaId(supabase));
        if (mId) {
          const meta = await getMadrasaMetadata(mId);
          student = hydrateStudentWithMetadata(student, meta);
        }
      } catch (metaErr) {
        console.warn("Hydrate student metadata warning:", metaErr);
      }
    }
    return student || null;
  } catch (err) {
    console.error("Exception in getStudentById:", err);
    return null;
  }
}

export async function getAuthMadrasaId(supabase?: any, user?: any): Promise<string> {
  try {
    const adminClient = await createAdminClient();

    // 1. Try getting user's madrasa_id from users table using adminClient
    if (user?.id) {
      const { data: userData } = await adminClient
        .from("users")
        .select("madrasa_id")
        .eq("id", user.id)
        .single();

      if (userData?.madrasa_id) {
        return userData.madrasa_id;
      }
    }

    // 2. If user doesn't have a valid madrasa_id, find or create the primary madrasa
    const { data: firstMadrasa } = await adminClient
      .from("madrasas")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    let finalMadrasaId = firstMadrasa?.id;

    if (!finalMadrasaId) {
      // Create new madrasa if table is completely empty
      const { data: newMadrasa } = await adminClient
        .from("madrasas")
        .insert({
          name: "কওমি মাদরাসা",
          subscription_plan: "free",
        })
        .select("id")
        .single();

      if (newMadrasa?.id) {
        finalMadrasaId = newMadrasa.id;
      }
    }

    if (finalMadrasaId && user?.id) {
      try {
        await adminClient.from("users").upsert({
          id: user.id,
          madrasa_id: finalMadrasaId,
          full_name: user.email?.split("@")[0] || "Admin",
          email: user.email || "",
          role: "super_admin",
        });
      } catch {}
    }

    return finalMadrasaId || "default_madrasa_id";
  } catch (err) {
    console.error("Exception in getAuthMadrasaId:", err);
    return "default_madrasa_id";
  }
}

export async function getNextClassRoll(classId: string): Promise<{ nextRoll: string; existingRolls: string[] }> {
  try {
    if (!classId) return { nextRoll: "1", existingRolls: [] };
    const adminClient = await createAdminClient();
    const { data: students } = await adminClient
      .from("students")
      .select("id, roll_number, class_id, first_name, last_name")
      .eq("class_id", classId);

    const rolls: string[] = [];
    let maxRollNum = 0;

    (students || []).forEach((s) => {
      if (s.roll_number !== undefined && s.roll_number !== null) {
        const rollStr = String(s.roll_number).trim();
        if (rollStr) {
          rolls.push(rollStr);
          // Convert any Bengali digits to standard integer
          const numeric = parseInt(
            rollStr.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()),
            10
          );
          if (!isNaN(numeric) && numeric > maxRollNum) {
            maxRollNum = numeric;
          }
        }
      }
    });

    const nextRoll = (maxRollNum + 1).toString();
    return { nextRoll, existingRolls: rolls };
  } catch (err) {
    console.error("Error in getNextClassRoll:", err);
    return { nextRoll: "1", existingRolls: [] };
  }
}

export async function checkRollAvailability(
  classId: string,
  rollNumber: string,
  excludeStudentId?: string
): Promise<{ available: boolean; conflictStudentName?: string; nextRoll?: string }> {
  try {
    if (!classId || !rollNumber) {
      return { available: true };
    }
    const adminClient = await createAdminClient();
    const { data: students } = await adminClient
      .from("students")
      .select("id, roll_number, class_id, first_name, last_name")
      .eq("class_id", classId);

    const normalizedTarget = rollNumber.trim().toLowerCase();
    const conflict = (students || []).find((s) => {
      if (excludeStudentId && s.id === excludeStudentId) return false;
      const sRoll = String(s.roll_number || "").trim().toLowerCase();
      return sRoll && sRoll === normalizedTarget;
    });

    if (conflict) {
      const conflictName = `${conflict.first_name || ""} ${conflict.last_name || ""}`.trim() || "অন্য শিক্ষার্থী";
      return {
        available: false,
        conflictStudentName: conflictName,
      };
    }

    return { available: true };
  } catch (err) {
    console.error("Error in checkRollAvailability:", err);
    return { available: true };
  }
}

export async function createStudent(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) {
    return { error: "No Madrasa exists in the system. Please register a Madrasa first." };
  }

  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim() || "";
  let rollNumber = (formData.get("roll_number") as string)?.trim() || "";
  const classId = (formData.get("class_id") as string)?.trim();
  const bloodGroup = (formData.get("blood_group") as string) || "";
  const dateOfBirth = (formData.get("date_of_birth") as string) || "";
  const gender = (formData.get("gender") as string) || "MALE";
  const parentPhone = (formData.get("parent_phone") as string)?.trim() || "";
  const parentEmail = (formData.get("parent_email") as string)?.trim() || "";
  const password = formData.get("password") as string;
  const fatherName = (formData.get("father_name") as string)?.trim() || "";
  const address = (formData.get("address") as string)?.trim() || "";
  const photoUrl = (formData.get("photo_url") as string)?.trim() || "";

  // Extended fields
  const residentialStatus = (formData.get("residential_status") as string) || "অনাবাসিক";
  const isBoardingRaw = formData.get("is_boarding");
  const isBoarding = isBoardingRaw === "true" || isBoardingRaw === "on" || residentialStatus === "আবাসিক";
  const boardingType = (formData.get("boarding_type") as string) || (isBoarding ? "সাধারণ পেইং" : "অনাবাসিক");
  const motherName = (formData.get("mother_name") as string)?.trim() || "";
  const fatherOccupation = (formData.get("father_occupation") as string)?.trim() || "";
  const guardianName = (formData.get("guardian_name") as string)?.trim() || "";
  const guardianRelation = (formData.get("guardian_relation") as string)?.trim() || "";
  const emergencyContact = (formData.get("emergency_contact") as string)?.trim() || "";
  const nidOrBirthCert = (formData.get("nid_or_birth_cert") as string)?.trim() || "";
  const previousMadrasa = (formData.get("previous_madrasa") as string)?.trim() || "";
  const roomNo = (formData.get("room_no") as string)?.trim() || "";
  const seatNo = (formData.get("seat_no") as string)?.trim() || "";
  const studentStatus = (formData.get("student_status") as string) || "ACTIVE";
  const medicalNotes = (formData.get("medical_notes") as string)?.trim() || "";
  const remarks = (formData.get("remarks") as string)?.trim() || "";

  // Fee structure fields
  const admissionFee = Number(formData.get("admission_fee") || 0);
  const monthlyFee = Number(formData.get("monthly_fee") || 0);
  const khorakiFee = Number(formData.get("khoraki_fee") || 0);
  const accommodationFee = Number(formData.get("accommodation_fee") || 0);
  const transportFee = Number(formData.get("transport_fee") || 0);
  const otherFee = Number(formData.get("other_fee") || 0);
  const feeDiscount = Number(formData.get("fee_discount") || 0);
  const feeDiscountReason = (formData.get("fee_discount_reason") as string)?.trim() || "";
  const totalMonthlyFee = Math.max(0, (monthlyFee + khorakiFee + accommodationFee + transportFee + otherFee) - feeDiscount);

  if (!firstName || !classId) {
    return { error: "শিক্ষার্থীর নাম এবং জামাত/শ্রেণি নির্বাচন আবশ্যক।" };
  }

  // Auto-calculate next sequential roll if roll is not explicitly provided
  if (!rollNumber) {
    const { nextRoll } = await getNextClassRoll(classId);
    rollNumber = nextRoll;
  } else {
    // Check for duplicate roll in this class
    const rollCheck = await checkRollAvailability(classId, rollNumber);
    if (!rollCheck.available) {
      return {
        error: `এই জামাতে '${rollNumber}' রোল নম্বরটি ইতিমধ্যে অন্য একজন শিক্ষার্থীর (${rollCheck.conflictStudentName}) জন্য নির্ধারিত আছে। অনুগ্রহ করে ভিন্ন রোল নম্বর দিন।`,
      };
    }
  }

  let authUserId = null;

  if (parentEmail && password) {
    const adminClient = await createAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: parentEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Error creating student/parent auth user:", authError);
      return { error: `অ্যাকাউন্ট তৈরিতে ত্রুটি: ${authError.message}` };
    }
    
    authUserId = authData.user.id;

    // Insert into users table
    const { error: userError } = await adminClient.from("users").insert({
      id: authUserId,
      madrasa_id: finalMadrasaId,
      full_name: `${firstName}'s Parent`,
      email: parentEmail,
      phone: parentPhone || null,
      role: 'parent'
    });

    if (userError) {
      console.error("Error creating parent user profile:", userError);
      return { error: `প্রোফাইল তৈরিতে ত্রুটি: ${userError.message}` };
    }
  }

  let studentPayload: any = {
    madrasa_id: finalMadrasaId,
    first_name: firstName,
    last_name: lastName,
    roll_number: rollNumber,
    class_id: classId,
    blood_group: bloodGroup,
    date_of_birth: dateOfBirth,
    gender: gender,
    parent_phone: parentPhone,
    father_name: fatherName,
    address: address,
    photo_url: photoUrl,
  };

  let insertedStudent: any = null;
  const { data: resData, error } = await supabase.from("students").insert(studentPayload).select("id").single();
  
  if (error) {
    // If blood_group, date_of_birth or gender column doesn't exist in students table, retry without them
    if (error.message?.includes("blood_group") || error.message?.includes("date_of_birth") || error.message?.includes("gender")) {
      delete studentPayload.blood_group;
      delete studentPayload.date_of_birth;
      delete studentPayload.gender;
      const { data: fallbackData, error: fallbackError } = await supabase.from("students").insert(studentPayload).select("id").single();
      if (fallbackError) {
        console.error("Error creating student:", fallbackError);
        return { error: fallbackError.message };
      }
      insertedStudent = fallbackData;
    } else {
      console.error("Error creating student:", error);
      return { error: error.message };
    }
  } else {
    insertedStudent = resData;
  }

  // If a parent auth user was created, bind this student_id to their auth metadata
  if (authUserId && insertedStudent?.id) {
    try {
      const adminClient = await createAdminClient();
      await adminClient.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          student_id: insertedStudent.id,
          full_name: `${firstName}'s Parent`,
          phone: parentPhone || undefined,
        },
      });
    } catch (metaErr) {
      console.warn("Could not bind student_id to parent auth metadata:", metaErr);
    }
  }

  // Auto enroll student into current active academic session & save extended student profile
  if (insertedStudent?.id) {
    try {
      const { getMadrasaMetadata, saveMadrasaMetadata, getDefaultSessions } = await import("@/lib/sessions");
      const meta = await getMadrasaMetadata(finalMadrasaId);

      // 1. Save extended student profile
      if (!meta.student_profiles) meta.student_profiles = {};
      meta.student_profiles[insertedStudent.id] = {
        student_id: insertedStudent.id,
        first_name: firstName,
        last_name: lastName,
        roll_number: rollNumber,
        class_id: classId,
        father_name: fatherName,
        parent_phone: parentPhone,
        address: address,
        photo_url: photoUrl,
        blood_group: bloodGroup,
        date_of_birth: dateOfBirth,
        gender: gender,
        residential_status: residentialStatus as any,
        is_boarding: isBoarding,
        boarding_type: boardingType as any,
        mother_name: motherName,
        guardian_name: guardianName,
        guardian_relation: guardianRelation,
        emergency_contact: emergencyContact,
        nid_or_birth_cert: nidOrBirthCert,
        previous_madrasa: previousMadrasa,
        room_no: roomNo,
        seat_no: seatNo,
        student_status: studentStatus as any,
        admission_fee: admissionFee,
        monthly_fee: monthlyFee,
        khoraki_fee: khorakiFee,
        accommodation_fee: accommodationFee,
        transport_fee: transportFee,
        other_fee: otherFee,
        fee_discount: feeDiscount,
        fee_discount_reason: feeDiscountReason,
        total_monthly_fee: totalMonthlyFee,
        father_occupation: fatherOccupation,
        medical_notes: medicalNotes,
        remarks: remarks,
        updated_at: new Date().toISOString(),
      };

      // 2. Auto enroll into current session
      const sessions = meta.sessions || getDefaultSessions(finalMadrasaId);
      const currentSession = sessions.find((s) => s.is_current) || sessions[0];
      if (currentSession) {
        const enrollments = meta.enrollments || [];
        enrollments.push({
          id: `enr_${insertedStudent.id}_${currentSession.id}`,
          madrasa_id: finalMadrasaId,
          student_id: insertedStudent.id,
          session_id: currentSession.id,
          class_id: classId,
          roll_number: rollNumber,
          status: "ACTIVE",
          enrollment_date: new Date().toISOString().split("T")[0],
          created_at: new Date().toISOString(),
        });
        meta.enrollments = enrollments;
      }
      await saveMadrasaMetadata(finalMadrasaId, meta);
    } catch (sessionEnrollErr) {
      console.warn("Auto enrollment error:", sessionEnrollErr);
    }
  }

  try {
    const { recordActivityLog } = await import("@/app/actions/activity-logs");
    await recordActivityLog({
      action_type: "CREATE",
      module: "STUDENTS",
      title: "নতুন শিক্ষার্থী নিবন্ধন সম্পন্ন",
      description: `${firstName} ${lastName || ""} কে শ্রেণি রোল ${rollNumber || "অনির্ধারিত"} সহ নতুন শিক্ষার্থী হিসেবে ভর্তি ও নিবন্ধন করা হয়েছে।`,
      entity_id: insertedStudent?.id || undefined,
      entity_type: "student",
      link: insertedStudent?.id ? `/dashboard/students/${insertedStudent.id}` : "/dashboard/students",
      severity: "SUCCESS",
    });
  } catch (actErr) {
    console.warn("Activity log creation error:", actErr);
  }

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/academic/sessions");
  revalidatePath("/dashboard/boarding/meals");
  return { success: true };
}

export async function updateStudent(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);

  const id = formData.get("id") as string;
  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim();
  const rollNumber = (formData.get("roll_number") as string)?.trim() || "";
  const classId = formData.get("class_id") as string;
  const bloodGroup = (formData.get("blood_group") as string) || "";
  const dateOfBirth = (formData.get("date_of_birth") as string) || "";
  const gender = (formData.get("gender") as string) || "MALE";
  const parentPhone = (formData.get("parent_phone") as string)?.trim() || "";
  const fatherName = (formData.get("father_name") as string)?.trim() || "";
  const address = (formData.get("address") as string)?.trim() || "";
  const photoUrl = (formData.get("photo_url") as string)?.trim() || "";

  // Extended fields
  const residentialStatus = (formData.get("residential_status") as string) || "অনাবাসিক";
  const isBoardingRaw = formData.get("is_boarding");
  const isBoarding = isBoardingRaw !== null && isBoardingRaw !== undefined
    ? (isBoardingRaw === "true" || isBoardingRaw === "on")
    : (residentialStatus === "আবাসিক");
  const boardingType = (formData.get("boarding_type") as string) || (isBoarding ? "সাধারণ পেইং" : "অনাবাসিক");
  const motherName = (formData.get("mother_name") as string)?.trim() || "";
  const fatherOccupation = (formData.get("father_occupation") as string)?.trim() || "";
  const guardianName = (formData.get("guardian_name") as string)?.trim() || "";
  const guardianRelation = (formData.get("guardian_relation") as string)?.trim() || "";
  const emergencyContact = (formData.get("emergency_contact") as string)?.trim() || "";
  const nidOrBirthCert = (formData.get("nid_or_birth_cert") as string)?.trim() || "";
  const previousMadrasa = (formData.get("previous_madrasa") as string)?.trim() || "";
  const roomNo = (formData.get("room_no") as string)?.trim() || "";
  const seatNo = (formData.get("seat_no") as string)?.trim() || "";
  const studentStatus = (formData.get("student_status") as string) || "ACTIVE";
  const medicalNotes = (formData.get("medical_notes") as string)?.trim() || "";
  const remarks = (formData.get("remarks") as string)?.trim() || "";

  // Fee structure fields
  const admissionFee = formData.get("admission_fee") !== null ? Number(formData.get("admission_fee") || 0) : undefined;
  const monthlyFee = formData.get("monthly_fee") !== null ? Number(formData.get("monthly_fee") || 0) : undefined;
  const khorakiFee = formData.get("khoraki_fee") !== null ? Number(formData.get("khoraki_fee") || 0) : undefined;
  const accommodationFee = formData.get("accommodation_fee") !== null ? Number(formData.get("accommodation_fee") || 0) : undefined;
  const transportFee = formData.get("transport_fee") !== null ? Number(formData.get("transport_fee") || 0) : undefined;
  const otherFee = formData.get("other_fee") !== null ? Number(formData.get("other_fee") || 0) : undefined;
  const feeDiscount = formData.get("fee_discount") !== null ? Number(formData.get("fee_discount") || 0) : undefined;
  const feeDiscountReason = formData.get("fee_discount_reason") !== null ? ((formData.get("fee_discount_reason") as string)?.trim() || "") : undefined;
  const totalMonthlyFee = (monthlyFee !== undefined || khorakiFee !== undefined) 
    ? Math.max(0, ((monthlyFee || 0) + (khorakiFee || 0) + (accommodationFee || 0) + (transportFee || 0) + (otherFee || 0)) - (feeDiscount || 0))
    : undefined;

  if (!id || !firstName || !classId) {
    return { error: "শিক্ষার্থীর আইডি, নাম এবং জামাত/শ্রেণি আবশ্যক।" };
  }

  // Check roll duplication in this class
  if (rollNumber) {
    const rollCheck = await checkRollAvailability(classId, rollNumber, id);
    if (!rollCheck.available) {
      return {
        error: `এই জামাতে '${rollNumber}' রোল নম্বরটি ইতিমধ্যে অন্য একজন শিক্ষার্থীর (${rollCheck.conflictStudentName}) জন্য নির্ধারিত আছে। অনুগ্রহ করে ভিন্ন রোল নম্বর দিন।`,
      };
    }
  }

  // 1. Look up class details for class_name and madrasa_id
  let className = "";
  let classMadrasaId = "";
  try {
    const { data: cls } = await adminClient
      .from("classes")
      .select("id, name, madrasa_id")
      .eq("id", classId)
      .single();
    if (cls) {
      className = cls.name || "";
      classMadrasaId = cls.madrasa_id || "";
    }
  } catch (clsErr) {
    console.warn("Class lookup warning:", clsErr);
  }

  // 2. Fetch existing student to determine madrasaId
  let madrasaId = classMadrasaId;
  try {
    const { data: std } = await adminClient
      .from("students")
      .select("madrasa_id")
      .eq("id", id)
      .single();
    if (std?.madrasa_id) {
      madrasaId = std.madrasa_id;
    }
  } catch {}

  if (!madrasaId) {
    madrasaId = await getAuthMadrasaId(supabase, user);
  }

  // 3. Update PostgreSQL `students` table
  let updatePayload: any = {
    first_name: firstName,
    last_name: lastName,
    roll_number: rollNumber,
    class_id: classId,
    class_name: className,
    parent_phone: parentPhone,
    father_name: fatherName,
    address: address,
    photo_url: photoUrl,
    blood_group: bloodGroup,
    date_of_birth: dateOfBirth,
    gender: gender,
  };

  let { error: updateError } = await adminClient
    .from("students")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    // If blood_group, date_of_birth or gender do not exist in the physical students table
    delete updatePayload.blood_group;
    delete updatePayload.date_of_birth;
    delete updatePayload.gender;
    let res = await adminClient.from("students").update(updatePayload).eq("id", id);
    if (res.error && res.error.message?.includes("class_name")) {
      delete updatePayload.class_name;
      res = await adminClient.from("students").update(updatePayload).eq("id", id);
    }
    if (res.error && res.error.message?.includes("photo_url")) {
      delete updatePayload.photo_url;
      res = await adminClient.from("students").update(updatePayload).eq("id", id);
    }
    updateError = res.error;
  }

  if (updateError) {
    // Fallback attempt with standard supabase client
    delete updatePayload.blood_group;
    delete updatePayload.date_of_birth;
    delete updatePayload.gender;
    const { error: userClientErr } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", id);
    if (userClientErr) {
      console.error("Error updating student in students table:", userClientErr);
    }
  }

  // 4. Save extended fields to metadata and sync with admissions, sessions & ID cards
  try {
    if (madrasaId) {
      const meta = await getMadrasaMetadata(madrasaId);

      // 4a. Save extended student profile in metadata
      if (!meta.student_profiles) meta.student_profiles = {};
      const existingProfile = meta.student_profiles[id] || {};
      meta.student_profiles[id] = {
        ...existingProfile,
        student_id: id,
        first_name: firstName,
        last_name: lastName,
        roll_number: rollNumber,
        class_id: classId,
        class_name: className,
        gender: gender,
        residential_status: residentialStatus as any,
        is_boarding: isBoarding,
        boarding_type: boardingType as any,
        father_name: fatherName,
        mother_name: motherName,
        parent_phone: parentPhone,
        guardian_name: guardianName,
        guardian_relation: guardianRelation,
        emergency_contact: emergencyContact,
        blood_group: bloodGroup,
        date_of_birth: dateOfBirth,
        nid_or_birth_cert: nidOrBirthCert,
        previous_madrasa: previousMadrasa,
        room_no: roomNo,
        seat_no: seatNo,
        student_status: studentStatus as any,
        admission_fee: admissionFee !== undefined ? admissionFee : existingProfile.admission_fee,
        monthly_fee: monthlyFee !== undefined ? monthlyFee : existingProfile.monthly_fee,
        khoraki_fee: khorakiFee !== undefined ? khorakiFee : existingProfile.khoraki_fee,
        accommodation_fee: accommodationFee !== undefined ? accommodationFee : existingProfile.accommodation_fee,
        transport_fee: transportFee !== undefined ? transportFee : existingProfile.transport_fee,
        other_fee: otherFee !== undefined ? otherFee : existingProfile.other_fee,
        fee_discount: feeDiscount !== undefined ? feeDiscount : existingProfile.fee_discount,
        fee_discount_reason: feeDiscountReason !== undefined ? feeDiscountReason : existingProfile.fee_discount_reason,
        total_monthly_fee: totalMonthlyFee !== undefined ? totalMonthlyFee : existingProfile.total_monthly_fee,
        father_occupation: fatherOccupation || existingProfile.father_occupation,
        medical_notes: medicalNotes,
        remarks: remarks,
        address: address,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      };

      // 4b. Synchronize academic session enrollment (class, roll, status)
      const sessions = meta.sessions || getDefaultSessions(madrasaId);
      const currentSession = sessions.find((s: any) => s.is_current) || sessions[0];
      const enrollmentStatus = (
        studentStatus === "DROPOUT"
          ? "WITHDRAWN"
          : studentStatus === "GRADUATED"
          ? "GRADUATED"
          : "ACTIVE"
      ) as "ACTIVE" | "PROMOTED" | "REPEAT" | "TRANSFERRED" | "GRADUATED" | "WITHDRAWN";

      if (currentSession) {
        if (!meta.enrollments) meta.enrollments = [];
        const enrIdx = meta.enrollments.findIndex(
          (e: any) => e.student_id === id && (e.session_id === currentSession.id || e.status === "ACTIVE")
        );
        if (enrIdx >= 0) {
          meta.enrollments[enrIdx] = {
            ...meta.enrollments[enrIdx],
            class_id: classId,
            class_name: className,
            roll_number: rollNumber,
            status: enrollmentStatus,
          };
        } else {
          meta.enrollments.push({
            id: `enr_${id}_${currentSession.id}`,
            madrasa_id: madrasaId,
            student_id: id,
            session_id: currentSession.id,
            class_id: classId,
            class_name: className,
            roll_number: rollNumber,
            status: enrollmentStatus,
            enrollment_date: new Date().toISOString().split("T")[0],
            created_at: new Date().toISOString(),
          });
        }

        // Also update postgres student_enrollments table if present
        try {
          await adminClient
            .from("student_enrollments")
            .update({
              class_id: classId,
              roll_number: rollNumber,
              status: studentStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("student_id", id)
            .eq("session_id", currentSession.id);
        } catch {
          // Table might not exist or migration not run, safe to ignore
        }
      }

      // 4c. Sync with admission record if present
      if (meta.admissions && meta.admissions.length > 0) {
        meta.admissions = meta.admissions.map((a: any) => {
          if (a.confirmed_student_id === id) {
            return {
              ...a,
              first_name: firstName || a.first_name,
              last_name: lastName || a.last_name,
              residential_status: residentialStatus,
              mother_name: motherName || a.mother_name,
              father_name: fatherName || a.father_name,
              guardian_name: guardianName || a.guardian_name,
              guardian_phone: parentPhone || a.guardian_phone,
              birth_certificate_no: nidOrBirthCert || a.birth_certificate_no,
              emergency_contact: emergencyContact || a.emergency_contact,
              blood_group: bloodGroup || a.blood_group,
              photo_url: photoUrl || a.photo_url,
              address: address || a.address,
            };
          }
          return a;
        });
      }

      // 4d. Automatically synchronize active ID card snapshot and photo with updated profile
      if (meta.id_cards && meta.id_cards.length > 0) {
        meta.id_cards = meta.id_cards.map((c: any) => {
          if (c.student_id === id) {
            return {
              ...c,
              photo_url: photoUrl || c.photo_url,
              snapshot: {
                ...c.snapshot,
                student_name: `${firstName} ${lastName}`.trim(),
                roll_number: rollNumber || c.snapshot?.roll_number,
                class_name: className || c.snapshot?.class_name,
                blood_group: bloodGroup || c.snapshot?.blood_group,
                father_name: fatherName || c.snapshot?.father_name,
                parent_phone: parentPhone || c.snapshot?.parent_phone,
                address: address || c.snapshot?.address,
                photo_url: photoUrl || c.snapshot?.photo_url,
              },
            };
          }
          return c;
        });
      }

      await saveMadrasaMetadata(madrasaId, meta);
    }
  } catch (syncErr) {
    console.error("Error syncing student update with metadata:", syncErr);
  }

  try {
    const { recordActivityLog } = await import("@/app/actions/activity-logs");
    await recordActivityLog({
      action_type: "UPDATE",
      module: "STUDENTS",
      title: "শিক্ষার্থীর তথ্য হালনাগাদ",
      description: `${firstName} ${lastName || ""} (আইডি: ${id}) এর ব্যক্তিগত ও একাডেমিক তথ্য সফলভাবে হালনাগাদ করা হয়েছে।`,
      entity_id: id,
      entity_type: "student",
      link: `/dashboard/students/${id}`,
      severity: "INFO",
    });
  } catch (actErr) {
    console.warn("Activity log update error:", actErr);
  }

  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${id}`);
  revalidatePath(`/dashboard/students/${id}/edit`);
  revalidatePath("/dashboard/boarding/meals");
  revalidatePath("/dashboard/boarding/reports");
  revalidatePath("/dashboard/academic/id-cards");
  revalidatePath("/dashboard/academic/sessions");
  revalidatePath("/dashboard/students/promotion");
  return { success: true };
}

export async function deleteStudent(studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);

  if (error) {
    console.error("Error deleting student:", error);
    return { error: error.message };
  }

  try {
    const { recordActivityLog } = await import("@/app/actions/activity-logs");
    await recordActivityLog({
      action_type: "DELETE",
      module: "STUDENTS",
      title: "শিক্ষার্থীর প্রোফাইল মুছে ফেলা হয়েছে",
      description: `শিক্ষার্থী আইডি (${studentId}) এর রেকর্ড সিস্টেম থেকে অপসারণ করা হয়েছে।`,
      entity_id: studentId,
      entity_type: "student",
      severity: "WARNING",
    });
  } catch (actErr) {
    console.warn("Activity log delete error:", actErr);
  }

  revalidatePath("/dashboard/students");
  return { success: true };
}
