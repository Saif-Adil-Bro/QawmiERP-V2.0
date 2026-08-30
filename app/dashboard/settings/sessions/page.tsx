import { redirect } from "next/navigation";

export default function SettingsSessionsRedirectPage() {
  redirect("/dashboard/academic/sessions");
}
