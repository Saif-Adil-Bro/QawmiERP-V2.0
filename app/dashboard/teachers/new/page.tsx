import { redirect } from "next/navigation";

export default function NewTeacherPage() {
  redirect("/dashboard/staff?action=new");
}
