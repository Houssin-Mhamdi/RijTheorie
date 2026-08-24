import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  if (!serviceRoleKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
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

  const { exam_id, score, total_questions, passed, category_scores, attempt_id } = await req.json()
  if (!exam_id || !attempt_id) {
    return Response.json({ error: "Missing exam_id or attempt_id" }, { status: 400 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Ownership + one-time completion enforced server-side: the attempt must
  // belong to the caller and must not already be completed.
  const { error: updateErr } = await adminClient
    .from("exam_attempts")
    .update({
      score,
      total_questions,
      passed,
      category_scores: category_scores ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attempt_id)
    .eq("user_id", user.id)
    .eq("exam_id", exam_id)
    .is("completed_at", null)

  if (updateErr) {
    return Response.json({ error: `UPDATE: ${updateErr.message}` }, { status: 500 })
  }

  return Response.json({ success: true })
}
