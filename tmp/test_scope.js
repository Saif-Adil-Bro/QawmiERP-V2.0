const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require("./node_modules/@supabase/supabase-js");
const supabase = createClient(url, key);

async function testFix() {
  const { data: userProfile } = await supabase.from("users").select("*").eq("email", "student@test.com").single();
  console.log("User:", userProfile);
  const madrasaId = userProfile.madrasa_id;

  const { data: students } = await supabase.from("students").select("*").eq("madrasa_id", madrasaId);
  console.log("Total students in madrasa:", students.length);

  const studentIdsSet = new Set();
  
  // A. Direct student_id
  if (userProfile?.student_id) studentIdsSet.add(userProfile.student_id);

  // B. Phone match
  const userPhone = userProfile?.phone;
  if (userPhone) {
    const cleanPhone = userPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length >= 6) {
      students.forEach(s => {
        if (s.parent_phone) {
          const spClean = s.parent_phone.replace(/[^0-9]/g, "");
          if (spClean.endsWith(cleanPhone) || cleanPhone.endsWith(spClean)) {
            studentIdsSet.add(s.id);
          }
        }
      });
    }
  }

  // C. Full name match ("আসাদ's Parent")
  if (studentIdsSet.size === 0 && userProfile?.full_name) {
    const parentName = userProfile.full_name.trim();
    const matchChild = parentName.match(/^(.+?)(?:'s|\s+এর|\s+এর\s+অভিভাবক|\s+Parent)/i);
    const childName = matchChild ? matchChild[1].trim() : null;
    console.log("Extracted childName:", childName);

    if (childName && childName.length >= 2) {
      students.forEach(s => {
        const fName = (s.first_name || "").trim();
        const lName = (s.last_name || "").trim();
        const fullName = `${fName} ${lName}`.trim();
        if (
          fullName.toLowerCase() === childName.toLowerCase() ||
          fName.toLowerCase() === childName.toLowerCase() ||
          lName.toLowerCase() === childName.toLowerCase() ||
          fullName.toLowerCase().startsWith(childName.toLowerCase())
        ) {
          console.log("Matched student:", s.id, fullName);
          studentIdsSet.add(s.id);
        }
      });
    }
  }

  // D. Father name match
  if (studentIdsSet.size === 0 && userProfile?.full_name) {
    students.forEach(s => {
      if (s.father_name && s.father_name.trim()) {
        const fn = s.father_name.trim().toLowerCase();
        const pn = userProfile.full_name.trim().toLowerCase();
        if (fn.includes(pn) || pn.includes(fn)) {
          studentIdsSet.add(s.id);
        }
      }
    });
  }

  console.log("Final allowed student IDs for student@test.com:", Array.from(studentIdsSet));
  const matchedStudents = students.filter(s => studentIdsSet.has(s.id));
  console.log("Matched students list:", matchedStudents.map(s => ({ id: s.id, name: `${s.first_name} ${s.last_name}` })));
}
testFix();
