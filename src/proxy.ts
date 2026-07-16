import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

async function getRole(userId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${userId}`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )
    const profiles = await res.json()
    return profiles?.[0]?.role ?? null
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage = path === "/login" || path === "/signup"
  const isRoot = path === "/"
  const isAdminRoute = path.startsWith("/dashboard") || path.startsWith("/learn") || path.startsWith("/questions") || path.startsWith("/lessons") || path.startsWith("/students") || path.startsWith("/subscriptions")
  const isStudentRoute = path.startsWith("/exams") || path.startsWith("/results")

  if (!user && (isAdminRoute || isStudentRoute)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user && (isAuthPage || isRoot)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (user && (isAdminRoute || isStudentRoute)) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      const role = await getRole(user.id, session.access_token)

      if (isAdminRoute && role !== "admin") {
        return NextResponse.redirect(new URL("/exams", request.url))
      }

      if (isStudentRoute && role !== "student" && role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/dashboard/:path*", "/learn/:path*", "/questions/:path*", "/lessons/:path*", "/students/:path*", "/exams/:path*", "/results/:path*", "/subscriptions/:path*", "/login", "/signup", "/"],
}
