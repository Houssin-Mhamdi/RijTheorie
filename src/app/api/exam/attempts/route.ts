import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(req: Request) {
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
  if (!user) return Response.json({ error: "Unauthorized", status: 401 })

  const { searchParams } = new URL(req.url)
  const examIds = searchParams.get("exam_ids")?.split(",")

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return Response.json({ error: "No session" }, { status: 401 })

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_my_attempts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ p_exam_ids: examIds ?? [] }),
    },
  )

  console.log("[attempts API] user.id:", user.id)
  console.log("[attempts API] status:", res.status)

  if (!res.ok) {
    const text = await res.text()
    console.log("[attempts API] error text:", text)
    return Response.json({ error: text, status: res.status }, { status: 500 })
  }

  const data = await res.json()
  console.log("[attempts API] data:", JSON.stringify(data))
  return Response.json({ attempts: Array.isArray(data) ? data : [] })
}
