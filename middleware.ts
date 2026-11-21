import { currentAppSession } from "./lib/current-app-session";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * কোনো path নির্দিষ্ট prefix-এর নিজে অথবা তার child কি না।
 *
 * ⛔ L-1 ফিক্স: আগে পাবলিক রুট বোঝাতে সবখানে `startsWith` ব্যবহার করা হতো — ফলে
 * ভবিষ্যতে `/portal-something` বা `/payroll` নামের রুট যোগ করলেই সেটি চুপচাপ পাবলিক
 * হয়ে যেত (অর্থাৎ বিনা লগইনে অ্যাক্সেসযোগ্য)। এখন `=== prefix` অথবা `prefix + "/"`
 * — অর্থাৎ কেবল রুটটি নিজে বা তার প্রকৃত সাব-রুট পাবলিক।
 */
function isSameOrChildPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const PUBLIC_ROUTE_PREFIXES = [
  "/admission",
  "/verify",
  "/pay",
  "/donate",
  "/portal",
  "/fonts",
  "/login",
  "/signup",
  "/register",
  "/auth",
];

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

  const pathname = request.nextUrl.pathname;

  // Redirect any legacy /portal/donate links directly to standalone /donate page
  if (isSameOrChildPath(pathname, "/portal/donate")) {
    const url = request.nextUrl.clone();
    url.pathname = "/donate";
    return NextResponse.redirect(url);
  }

  const isAuthRoute =
    isSameOrChildPath(pathname, "/login") ||
    isSameOrChildPath(pathname, "/signup") ||
    isSameOrChildPath(pathname, "/register") ||
    pathname === "/";
  const isApiRoute = isSameOrChildPath(pathname, "/api");
  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    isSameOrChildPath(pathname, prefix)
  );

  // Next.js marks client-side soft-navigations (Link clicks / prefetches that
  // fetch just the RSC payload instead of a full document) with this header.
  //
  // ⛔ HI-7(খ) ফিক্স: আগে ক্লায়েন্ট-নিয়ন্ত্রিত `RSC: 1` হেডার দেখলেই middleware
  // **সব** auth চেক এড়িয়ে যেত — অর্থাৎ `curl -H "RSC: 1" https://app/dashboard`
  // দিয়ে যে কেউ সার্ভার-রেন্ডার করা পেজের পেলোড চেয়ে নিতে পারত। এখন বাইপাস নেই;
  // পারফরম্যান্স সমস্যার (প্রতি ক্লিকে নেটওয়ার্ক round-trip) আসল সমাধান হলো
  // `getClaims()` — যেটি JWT লোকালি ভেরিফাই করে, Supabase সার্ভারে হিট করে না
  // (এই পারফরম্যান্স-সমাধানটিই MD-7 রিপোর্টে প্রস্তাব করা হয়েছিল — এখন বাস্তবায়িত)।
  // লোকাল verification সম্ভব না হলে (symmetric HS256 key) getClaims নিজেই নীরবে
  // নেটওয়ার্ক round-trip করে ফেলে ব্যবহার করে — অর্থাৎ সুরক্ষা কখনো বাদ পড়ে না।
  const isSoftNavigation = request.headers.get("RSC") === "1";

  let user: { id: string; email?: string | null; user_metadata?: any } | null = null;

  try {
    const rememberVal = request.cookies.get("qawmi_remember_me")?.value;
    const persistentMaxAge = rememberVal === "0" ? 60 * 60 * 24 * 1 : 60 * 60 * 24 * 365;

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({request});
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, {
              ...options,
              path: options?.path ?? "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              maxAge: options?.maxAge ?? persistentMaxAge, // persistent cookie
            });
          });
        },
      },
    });

    if (isSoftNavigation) {
      // লোকাল JWT যাচাই — নেটওয়ার্ক round-trip ছাড়াই (দ্রুত soft navigation)
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
      const claims: any = claimsData?.claims;
      if (!claimsError && claims?.sub) {
        user = {
          id: claims.sub as string,
          email: (claims.email as string) ?? null,
          user_metadata: claims.user_metadata ?? {},
        };
      }
    }

    if (!user) {
      // hard navigation (বা লোকাল claims পাওয়া যায়নি) হলে Supabase সার্ভারের কাছে যাচাই
      const { data, error } = await supabase.auth.getUser();
      user = error ? null : data?.user || null;
    }

    // API routes authenticate their own cookie/Bearer transport. Protected page
    // navigations (including RSC) use the same issuer-bound lookup as the layouts.
    if (user && !isApiRoute && !isPublicRoute && !isAuthRoute) {
      if ((await currentAppSession(supabase))?.user_id !== user.id) user = null;
    }
  } catch (error) {
    console.warn("Middleware Supabase auth validation warning:", error);
    user = null;
  }

  if (!user && !isAuthRoute && !isApiRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);

    const setCookies = supabaseResponse.headers.getSetCookie();
    for (const cookie of setCookies) {
      redirectResponse.headers.append("set-cookie", cookie);
    }
    return redirectResponse;
  }

  // Layouts resolve the complete server-owned role set; never send an inactive
  // session away from /login or infer a role from editable Auth metadata here.
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js$|offline\\.html$|offline-portal\\.js$|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff|woff2|otf|eot)$).*)',
  ],
};
