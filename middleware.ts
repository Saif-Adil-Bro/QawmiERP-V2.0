import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname === "/";
  const isApiRoute = pathname.startsWith("/api");

  let user = null;

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, {
                ...options,
                path: options?.path ?? "/",
                sameSite: options?.sameSite ?? "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: options?.maxAge ?? 60 * 60 * 24 * 30, // 30 days
              });
            });
          },
        },
      }
    );

    // Using getUser() directly is the official Supabase SSR recommendation.
    // Wrap carefully to catch any AuthApiError (such as Invalid Refresh Token)
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      user = null;
      // If the refresh token is invalid or expired, clear stale Supabase auth cookies
      if (
        error.name === "AuthApiError" ||
        error.message?.toLowerCase().includes("refresh token") ||
        (error as any)?.__isAuthError
      ) {
        const allCookies = request.cookies.getAll();
        allCookies.forEach((c) => {
          if (c.name.startsWith("sb-") || c.name.includes("auth-token")) {
            request.cookies.delete(c.name);
            supabaseResponse.cookies.delete(c.name);
          }
        });
      }
    } else {
      user = data?.user || null;
    }
  } catch (error) {
    user = null;
  }

  // If not logged in and trying to access dashboard/protected routes
  if (!user && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    
    const setCookies = supabaseResponse.headers.getSetCookie();
    for (const cookie of setCookies) {
      redirectResponse.headers.append("set-cookie", cookie);
    }
    return redirectResponse;
  }

  // If already logged in and visiting login page
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const redirectResponse = NextResponse.redirect(url);
    
    const setCookies = supabaseResponse.headers.getSetCookie();
    for (const cookie of setCookies) {
      redirectResponse.headers.append("set-cookie", cookie);
    }
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
