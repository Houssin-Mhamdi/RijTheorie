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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return Response.json({ error: "No session" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const examIds = searchParams.get("exam_ids")?.split(",")

  let url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/exam_attempts?select=id,exam_id,attempt_number,score,passed&user_id=eq.${user.id}&order=started_at.desc`

  if (examIds && examIds.length > 0 && examIds[0]) {
    url += `&exam_id=in.(${examIds.join(",")})`
  }

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    return Response.json({ error: text }, { status: 500 })
  }

  const data = await res.json()
  return Response.json({ attempts: Array.isArray(data) ? data : [] })
}
