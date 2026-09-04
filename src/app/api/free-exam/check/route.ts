import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  if (!serviceRoleKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  let body: { questionId?: string; type?: string; selectedIndex?: number; positions?: { x: number; y: number }[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }
  if (!body.questionId) {
    return Response.json({ error: "Missing questionId" }, { status: 400 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  if (body.type === "hotspot") {
    const { data, error } = await admin.rpc("check_hotspot", {
      p_question_id: body.questionId,
      p_positions: body.positions ?? [],
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  }

  const { data, error } = await admin.rpc("check_answer", {
    p_question_id: body.questionId,
    p_selected_index: body.selectedIndex ?? 0,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
