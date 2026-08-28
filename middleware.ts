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
              supabaseResponse.cookies.set(name, value, {
                ...options,
                sameSite: "none",
                secure: true,
                partitioned: true,
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
