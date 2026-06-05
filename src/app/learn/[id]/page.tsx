"use client"

import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import type { Lesson } from "@/types/database"
import { ArrowLeft, BookOpen } from "lucide-react"

export default function LessonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.id as string

  const { data: lesson, isLoading } = useSupabaseQuery<Lesson>(
    ["lesson", lessonId],
    async () => { const { data, error } = await supabase.from("lessons").select("*").eq("id", lessonId).eq("published", true).single(); return { data, error } },
    { enabled: !!lessonId },
  )

  if (isLoading) return <div className="text-center py-16"><p className="text-body-md text-on-surface-variant">Les laden…</p></div>

  if (!lesson) return (
    <div className="text-center py-16">
      <BookOpen size={48} className="mx-auto text-outline-variant mb-4" />
      <p className="text-body-md text-on-surface-variant mb-4">Les niet gevonden</p>
      <button onClick={() => router.push("/learn")} className="text-primary hover:underline">Terug naar overzicht</button>
    </div>
  )

  return (
    <article>
      <button onClick={() => router.push("/learn")} className="flex items-center gap-1 text-label-md text-primary hover:underline mb-6">
        <ArrowLeft size={16} />
        Terug naar overzicht
      </button>

      <div className="mb-6">
        <span className="inline-block px-3 py-1 rounded-full bg-primary-container/30 text-label-sm text-primary mb-3">{lesson.category}</span>
        <h1 className="text-headline-lg text-primary">{lesson.title}</h1>
      </div>

      <div className="prose prose-lg max-w-none text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">{lesson.content}</div>

      <div className="mt-12 pt-8 border-t border-outline-variant/20">
        <button onClick={() => router.push("/learn")} className="flex items-center gap-1 text-label-md text-primary hover:underline">
          <ArrowLeft size={16} />
          Terug naar alle lessen
        </button>
      </div>
    </article>
  )
}
