import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { readJsonStore, writeJsonStore } from "@/lib/madrasa-store";

export const dynamic = "force-dynamic";

async function resolveUserAndMadrasa(req: NextRequest): Promise<{
  userId: string;
  madrasaId: string;
} | null> {
  const adminClient = await createAdminClient();
  let user = await getAuthUser();

  if (!user) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const { data } = await adminClient.auth.getUser(token);
        if (data?.user) {
          user = data.user;
        }
      }
    }
  }

  if (!user) return null;

  let madrasaId =
    typeof user.user_metadata?.madrasa_id === "string"
      ? user.user_metadata.madrasa_id
      : "";

  if (!madrasaId) {
    const { data: userRow } = await adminClient
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();
    if (userRow?.madrasa_id) {
      madrasaId = userRow.madrasa_id;
    }
  }

  if (!madrasaId) return null;
  return { userId: user.id, madrasaId };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveUserAndMadrasa(req);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const meta = await readJsonStore(ctx.madrasaId, "meta");
    const prefs = meta?.user_menu_preferences?.[ctx.userId] || null;

    return NextResponse.json({ success: true, preferences: prefs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load preferences" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveUserAndMadrasa(req);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const meta = await readJsonStore(ctx.madrasaId, "meta");
    const allPrefs =
      meta.user_menu_preferences && typeof meta.user_menu_preferences === "object"
        ? { ...meta.user_menu_preferences }
        : {};

    const existing = allPrefs[ctx.userId] || {};
    const nextPrefs = {
      ...existing,
      ...(body.mode === "basic" || body.mode === "advanced" ? { mode: body.mode } : {}),
      ...(body.pinnedTileIds !== undefined ? { pinnedTileIds: body.pinnedTileIds } : {}),
      ...(body.customNavGroups !== undefined ? { customNavGroups: body.customNavGroups } : {}),
      updatedAt: typeof body.updatedAt === "number" ? body.updatedAt : Date.now(),
    };

    allPrefs[ctx.userId] = nextPrefs;
    meta.user_menu_preferences = allPrefs;

    const ok = await writeJsonStore(ctx.madrasaId, "meta", meta);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Failed to persist preferences" }, { status: 500 });
    }

    return NextResponse.json({ success: true, preferences: nextPrefs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save preferences" },
      { status: 500 }
    );
  }
}
