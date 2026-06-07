import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET() {
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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return Response.json({ error: "No session" }, { status: 401 })

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_exam_stats_full`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  )

  if (!res.ok) {
    const text = await res.text()
    return Response.json({ attempts: [], error: text })
  }

  const data = await res.json()
  return Response.json({ attempts: data ?? [] })
}
