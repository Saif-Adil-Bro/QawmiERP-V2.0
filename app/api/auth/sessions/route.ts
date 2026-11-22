import { privateResponseHeaders } from "@/lib/private-response";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getWebAppSession } from "@/lib/supabase/server";
import { loadServerPermissions } from "@/lib/permissions-server";
import {
  listUserSessions,
  mayManageTenantSessions,
  revokeUserSession,
  revokeOtherSessions,
  revokeAllUserSessions,
} from "@/lib/session-manager";

async function resolveSessionActor() {
  let verified;
  try {
    verified = await getWebAppSession();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Session registry unavailable" },
        { status: 503 },
      ),
    };
  }
  if (!verified) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { user: authUser, session } = verified;
  const admin = await createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id, madrasa_id, full_name, email, role")
    .eq("id", authUser.id)
    .eq("madrasa_id", session.madrasa_id)
    .maybeSingle();

  const madrasaId = String((userRow as any)?.madrasa_id || "");
  if (!madrasaId) {
    return {
      error: NextResponse.json({ error: "No madrasa linked" }, { status: 403 }),
    };
  }

  const permCtx = await loadServerPermissions(authUser.id, madrasaId);
  if (permCtx?.status !== "ACTIVE") {
    return {
      error: NextResponse.json({ error: "Account disabled" }, { status: 403 }),
    };
  }

  const canManageAll = mayManageTenantSessions(permCtx);

  return {
    actor: {
      userId: authUser.id,
      currentSessionId: session.id,
      madrasaId,
      actorName: (userRow as any)?.full_name || authUser.email || "User",
      actorEmail: (userRow as any)?.email || authUser.email || "",
      actorRole: permCtx.role,
      canManageAll,
    },
  };
}

export async function GET(req: NextRequest) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { actor } = resolved;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "self";
  const targetUserId = searchParams.get("userId") || undefined;
  const includeRevoked = searchParams.get("includeRevoked") === "true";

  const filterUserId =
    actor.canManageAll && scope === "madrasa"
      ? targetUserId
      : actor.canManageAll && targetUserId
        ? targetUserId
        : actor.userId;

  const { sessions, storage } = await listUserSessions({
    madrasaId: actor.madrasaId,
    userId: filterUserId,
    includeRevoked,
    limit: 150,
  });

  const { currentSessionId } = actor;

  return NextResponse.json(
    {
      sessions,
      storage,
      currentSessionId,
      canManageAll: actor.canManageAll,
    },
    { headers: privateResponseHeaders },
  );
}

export async function POST(req: NextRequest) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { actor } = resolved;

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const rawAction = body?.action;
  if (rawAction !== undefined && typeof rawAction !== "string") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
  const action = rawAction === undefined ? "terminate_single" : rawAction;
  const { currentSessionId } = actor;

  if (action === "terminate_others") {
    const res = await revokeOtherSessions({
      madrasaId: actor.madrasaId,
      userId: actor.userId,
      currentSessionId,
      revokedBy: actor.userId,
      actorName: actor.actorName,
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      reason: "USER_TERMINATE_OTHER_SESSIONS",
    });
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  }

  if (action === "terminate_all_for_user") {
    const targetUserId = String(body.userId || actor.userId);
    if (targetUserId !== actor.userId && !actor.canManageAll) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const res = await revokeAllUserSessions({
      madrasaId: actor.madrasaId,
      targetUserId,
      revokedBy: actor.userId,
      actorName: actor.actorName,
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      reason: String(body.reason || "ADMIN_REVOKE_ALL_SESSIONS"),
    });
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  }

  if (action !== "terminate_single") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  // Default: terminate_single
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }

  const res = await revokeUserSession({
    sessionId,
    ownerUserId: actor.canManageAll ? undefined : actor.userId,
    madrasaId: actor.madrasaId,
    revokedBy: actor.userId,
    actorName: actor.actorName,
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    reason: String(body.reason || "REMOTE_TERMINATED"),
  });

  if (res.notFound && !actor.canManageAll)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(res, {
    status: res.success ? 200 : res.notFound ? 404 : 400,
  });
}

export async function DELETE(req: NextRequest) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { actor } = resolved;

  const { searchParams } = new URL(req.url);
  const sessionId = (searchParams.get("sessionId") || "").trim();
  const rawMode = searchParams.get("mode");
  const mode = rawMode === null ? "single" : rawMode;
  const { currentSessionId } = actor;

  if (mode === "others") {
    const res = await revokeOtherSessions({
      madrasaId: actor.madrasaId,
      userId: actor.userId,
      currentSessionId,
      revokedBy: actor.userId,
      actorName: actor.actorName,
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
    });
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  }

  if (mode !== "single") {
    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId query parameter is required" },
      { status: 400 },
    );
  }

  const res = await revokeUserSession({
    sessionId,
    ownerUserId: actor.canManageAll ? undefined : actor.userId,
    madrasaId: actor.madrasaId,
    revokedBy: actor.userId,
    actorName: actor.actorName,
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    reason: "REMOTE_TERMINATED",
  });

  if (res.notFound && !actor.canManageAll)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(res, {
    status: res.success ? 200 : res.notFound ? 404 : 400,
  });
}
