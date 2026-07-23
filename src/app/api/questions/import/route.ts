import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

type ImportRow = {
  question: string
  category: string
  options: Array<{ text: string; isCorrect: boolean }>
  explanation: string | null
  replace_id: string | null
}

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

  const { rows, strategy } = await req.json() as { rows: ImportRow[]; strategy: string }

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "No rows provided" }, { status: 400 })
  }

  if (rows.length > 50) {
    return Response.json({ error: "Batch too large (max 50)" }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const token = session.access_token

  const headers = {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  }

  let imported = 0
  let skipped = 0
  const errors: Array<{ row: number; error: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (row.replace_id) {
      const delRes = await fetch(
        `${baseUrl}/rest/v1/questions?id=eq.${row.replace_id}`,
        { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } }
      )
      if (!delRes.ok) {
        skipped++
        errors.push({ row: i + 1, error: `Failed to delete existing question for replacement` })
        continue
      }
    }

    const insertBody = {
      question_text: row.question,
      category: row.category,
      answer_options: row.options,
      explanation: row.explanation,
      created_by: userId,
    }

    const insertRes = await fetch(
      `${baseUrl}/rest/v1/questions`,
      {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(insertBody),
      }
    )

    if (!insertRes.ok) {
      const text = await insertRes.text()
      skipped++
      errors.push({ row: i + 1, error: `Insert failed: ${insertRes.status} ${text.slice(0, 100)}` })
      continue
    }

    imported++
  }

  return Response.json({
    totalRows: rows.length,
    imported,
    skipped,
    failed: errors.length,
    errors,
  })
}
