import { createClient } from "@/lib/supabase/server";
import KitabEntryClient from "./KitabEntryClient";

export const dynamic = "force-dynamic";

export default async function TeacherPortalKitab(props: {
  searchParams?: Promise<{ class_id?: string; date?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id, full_name")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, first_name, last_name")
    .eq("madrasa_id", madrasaId)
    .or(`email.eq.${user.email},phone.eq.${userData?.full_name || ""}`)
    .maybeSingle();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("madrasa_id", madrasaId)
    .order("name", { ascending: true });

  const currentClassId = params.class_id || classes?.[0]?.id || "";
  const currentDate = params.date || new Date().toISOString().split("T")[0];

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id")
    .eq("madrasa_id", madrasaId)
    .eq("class_id", currentClassId)
    .order("roll_number", { ascending: true });

  const { data: existingLogs } = await supabase
    .from("kitab_logs")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .eq("date", currentDate);

  return (
    <KitabEntryClient
      classes={classes || []}
      students={students || []}
      existingLogs={existingLogs || []}
      currentClassId={currentClassId}
      currentDate={currentDate}
      teacherId={teacher?.id}
      madrasaId={madrasaId}
    />
  );
}
