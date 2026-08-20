import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

async function getRole(userId: string): Promise<{ role: string; can_access_exams: boolean } | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=role,can_access_exams&id=eq.${userId}`
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) {
      console.error("[PROXY] SUPABASE_SERVICE_ROLE_KEY is missing!")
      return null
    }
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    })
    const text = await res.text()
    console.error("[PROXY] role lookup status:", res.status, "body:", text.slice(0, 200))
    if (!res.ok) return null
    const profiles = JSON.parse(text)
    return profiles?.[0] ?? null
  } catch (e) {
    console.error("[PROXY] getRole error:", e)
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
  const isStudentRoute = path.startsWith("/exams") || path.startsWith("/results") || path.startsWith("/courses")

  if (!user && (isAdminRoute || isStudentRoute)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user && (isAuthPage || isRoot)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (user && (isAdminRoute || isStudentRoute)) {
    const profile = await getRole(user.id)
    console.error("[PROXY] user:", user.id, "profile:", profile)
    const role = profile?.role ?? null
    const canAccessExams = profile?.can_access_exams ?? false

    if (isAdminRoute && role !== "admin") {
      return NextResponse.redirect(new URL("/exams", request.url))
    }

    if (isStudentRoute && role !== "student" && !(role === "admin" && canAccessExams)) {
      if (role === null) {
        return NextResponse.redirect(new URL("/login", request.url))
      }
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/dashboard/:path*", "/learn/:path*", "/questions/:path*", "/lessons/:path*", "/students/:path*", "/exams/:path*", "/results/:path*", "/subscriptions/:path*", "/courses/:path*", "/login", "/signup", "/"],
}
