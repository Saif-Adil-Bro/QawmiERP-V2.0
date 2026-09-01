"use client";

import React from "react";
import { usePermissions } from "./PermissionContext";
import AccessDeniedMessage from "./AccessDeniedMessage";
import { AccessCheckContext } from "@/lib/permissions";

interface PermissionGuardProps {
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  context?: AccessCheckContext;
  fallback?: React.ReactNode;
  hideFallback?: boolean; // When true, renders null instead of AccessDenied message
  children: React.ReactNode;
}

export default function PermissionGuard({
  permission,
  anyPermissions,
  allPermissions,
  context,
  fallback,
  hideFallback = false,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, canAccess, loading } = usePermissions();

  if (loading) {
    return (
      <div className="animate-pulse p-4 rounded-xl bg-slate-100/70 border border-slate-200/60 min-h-[60px]" />
    );
  }

  let isAllowed = true;

  if (permission) {
    isAllowed = context ? canAccess(permission, context) : hasPermission(permission);
  } else if (anyPermissions && anyPermissions.length > 0) {
    isAllowed = hasAnyPermission(anyPermissions);
  } else if (allPermissions && allPermissions.length > 0) {
    isAllowed = hasAllPermissions(allPermissions);
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  if (hideFallback) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <AccessDeniedMessage requiredPermission={permission || anyPermissions?.[0]} />;
}
