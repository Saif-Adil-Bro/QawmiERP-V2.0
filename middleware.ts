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

  // Next.js marks client-side soft-navigations (Link clicks / prefetches
  // that fetch just the RSC payload, not a full document) with this header.
  // supabase.auth.getUser() makes a real network round-trip to Supabase's
  // auth server on every call — doing that on EVERY in-app click, on top of
  // an already-slow mobile connection, made in-page navigation links feel
  // broken (the click fires, but the RSC fetch is stuck waiting on this
  // round-trip, so nothing visibly happens until our own loading-bar
  // safety-timeout hides it).
  //
  // The full-document request for the very first page load (or a hard
  // refresh) does NOT carry this header, so that request still goes
  // through the full getUser() check below and unauthenticated users are
  // still redirected to /login. This only skips the *redundant* re-check
  // on soft navigations within an already-loaded session; individual
  // server actions/pages still do their own auth checks for data access.
  const isSoftNavigation = request.headers.get("RSC") === "1";

  if (isSoftNavigation && !isApiRoute) {
    return supabaseResponse;
  }

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
              supabaseResponse.cookies.set(name, value, {
                ...options,
                path: options?.path ?? "/",
                sameSite: "lax",
                secure: true,
                maxAge: options?.maxAge ?? 60 * 60 * 24 * 30, // 30 days persistent cookie
              });
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Only clear cookies if refresh token is explicitly missing/invalid (400 or 401)
      if (error.status === 400 || error.status === 401 || error.code === 'refresh_token_not_found') {
        request.cookies.getAll().forEach(c => {
          if (c.name.includes("sb-") || c.name.includes("auth-token")) {
            supabaseResponse.cookies.set(c.name, "", { maxAge: 0, path: "/" });
          }
        });
      }
      user = null;
    } else {
      user = data?.user || null;
    }
  } catch (error) {
    console.warn("Middleware Supabase auth validation warning:", error);
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
    const userRole = user.user_metadata?.role;
    let targetPath = '/dashboard';
    if (userRole === 'teacher' || userRole === 'hifz_teacher' || userRole === 'ustad') {
      targetPath = '/teacher-portal';
    } else if (userRole === 'parent' || userRole === 'guardian' || userRole === 'student') {
      targetPath = '/portal';
    }

    const url = request.nextUrl.clone();
    url.pathname = targetPath;
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
