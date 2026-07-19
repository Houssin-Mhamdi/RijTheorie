"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Car, Motorbike, Bike, Truck, Ship, ChevronLeft, Loader2, FileText, ListOrdered, Timer, CheckCircle, XCircle, ArrowRight } from "lucide-react"

const iconMap: Record<string, typeof Car> = { Car, Motorbike, Bike, Truck, Ship }

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [course, setCourse] = useState<Record<string, unknown> | null>(null)
  const [exams, setExams] = useState<Record<string, unknown>[]>([])
  const [attemptData, setAttemptData] = useState<Record<string, { count: number; passed: boolean | null }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single()

      if (!courseData) {
        router.push("/exams")
        return
      }
      setCourse(courseData)

      const { data: examsData } = await supabase
        .from("exams")
        .select("*, exam_questions(count)")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true })

      const examList = (examsData as Record<string, unknown>[]) || []
      setExams(examList)

      if (examList.length > 0) {
        const examIds = examList.map((e) => e.id as string)
        const { data: attempts } = await supabase
          .rpc("get_my_attempts", { p_exam_ids: examIds })

        const data: Record<string, { count: number; passed: boolean | null }> = {}
        ;(attempts as { exam_id: string; attempt_number: number; passed: boolean | null }[] | null)?.forEach((a) => {
          if (!data[a.exam_id] || a.attempt_number > data[a.exam_id].count) {
            data[a.exam_id] = { count: a.attempt_number, passed: a.passed }
          }
        })
        setAttemptData(data)
      }

      setLoading(false)
    }

    fetchData()
  }, [courseId, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!course) return null

  const Icon = iconMap[(course.icon_name as string) || "Car"] || Car
  const totalExams = exams.length
  const completedExams = exams.filter((e) => attemptData[e.id as string]?.passed === true).length
  const inProgress = exams.filter((e) => {
    const a = attemptData[e.id as string]
    return a && a.count > 0 && a.passed === null
  }).length
  const progressPct = totalExams > 0 ? Math.round((completedExams / totalExams) * 100) : 0

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/exams")}
          className="flex items-center gap-1.5 text-label-sm text-on-surface-variant hover:text-primary transition-colors mb-5"
        >
          <ChevronLeft size={18} />
          Terug naar examens
        </button>

        {/* Course header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="size-16 md:size-20 rounded-2xl bg-primary-container/20 flex items-center justify-center">
            <Icon size={32} className="md:size-10 text-primary" />
          </div>
          <div>
            <h1 className="text-headline-lg md:text-display-sm font-bold text-primary">
              {course.title as string}
            </h1>
            <p className="text-body-md text-on-surface-variant mt-0.5">
              {totalExams} {totalExams === 1 ? "examen" : "examens"} — {completedExams} behaald
            </p>
          </div>
        </div>

        {/* Progress card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-headline-sm font-bold text-primary">Voortgang</h2>
            <span className="text-headline-sm font-bold text-primary">{progressPct}%</span>
          </div>
          <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-headline-md font-bold text-primary">{completedExams}</p>
              <p className="text-label-sm text-on-surface-variant">Behaald</p>
            </div>
            <div className="text-center">
              <p className="text-headline-md font-bold text-orange-500">{inProgress}</p>
              <p className="text-label-sm text-on-surface-variant">Bezig</p>
            </div>
            <div className="text-center">
              <p className="text-headline-md font-bold text-on-surface-variant">{totalExams - completedExams - inProgress}</p>
              <p className="text-label-sm text-on-surface-variant">Niet gestart</p>
            </div>
          </div>
        </div>

        {/* Exams list */}
        <h2 className="text-headline-sm font-bold text-primary mb-4">Examens</h2>
        <div className="space-y-3">
          {exams.map((exam) => {
            const examId = exam.id as string
            const questionCount = (exam.exam_questions as { count: number }[])?.[0]?.count ?? 0
            const att = attemptData[examId]
            const hasStarted = att && att.count > 0
            const passed = att?.passed === true

            const statusLabel = passed ? "Geslaagd" : hasStarted ? "Bezig" : "Niet gestart"
            const statusClass = passed
              ? "bg-green-100 text-green-700"
              : hasStarted
              ? "bg-orange-100 text-orange-700"
              : "bg-surface-container-high text-on-surface-variant"

            return (
              <div
                key={examId}
                onClick={() => router.push(`/exams/${examId}`)}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 md:p-5 flex items-center gap-4 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all active:scale-[0.99]"
              >
                <div className="size-12 rounded-xl bg-primary-container/10 flex items-center justify-center shrink-0">
                  {passed ? (
                    <CheckCircle size={22} className="text-green-600" />
                  ) : hasStarted ? (
                    <XCircle size={22} className="text-orange-500" />
                  ) : (
                    <FileText size={22} className="text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}`}>
                      {statusLabel}
                    </span>
                    {hasStarted && (
                      <span className="text-label-xs text-on-surface-variant">
                        Poging {att.count}
                      </span>
                    )}
                  </div>
                  <h3 className="text-label-md font-bold text-on-surface truncate">
                    {exam.title as string}
                  </h3>
                  <div className="flex items-center gap-4 mt-0.5">
                    <span className="text-label-xs text-on-surface-variant flex items-center gap-1">
                      <ListOrdered size={12} />
                      {questionCount} vragen
                    </span>
                    <span className="text-label-xs text-on-surface-variant flex items-center gap-1">
                      <Timer size={12} />
                      {(exam.duration_minutes as number) ?? 45} min
                    </span>
                  </div>
                </div>
                <ArrowRight size={18} className="text-on-surface-variant shrink-0" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
