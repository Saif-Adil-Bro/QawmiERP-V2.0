import React from "react";
import { getWidgetsForManagerAction } from "@/app/actions/widgets";
import WidgetsManagerClient from "./WidgetsManagerClient";

export const dynamic = "force-dynamic";

export default async function WidgetsSettingsPage() {
  const { widgets, canManage, error } = await getWidgetsForManagerAction();

  return (
    <WidgetsManagerClient
      initialWidgets={widgets}
      canManage={canManage}
      initialError={error}
    />
  );
}
