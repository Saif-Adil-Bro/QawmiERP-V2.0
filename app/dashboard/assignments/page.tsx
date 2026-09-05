import { getAssignments } from "@/app/actions/assignments";
import AssignmentsClient from "./AssignmentsClient";

export const dynamic = "force-dynamic";

export default async function AssignmentsDashboard() {
  const { assignments, classes } = await getAssignments();

  return (
    <AssignmentsClient
      initialAssignments={assignments}
      classes={classes}
    />
  );
}
