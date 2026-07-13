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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return Response.json({ error: "No session" }, { status: 401 })
  const userId = session.user?.id
  if (!userId) return Response.json({ error: "No user" }, { status: 401 })

  const { exam_id, score, total_questions, passed, category_scores } = await req.json()
  if (!exam_id) return Response.json({ error: "Missing exam_id" }, { status: 400 })

  const rpcRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_latest_attempt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ p_user_id: userId, p_exam_id: exam_id }),
    },
  )

  if (!rpcRes.ok) {
    const text = await rpcRes.text()
    return Response.json({ error: `RPC FIND: ${rpcRes.status} ${text}` }, { status: 500 })
  }

  const attempts = await rpcRes.json()
  const attemptId = Array.isArray(attempts) && attempts.length > 0 ? attempts[0]?.id : null
  if (!attemptId) {
    return Response.json({ error: "No attempt found" }, { status: 404 })
  }

  const updateRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/exam_attempts?id=eq.${attemptId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        score,
        total_questions,
        passed,
        category_scores: category_scores ?? null,
        completed_at: new Date().toISOString(),
      }),
    },
  )

  if (!updateRes.ok) {
    const text = await updateRes.text()
    return Response.json({ error: `UPDATE: ${updateRes.status} ${text}` }, { status: 500 })
  }

  return Response.json({ success: true })
}
