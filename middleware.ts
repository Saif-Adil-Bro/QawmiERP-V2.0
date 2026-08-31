import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    // If keys are missing, pass through
    return supabaseResponse;
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname === '/';
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

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
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
            });
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              // NOTE: sameSite:"none" + partitioned:true was needed for a
              // cross-site iframe preview (e.g. an AI agent's simulator that
              // embeds the app inside its own domain). On a normal, directly
              // accessed deployment (Render/Railway/production domain), that
              // combination is unnecessary and unreliable across browsers —
              // it can cause the auth cookie to silently fail to persist,
              // making the user appear logged out and auth-dependent server
              // actions fail. "lax" is the standard, robust choice for a
              // top-level site with redirect-based login.
              supabaseResponse.cookies.set(name, value, {
                ...options,
                sameSite: "lax",
                secure: true,
              });
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // If refresh token is invalid/expired, clear stale auth cookies to avoid error loops
      request.cookies.getAll().forEach(c => {
        if (c.name.includes("sb-") || c.name.includes("auth-token")) {
          supabaseResponse.cookies.set(c.name, "", { maxAge: 0, path: "/" });
        }
      });
      user = null;
    } else {
      user = data?.user || null;
    }
  } catch (error) {
    // Safe fallback on AuthApiError
    console.warn("Middleware Supabase auth validation:", error);
    request.cookies.getAll().forEach(c => {
      if (c.name.includes("sb-") || c.name.includes("auth-token")) {
        supabaseResponse.cookies.set(c.name, "", { maxAge: 0, path: "/" });
      }
    });
    user = null;
  }

  if (!user && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    
    const setCookies = supabaseResponse.headers.getSetCookie();
    for (const cookie of setCookies) {
      redirectResponse.headers.append('set-cookie', cookie);
    }
    return redirectResponse;
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    
    const setCookies = supabaseResponse.headers.getSetCookie();
    for (const cookie of setCookies) {
      redirectResponse.headers.append('set-cookie', cookie);
    }
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
