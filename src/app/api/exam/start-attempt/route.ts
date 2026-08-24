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

  const { exam_id } = await req.json()
  if (!exam_id) return Response.json({ error: "Missing exam_id" }, { status: 400 })

  // Service role (server-side only): students have no direct INSERT on exam_attempts
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { count, error: countErr } = await adminClient
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("exam_id", exam_id)

  if (countErr) {
    return Response.json({ error: `COUNT: ${countErr.message}` }, { status: 500 })
  }

  const nextAttempt = (count ?? 0) + 1

  const { error: insertErr } = await adminClient
    .from("exam_attempts")
    .insert({ user_id: user.id, exam_id, attempt_number: nextAttempt })

  if (insertErr) {
    return Response.json({ error: `INSERT: ${insertErr.message}` }, { status: 500 })
  }

  return Response.json({ success: true, attempt_number: nextAttempt })
}
