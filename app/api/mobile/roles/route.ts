import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { readJsonStore, writeJsonStore } from "@/lib/madrasa-store";
import { DEFAULT_SYSTEM_ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "roles",
    requireWrite: false,
  });
  if (!auth.ok) return auth.response;

  const store = await readJsonStore(auth.ctx.madrasaId, "security");
  const customRoles = Array.isArray(store.custom_roles) ? store.custom_roles : [];

  return mobileSuccess(
    {
      system_roles: DEFAULT_SYSTEM_ROLES,
      custom_roles: customRoles,
      all_roles: [...DEFAULT_SYSTEM_ROLES, ...customRoles],
    },
    "Success",
    undefined,
    200,
    req
  );
}

export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "roles",
    requireWrite: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body?.name) {
      return mobileError("রোলের নাম আবশ্যক।", 400, "VALIDATION_ERROR");
    }

    const store = await readJsonStore(auth.ctx.madrasaId, "security");
    const customRoles = Array.isArray(store.custom_roles) ? store.custom_roles : [];
    const newRole = {
      id: body.id || `role_${Date.now()}`,
      ...body,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
    store.custom_roles = [newRole, ...customRoles];
    await writeJsonStore(auth.ctx.madrasaId, "security", store);

    return mobileSuccess(newRole, "রোল তৈরি হয়েছে।", undefined, 201, req);
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
