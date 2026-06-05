"use client"

import { useSupabaseQuery } from "@/lib/supabase-queries"
import { supabase } from "@/lib/supabase"
import { Loader2, CheckCircle2, XCircle, BarChart3, FileText, Timer, Award } from "lucide-react"
import { useSession } from "@/hooks/use-auth"

export default function ResultsPage() {
  const { data: session } = useSession()

  const { data: exams, isLoading } = useSupabaseQuery(
    ["results", "exams"],
    async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*, exam_questions(count), course:courses(title, icon_name)")
        .eq("is_free", true)
        .order("created_at", { ascending: false })
      return { data, error }
    },
    { enabled: !!session },
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const totalExams = exams?.length ?? 0
  const passed = 0
  const failed = 0
  const avgScore = 0

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-headline-lg text-primary mb-2">Exam Results</h1>
        <p className="text-body-lg text-on-surface-variant">View your performance across all practice exams.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary-container/10">
              <FileText size={20} className="text-primary" />
            </div>
          </div>
          <p className="text-headline-lg text-primary font-bold">{totalExams}</p>
          <p className="text-label-sm text-on-surface-variant">Total Exams</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-green-100">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
          </div>
          <p className="text-headline-lg text-primary font-bold">{passed}</p>
          <p className="text-label-sm text-on-surface-variant">Passed</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-red-100">
              <XCircle size={20} className="text-red-600" />
            </div>
          </div>
          <p className="text-headline-lg text-primary font-bold">{failed}</p>
          <p className="text-label-sm text-on-surface-variant">Failed</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-secondary-container/20">
              <Award size={20} className="text-secondary-container" />
            </div>
          </div>
          <p className="text-headline-lg text-primary font-bold">{avgScore}%</p>
          <p className="text-label-sm text-on-surface-variant">Avg Score</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/20">
          <h3 className="text-headline-sm text-primary">Exam History</h3>
        </div>

        {(!exams || exams.length === 0) && (
          <div className="text-center py-16">
            <BarChart3 size={48} className="mx-auto text-outline-variant mb-4" />
            <p className="text-body-md text-on-surface-variant">No exam results yet</p>
            <p className="text-body-sm text-outline-variant mt-1">Complete an exam to see your results here.</p>
          </div>
        )}

        {exams && exams.length > 0 && (
          <div className="divide-y divide-outline-variant/10">
            {exams.map((exam) => {
              const examData = exam as Record<string, unknown>
              const courseData = examData.course as Record<string, unknown> | undefined
              const questionCount = (examData.exam_questions as { count: number }[] | undefined)?.[0]?.count ?? 0

              return (
                <div key={examData.id as string} className="px-6 py-4 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-xl bg-surface-container-low">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-label-md text-primary font-medium">{examData.title as string}</p>
                      {courseData && (
                        <p className="text-body-sm text-on-surface-variant">{courseData.title as string}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                      <Timer size={14} />
                      <span>{questionCount} questions</span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-label-sm bg-surface-container-low text-on-surface-variant">
                      Not started
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
