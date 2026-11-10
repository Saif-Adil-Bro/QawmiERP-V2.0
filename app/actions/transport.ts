"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getStudents } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import {
  TransportVehicle,
  StudentTransportAssignment,
} from "@/lib/transport-utils";

export async function getTransportOverview(): Promise<{
  vehicles: TransportVehicle[];
  assignments: StudentTransportAssignment[];
  allStudents: any[];
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
  const allStudents = await getStudents();

  if (!madrasaId) {
    return { vehicles: [], assignments: [], allStudents: allStudents || [] };
  }

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    let vehicles: TransportVehicle[] = (meta as any).transport_vehicles || [];
    let assignments: StudentTransportAssignment[] = (meta as any).transport_assignments || [];

    // Default Seed if none exist
    if (vehicles.length === 0) {
      vehicles = [
        {
          id: `veh-seed-1`,
          vehicleNo: "মাদ্রাসা ভ্যান ১",
          vehicleType: "VAN",
          routeName: "প্রধান গেট - বাজার - হাউজিং রুট",
          stops: ["হাউজিং মোড়", "সেন্ট্রাল মসজিদ", "শান্তিনগর", "মাদ্রাসা গেট"],
          driverName: "মোঃ রফিক মিয়া",
          driverPhone: "01711223344",
          capacity: 14,
          defaultMonthlyFee: 800,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];
      (meta as any).transport_vehicles = vehicles;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    return {
      vehicles,
      assignments,
      allStudents: allStudents || [],
    };
  } catch (err) {
    console.error("getTransportOverview error:", err);
    return { vehicles: [], assignments: [], allStudents: allStudents || [] };
  }
}

export async function saveTransportVehicle(
  vehicle: Partial<TransportVehicle>
): Promise<{ success: boolean; data?: TransportVehicle; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    let vehicles: TransportVehicle[] = (meta as any).transport_vehicles || [];

    let savedVehicle: TransportVehicle;

    if (vehicle.id) {
      const idx = vehicles.findIndex((v) => v.id === vehicle.id);
      if (idx === -1) return { success: false, error: "গাড়ি পাওয়া যায়নি" };
      savedVehicle = {
        ...vehicles[idx],
        ...vehicle,
        updatedAt: new Date().toISOString(),
      } as TransportVehicle;
      vehicles[idx] = savedVehicle;
    } else {
      savedVehicle = {
        id: `veh-${Date.now()}`,
        vehicleNo: vehicle.vehicleNo || "নতুন গাড়ি",
        vehicleType: vehicle.vehicleType || "VAN",
        routeName: vehicle.routeName || "সাধারণ রুট",
        stops: vehicle.stops || [],
        driverName: vehicle.driverName || "ড্রাইভার",
        driverPhone: vehicle.driverPhone || "",
        assistantName: vehicle.assistantName,
        assistantPhone: vehicle.assistantPhone,
        capacity: Number(vehicle.capacity) || 12,
        defaultMonthlyFee: Number(vehicle.defaultMonthlyFee) || 800,
        isActive: vehicle.isActive ?? true,
        notes: vehicle.notes,
        createdAt: new Date().toISOString(),
      };
      vehicles.unshift(savedVehicle);
    }

    (meta as any).transport_vehicles = vehicles;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/transport");
    return { success: true, data: savedVehicle };
  } catch (err: any) {
    console.error("saveTransportVehicle error:", err);
    return { success: false, error: err?.message || "সংরক্ষণ করা যায়নি" };
  }
}

export async function deleteTransportVehicle(
  vehicleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    let vehicles: TransportVehicle[] = (meta as any).transport_vehicles || [];
    vehicles = vehicles.filter((v) => v.id !== vehicleId);
    (meta as any).transport_vehicles = vehicles;

    // Clear assignments referencing this vehicle
    let assignments: StudentTransportAssignment[] = (meta as any).transport_assignments || [];
    assignments = assignments.filter((a) => a.vehicleId !== vehicleId);
    (meta as any).transport_assignments = assignments;

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/transport");
    return { success: true };
  } catch (err: any) {
    console.error("deleteTransportVehicle error:", err);
    return { success: false, error: err?.message || "মুছে ফেলা যায়নি" };
  }
}

export async function assignStudentToVehicle(data: {
  studentId: string;
  studentName: string;
  studentRoll?: string;
  className: string;
  vehicleId: string;
  pickupStop: string;
  monthlyFee?: number;
  parentPhone?: string;
}): Promise<{ success: boolean; data?: StudentTransportAssignment; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    const vehicles: TransportVehicle[] = (meta as any).transport_vehicles || [];
    const targetVeh = vehicles.find((v) => v.id === data.vehicleId);
    if (!targetVeh) return { success: false, error: "গাড়ি পাওয়া যায়নি" };

    let assignments: StudentTransportAssignment[] = (meta as any).transport_assignments || [];

    // Remove old assignment if already assigned
    assignments = assignments.filter((a) => a.studentId !== data.studentId);

    const fee = data.monthlyFee !== undefined ? Number(data.monthlyFee) : targetVeh.defaultMonthlyFee;

    const newAssignment: StudentTransportAssignment = {
      studentId: data.studentId,
      studentName: data.studentName,
      studentRoll: data.studentRoll,
      className: data.className,
      vehicleId: targetVeh.id,
      vehicleNo: targetVeh.vehicleNo,
      routeName: targetVeh.routeName,
      pickupStop: data.pickupStop,
      monthlyFee: fee,
      parentPhone: data.parentPhone,
      assignedAt: new Date().toISOString(),
    };

    assignments.unshift(newAssignment);
    (meta as any).transport_assignments = assignments;

    // Automatically sync student transport_fee in student metadata!
    if (!(meta as any).student_profiles) (meta as any).student_profiles = {};
    if (!(meta as any).student_profiles[data.studentId]) {
      (meta as any).student_profiles[data.studentId] = {};
    }
    (meta as any).student_profiles[data.studentId].transport_fee = fee;

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/transport");
    revalidatePath(`/dashboard/students/${data.studentId}`);
    return { success: true, data: newAssignment };
  } catch (err: any) {
    console.error("assignStudentToVehicle error:", err);
    return { success: false, error: err?.message || "বরাদ্দ করা যায়নি" };
  }
}

export async function removeStudentFromVehicle(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    let assignments: StudentTransportAssignment[] = (meta as any).transport_assignments || [];
    assignments = assignments.filter((a) => a.studentId !== studentId);
    (meta as any).transport_assignments = assignments;

    if ((meta as any).student_profiles?.[studentId]) {
      (meta as any).student_profiles[studentId].transport_fee = 0;
    }

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/transport");
    revalidatePath(`/dashboard/students/${studentId}`);
    return { success: true };
  } catch (err: any) {
    console.error("removeStudentFromVehicle error:", err);
    return { success: false, error: err?.message || "বাদ দেওয়া যায়নি" };
  }
}
