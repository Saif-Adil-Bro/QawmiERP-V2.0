import { getTeachersForClassAssignment } from "@/app/actions/classes";
import NewClassClient from "./NewClassClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewClassPage() {
  const teachers = await getTeachersForClassAssignment();

  return <NewClassClient availableTeachers={teachers || []} />;
}
