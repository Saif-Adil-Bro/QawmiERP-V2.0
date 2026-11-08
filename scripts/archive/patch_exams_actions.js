const fs = require('fs');
let code = fs.readFileSync('app/actions/exams.ts', 'utf8');

const newFunctions = `
export async function getExamSubjects(examId: string, classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_subjects")
    .select("*")
    .eq("exam_id", examId)
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching exam subjects:", error);
    return [];
  }
  return data;
}

export async function saveExamSubjects(examId: string, classId: string, subjectsData: any[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  await supabase
    .from("exam_subjects")
    .delete()
    .eq("exam_id", examId)
    .eq("class_id", classId);

  const recordsToInsert = subjectsData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    class_id: classId,
    subject_name: record.subject_name,
    total_marks: record.total_marks,
    pass_marks: record.pass_marks,
    exam_type: record.exam_type
  }));

  if (recordsToInsert.length > 0) {
    const { error } = await supabase
      .from("exam_subjects")
      .insert(recordsToInsert);

    if (error) {
      console.error("Error saving exam subjects:", error);
      return { error: error.message };
    }
  }

  return { success: true };
}
`;

code += newFunctions;
fs.writeFileSync('app/actions/exams.ts', code);
console.log('patched actions');
