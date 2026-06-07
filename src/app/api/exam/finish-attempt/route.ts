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

  const { exam_id, score, total_questions, passed } = await req.json()
  if (!exam_id) return Response.json({ error: "Missing exam_id" }, { status: 400 })

  const latestRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/exam_attempts?select=id&user_id=eq.${user.id}&exam_id=eq.${exam_id}&completed_at=is.null&order=started_at.desc&limit=1`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  )

  if (!latestRes.ok) {
    const text = await latestRes.text()
    return Response.json({ error: `FIND: ${latestRes.status} ${text}` }, { status: 500 })
  }

  const attempts = await latestRes.json()
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return Response.json({ error: "No attempt found" }, { status: 404 })
  }

  const updateRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/exam_attempts?id=eq.${attempts[0].id}`,
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
