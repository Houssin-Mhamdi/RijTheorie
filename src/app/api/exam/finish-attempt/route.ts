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

  const { exam_id, score, total_questions, passed } = await req.json()
  if (!exam_id) return Response.json({ error: "Missing exam_id" }, { status: 400 })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return Response.json({ error: "No session" }, { status: 401 })

  const latestRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_latest_attempt`,
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

  if (!latestRes.ok) {
    const text = await latestRes.text()
    return Response.json({ error: text, status: latestRes.status }, { status: 500 })
  }

  const latest = await latestRes.json()
  if (!latest || !latest.id) {
    return Response.json({ error: "No attempt found" }, { status: 404 })
  }

  const finishRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/finish_exam_attempt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        p_attempt_id: latest.id,
        p_score: score,
        p_total_questions: total_questions,
        p_passed: passed,
      }),
    },
  )

  if (!finishRes.ok) {
    const text = await finishRes.text()
    return Response.json({ error: text, status: finishRes.status }, { status: 500 })
  }

  return Response.json({ success: true })
}
