import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ valid: false, error: "Unauthorized" }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (!isAdmin) return NextResponse.json({ valid: false, error: "Forbidden" }, { status: 403 })

  const { secretKey } = await req.json()
  if (!secretKey || typeof secretKey !== "string") {
    return NextResponse.json({ valid: false, error: "Missing secret key" }, { status: 400 })
  }

  const res = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${secretKey}` },
  })

  if (!res.ok) {
    return NextResponse.json({ valid: false, error: "Invalid key" })
  }

  const balance = await res.json()
  return NextResponse.json({ valid: true, balance })
}
