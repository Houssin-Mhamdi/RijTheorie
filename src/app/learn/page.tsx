"use client"

import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import type { Lesson } from "@/types/database"
import { BookOpen, ChevronRight } from "lucide-react"

export default function LearnPage() {
  const { data: lessons, isLoading } = useSupabaseQuery<Lesson[]>(
    ["lessons", "published"],
    async () => { const { data, error } = await supabase.from("lessons").select("*").eq("published", true).order("order_index", { ascending: true }); return { data, error } },
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-headline-lg text-primary mb-2">Leer theorie</h1>
        <p className="text-body-md text-on-surface-variant">Doorloop de lessen om je voor te bereiden op het theorie-examen.</p>
      </div>

      {isLoading && <div className="text-center py-16"><p className="text-body-md text-on-surface-variant">Lessen laden…</p></div>}

      {!isLoading && (!lessons || lessons.length === 0) && (
        <div className="text-center py-16">
          <BookOpen size={48} className="mx-auto text-outline-variant mb-4" />
          <p className="text-body-md text-on-surface-variant">Nog geen lessen beschikbaar</p>
        </div>
      )}

      <div className="space-y-3">
        {lessons?.map((lesson) => (
          <Link key={lesson.id} href={`/learn/${lesson.id}`} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 bg-surface hover:shadow-sm hover:border-primary/30 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-container/30">
                <BookOpen size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-body-md font-medium text-primary group-hover:text-primary transition-colors">{lesson.title}</p>
                <p className="text-label-sm text-on-surface-variant">{lesson.category}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-outline-variant group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
