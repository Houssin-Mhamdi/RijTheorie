"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  FileText,
  ListOrdered,
  Timer,
  RotateCcw,
  GraduationCap,
  ChevronRight,
  Clock,
} from "lucide-react"

export default function ExamsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [attemptData, setAttemptData] = useState<Record<string, { count: number; passedCount: number; passed: boolean | null }>>({})

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch("/api/auth/role")
        const { role } = await res.json()
        if (role !== "student" && role !== "admin") {
          router.push("/dashboard")
          return
        }
        setAuthorized(true)
      } catch {
        router.push("/dashboard")
      }
    }
    checkAccess()
  }, [router])

  const { data: exams, isLoading: examsLoading } = useSupabaseQuery(
    ["exams", "free"],
    async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*, exam_questions(count), course:courses(title, icon_name)")
        .eq("is_free", true)
        .order("created_at", { ascending: true })
      return { data, error }
    },
    { enabled: authorized === true },
  )

  useEffect(() => {
    if (!exams) return
    const fetchAttempts = async () => {
      const examIds = exams.map((e: Record<string, unknown>) => e.id as string)
      try {
        const { data: attempts, error } = await supabase
          .rpc("get_my_attempts", { p_exam_ids: examIds })
        if (error) throw error
        const data: Record<string, { count: number; passedCount: number; passed: boolean | null }> = {}
        attempts.forEach((a: { exam_id: string; attempt_number: number; passed: boolean | null }) => {
          if (!data[a.exam_id]) {
            data[a.exam_id] = { count: 0, passedCount: 0, passed: null }
          }
          if (a.attempt_number > data[a.exam_id].count) {
            data[a.exam_id].count = a.attempt_number
            data[a.exam_id].passed = a.passed
          }
          if (a.passed) data[a.exam_id].passedCount++
        })
        setAttemptData(data)
      } catch (e) {
        console.error("Failed to fetch attempts:", e)
      }
    }
    fetchAttempts()
  }, [exams])

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (authorized === false) return null

  return (
    <div className="flex flex-col min-h-full bg-surface">
      <div className="px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Exams</h1>
            <p className="text-body-md text-on-surface-variant mt-0.5">Select a practice exam to start</p>
          </div>
          <div className="size-10 md:size-12 rounded-full bg-primary-container/30 flex items-center justify-center text-primary font-bold shrink-0">
            <GraduationCap size={22} className="md:size-6" />
          </div>
        </div>
      </div>

      {examsLoading && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-label-sm text-on-surface-variant">Loading exams...</span>
          </div>
        </div>
      )}

      {!examsLoading && (!exams || exams.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-5">
          <div className="size-20 rounded-full bg-surface-container-low flex items-center justify-center mb-5">
            <FileText size={36} className="text-outline-variant" />
          </div>
          <p className="text-body-lg text-on-surface font-semibold mb-1">No exams available</p>
          <p className="text-body-md text-on-surface-variant text-center">Check back later for new practice exams.</p>
        </div>
      )}

      {!examsLoading && exams && exams.length > 0 && (
        <div className="flex-1 px-4 sm:px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {exams.map((exam) => {
            const examData = exam as Record<string, unknown>
            const courseData = examData.course as Record<string, unknown> | undefined
            const questionCount = (examData.exam_questions as { count: number }[] | undefined)?.[0]?.count ?? 0
            const examId = examData.id as string
            const att = attemptData[examId]
            const hasStarted = att && att.count > 0
            const hasPassed = att?.passed === true
            const isComplete = att?.passed !== null
            const statusLabel = hasPassed ? "Geslaagd" : hasStarted && isComplete ? "Gezakt" : hasStarted ? "Bezig" : "Not started"
            const statusClass = hasPassed ? "bg-green-100 text-green-700" : hasStarted && isComplete ? "bg-red-100 text-red-700" : hasStarted ? "bg-primary-container/10 text-primary" : "bg-surface-container-low text-on-surface-variant"

            return (
              <div
                key={examId}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 overflow-hidden active:scale-[0.98] md:active:scale-[0.99] transition-transform"
              >
                <div className="p-5 md:p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold ${statusClass}`}>
                            {statusLabel}
                          </span>
                          {hasStarted && (
                            <span className="px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold bg-primary-container/10 text-primary">
                              Poging {att!.count}
                            </span>
                          )}
                          {hasStarted && (
                            <span className={`px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold ${(att?.passedCount ?? 0) > 0 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                              {att!.passedCount}/{att!.count} geslaagd
                            </span>
                          )}
                      </div>
                      <h3 className="text-headline-md md:text-headline-lg font-bold text-primary truncate">
                        {examData.title as string}
                      </h3>
                      {courseData && (
                        <p className="text-label-sm text-on-surface-variant mt-0.5">{courseData.title as string}</p>
                      )}
                    </div>
                    <div className="size-10 md:size-12 rounded-xl bg-primary-container/10 flex items-center justify-center shrink-0">
                      <FileText size={20} className="md:size-6 text-primary" />
                    </div>
                  </div>

                  <div className="flex items-center gap-5 mb-5">
                    <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                      <ListOrdered size={16} />
                      <span>{questionCount} vragen</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                      <Timer size={16} />
                      <span>45 min</span>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 md:h-11 rounded-xl text-label-md font-bold"
                    variant="secondary"
                    onClick={() => router.push(`/exams/${examData.id}`)}
                  >
                    Start Exam
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="px-4 sm:px-6 pb-6 pt-2">
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 md:p-6 text-white">
          <div className="flex items-start md:items-center gap-4">
            <div className="size-12 md:size-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <RotateCcw size={24} className="md:size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-headline-md md:text-headline-lg font-bold mb-1">Wrongly answered questions?</h4>
              <p className="text-body-md opacity-85 leading-relaxed">
                Review the questions you previously answered incorrectly to strengthen your knowledge.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/exams/review")}
            className="mt-4 md:mt-5 w-full bg-white/20 rounded-xl py-3 px-4 flex items-center justify-between text-label-md font-bold active:bg-white/30 transition-colors hover:bg-white/30"
          >
            <span>Review Mistakes</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
