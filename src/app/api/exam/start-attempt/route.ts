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
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { exam_id } = await req.json()
  if (!exam_id) return Response.json({ error: "Missing exam_id" }, { status: 400 })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return Response.json({ error: "No session" }, { status: 401 })

  const countRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/count_user_exam_attempts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ p_user_id: user.id, p_exam_id: exam_id }),
    },
  )

  if (!countRes.ok) {
    const text = await countRes.text()
    return Response.json({ error: text, status: countRes.status }, { status: 500 })
  }

  const count = await countRes.json()
  const nextAttempt = (typeof count === "number" ? count : 0) + 1

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/insert_exam_attempt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        p_user_id: user.id,
        p_exam_id: exam_id,
        p_attempt_number: nextAttempt,
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    return Response.json({ error: text, status: res.status }, { status: 500 })
  }

  return Response.json({ success: true, attempt_number: nextAttempt })
}
