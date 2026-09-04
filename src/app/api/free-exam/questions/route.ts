import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  if (!serviceRoleKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  let examId: string
  try {
    const body = await req.json()
    examId = String(body?.examId || "")
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }
  if (!examId) {
    return Response.json({ error: "Missing examId" }, { status: 400 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Only free exams may be taken anonymously.
  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, title, description, duration_minutes, pass_threshold, pass_type, pass_count, is_free")
    .eq("id", examId)
    .single()
  if (examErr || !exam) {
    return Response.json({ error: "Exam not found" }, { status: 404 })
  }
  if (exam.is_free !== true) {
    return Response.json({ error: "Not a free exam" }, { status: 403 })
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc("get_exam_questions", {
    p_exam_id: examId,
  })
  if (rpcErr || !rpcData || !Array.isArray(rpcData) || rpcData.length === 0) {
    return Response.json({ error: "No questions found" }, { status: 404 })
  }

  const questions = rpcData.map((q) => {
    const media = (q.media as string) || null
    const ext = media?.split(".").pop()?.toLowerCase() ?? ""
    const mime = /^(mp4|webm|ogg|mov)$/i.test(ext) ? `video/${ext}` : media ? "image/unknown" : null
    return {
      id: q.id,
      category: q.category,
      questionText: q.question_text,
      pauseAt: (q.pause_at as number) ?? 3,
      media,
      mediaMime: mime,
      answerOptions: q.answer_options ?? [],
      translations: q.translations ?? undefined,
      audioTranslations: q.audio_translations ?? {},
      explanationAudioTranslations: q.explanation_audio_translations ?? {},
    }
  })

  return Response.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      duration_minutes: exam.duration_minutes ?? 45,
      pass_threshold: exam.pass_threshold,
      pass_type: exam.pass_type,
      pass_count: exam.pass_count,
    },
    questions,
  })
}
