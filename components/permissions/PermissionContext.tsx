"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  EffectivePermissionSummary,
  UserSecurityProfile,
  RoleDefinition,
  DEFAULT_SYSTEM_ROLES,
  calculateEffectivePermissions,
  canUserAccessRecord,
  AccessCheckContext,
} from "@/lib/permissions";
import { getCurrentUserPermissions } from "@/app/actions/permissions";

interface PermissionContextType {
  summary: EffectivePermissionSummary | null;
  profile: UserSecurityProfile | null;
  allRoles: RoleDefinition[];
  loading: boolean;
  refreshPermissions: () => Promise<void>;
  hasPermission: (permissionId: string) => boolean;
  hasAnyPermission: (permissionIds: string[]) => boolean;
  hasAllPermissions: (permissionIds: string[]) => boolean;
  canAccess: (permissionId: string, context?: AccessCheckContext) => boolean;
}

const PermissionContext = createContext<PermissionContextType>({
  summary: null,
  profile: null,
  allRoles: DEFAULT_SYSTEM_ROLES,
  loading: true,
  refreshPermissions: async () => {},
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  canAccess: () => false,
});

export function PermissionProvider({
  children,
  initialSummary = null,
  initialProfile = null,
  initialRoles = DEFAULT_SYSTEM_ROLES,
}: {
  children: React.ReactNode;
  initialSummary?: EffectivePermissionSummary | null;
  initialProfile?: UserSecurityProfile | null;
  initialRoles?: RoleDefinition[];
}) {
  const [summary, setSummary] = useState<EffectivePermissionSummary | null>(initialSummary);
  const [profile, setProfile] = useState<UserSecurityProfile | null>(initialProfile);
  const [allRoles, setAllRoles] = useState<RoleDefinition[]>(initialRoles);
  const [loading, setLoading] = useState(!initialSummary);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await getCurrentUserPermissions();
      if (res.summary && res.profile) {
        setSummary(res.summary);
        setProfile(res.profile);
        setAllRoles(res.allRoles || DEFAULT_SYSTEM_ROLES);
      }
    } catch (err) {
      console.error("Error loading permissions context:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialSummary) {
      fetchPermissions();
    }
  }, []);

  const hasPermission = (permissionId: string): boolean => {
    if (!summary) return false;
    if (summary.status === "SUSPENDED" || summary.status === "DISABLED") return false;
    if (summary.roles.includes("super_admin")) return true;
    return summary.effectivePermissions.includes(permissionId);
  };

  const hasAnyPermission = (permissionIds: string[]): boolean => {
    if (!summary) return false;
    if (summary.status === "SUSPENDED" || summary.status === "DISABLED") return false;
    if (summary.roles.includes("super_admin")) return true;
    return permissionIds.some((p) => summary.effectivePermissions.includes(p));
  };

  const hasAllPermissions = (permissionIds: string[]): boolean => {
    if (!summary) return false;
    if (summary.status === "SUSPENDED" || summary.status === "DISABLED") return false;
    if (summary.roles.includes("super_admin")) return true;
    return permissionIds.every((p) => summary.effectivePermissions.includes(p));
  };

  const canAccess = (permissionId: string, context?: AccessCheckContext): boolean => {
    if (!summary || !profile) return false;
    if (summary.status === "SUSPENDED" || summary.status === "DISABLED") return false;
    return canUserAccessRecord(summary, profile, permissionId, context);
  };

  return (
    <PermissionContext.Provider
      value={{
        summary,
        profile,
        allRoles,
        loading,
        refreshPermissions: fetchPermissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        canAccess,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
