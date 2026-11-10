/**
 * Madrasa Transport, Van & Route Fleet Management Data Models
 * Links seamlessly with student.transport_fee without altering DB tables
 */

export interface TransportVehicle {
  id: string;
  vehicleNo: string; // e.g. "ঢাকা মেট্রো-চ ১১-২২৩৩" বা "মাদ্রাসা ভ্যান ১"
  vehicleType: "VAN" | "MICROBUS" | "BUS" | "AUTO";
  routeName: string; // e.g. "উত্তরা - এয়ারপোর্ট - খিলক্ষেত রুট"
  stops: string[]; // e.g. ["উত্তরা ৭", "এয়ারপোর্ট", "কাওলা", "খিলক্ষেত"]
  driverName: string;
  driverPhone: string;
  assistantName?: string;
  assistantPhone?: string;
  capacity: number; // e.g. 15
  defaultMonthlyFee: number; // e.g. 1000
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentTransportAssignment {
  studentId: string;
  studentName: string;
  studentRoll?: string;
  className: string;
  vehicleId: string;
  vehicleNo: string;
  routeName: string;
  pickupStop: string;
  monthlyFee: number;
  parentPhone?: string;
  assignedAt: string;
}

export const DEFAULT_VEHICLE_TYPES: Record<string, string> = {
  VAN: "মাদ্রাসা ভ্যান",
  MICROBUS: "মাইক্রোবাস / হায়েস",
  BUS: "মিনিবাস",
  AUTO: "ইজিবাইক / অটোরিকশা",
};
