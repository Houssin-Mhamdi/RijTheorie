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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return Response.json({ error: "No session" }, { status: 401 })

  const { exam_id } = await req.json()
  if (!exam_id) return Response.json({ error: "Missing exam_id" }, { status: 400 })

  const countRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/exam_attempts?user_id=eq.${user.id}&exam_id=eq.${exam_id}&select=id`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
        Prefer: "count=exact",
      },
    },
  )

  if (!countRes.ok) {
    const text = await countRes.text()
    return Response.json({ error: `COUNT: ${countRes.status} ${text}` }, { status: 500 })
  }

  const range = countRes.headers.get("content-range") ?? ""
  const totalCount = parseInt(range.split("/")[1] ?? "0", 10)
  const nextAttempt = totalCount + 1

  const insertRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/exam_attempts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ user_id: user.id, exam_id, attempt_number: nextAttempt }),
    },
  )

  if (!insertRes.ok) {
    const text = await insertRes.text()
    return Response.json({ error: `INSERT: ${insertRes.status} ${text}` }, { status: 500 })
  }

  return Response.json({ success: true, attempt_number: nextAttempt })
}
