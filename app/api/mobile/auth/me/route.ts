import { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileSuccess,
} from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  return mobileSuccess(
    {
      user: {
        id: auth.ctx.userId,
        email: auth.ctx.email,
        full_name:
          auth.ctx.userRow?.full_name ||
          auth.ctx.user?.user_metadata?.full_name ||
          "",
        phone:
          auth.ctx.userRow?.phone || auth.ctx.user?.user_metadata?.phone || null,
        role: auth.ctx.role,
        roles: auth.ctx.roles,
        permissions: auth.ctx.permissions,
        is_portal_user: auth.ctx.isPortalUser,
        madrasa_id: auth.ctx.madrasaId,
      },
      madrasa: auth.ctx.userRow?.madrasas || null,
    },
    "Authenticated",
    undefined,
    200,
    req
  );
}
