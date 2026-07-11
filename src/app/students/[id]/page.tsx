"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Users, FileText, BadgeCheck, XCircle, TrendingUp, Clock, BookOpen, Lightbulb, AlertCircle, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/types/database"

type ExamAttempt = {
  id: string
  exam_id: string
  attempt_number: number
  started_at: string
  completed_at: string | null
  score: number | null
  total_questions: number | null
  passed: boolean | null
  category_scores: Record<string, { correct: number; total: number }> | null
  exams: { title: string }[] | null
}

const ITEMS_PER_PAGE = 5

const categoryIcons: Record<string, typeof TrendingUp> = {
  "Hazard Perception": AlertCircle,
  "Right of Way": TrendingUp,
  "Choose Images": Eye,
  "Traffic": BookOpen,
  "Lighting": Lightbulb,
}

const categoryColors: Record<string, string> = {
  "Hazard Perception": "bg-red-100 text-red-700",
  "Right of Way": "bg-green-100 text-green-700",
  "Choose Images": "bg-blue-100 text-blue-700",
  "Traffic": "bg-amber-100 text-amber-700",
  "Lighting": "bg-purple-100 text-purple-700",
  "Priority": "bg-teal-100 text-teal-700",
  "Driving": "bg-orange-100 text-orange-700",
  "Parking": "bg-pink-100 text-pink-700",
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2) || "?"
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("nl-NL", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name, created_at, last_active_at")
        .eq("id", id)
        .single()
      if (error) throw error
      return data as Pick<Profile, "id" | "email" | "name" | "created_at" | "last_active_at">
    },
    enabled: !!id,
  })

  const { data: attempts = [], isLoading: attemptsLoading } = useQuery({
    queryKey: ["student-attempts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("id, exam_id, attempt_number, started_at, completed_at, score, total_questions, passed, category_scores, exams(title)")
        .eq("user_id", id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
      if (error) throw error
      return data as unknown as ExamAttempt[]
    },
    enabled: !!id,
  })

  const stats = useMemo(() => {
    const completed = attempts.filter((a) => a.completed_at)
    const total = completed.length
    const passed = completed.filter((a) => a.passed).length
    const failed = total - passed
    const avgScore = total > 0
      ? Math.round(completed.reduce((sum, a) => sum + (a.score ?? 0), 0) / total)
      : 0
    const avgPct = total > 0
      ? Math.round(completed.reduce((sum, a) => {
          const pct = a.total_questions && a.total_questions > 0 ? ((a.score ?? 0) / a.total_questions) * 100 : 0
          return sum + pct
        }, 0) / total)
      : 0
    return { total, passed, failed, avgScore, avgPct }
  }, [attempts])

  const categoryStats = useMemo(() => {
    const catMap: Record<string, { correct: number; total: number }> = {}
    for (const a of attempts) {
      if (!a.category_scores) continue
      for (const [cat, scores] of Object.entries(a.category_scores)) {
        if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 }
        catMap[cat].correct += scores.correct
        catMap[cat].total += scores.total
      }
    }
    return Object.entries(catMap)
      .map(([name, scores]) => ({
        name,
        pct: scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0,
        correct: scores.correct,
        total: scores.total,
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [attempts])

  const totalPages = Math.ceil(attempts.length / ITEMS_PER_PAGE)
  const paginatedAttempts = attempts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const isLoading = studentLoading || attemptsLoading

  if (isLoading) {
    return (
      <section className="px-4 md:px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => router.push("/students")}>
            <ArrowLeft size={18} />
          </Button>
          <div className="h-8 w-48 bg-surface-container rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container h-28 animate-pulse" />
          ))}
        </div>
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-6 h-64 animate-pulse" />
      </section>
    )
  }

  if (!student) {
    return (
      <section className="px-4 md:px-6 py-8">
        <div className="flex flex-col items-center justify-center gap-4 mt-20">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-body-lg text-on-surface-variant">Student not found</p>
          <Button variant="outline" onClick={() => router.push("/students")}>Back to students</Button>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 md:px-6 py-8">
      <button
        onClick={() => router.push("/students")}
        className="flex items-center gap-2 text-label-md text-on-surface-variant hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to students
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-xl shrink-0">
            {getInitials(student.name || student.email)}
          </div>
          <div>
            <h2 className="text-headline-lg text-primary">{student.name || "Unnamed"}</h2>
            <p className="text-body-md text-on-surface-variant">{student.email}</p>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                <Clock size={14} />
                Registered {formatDate(student.created_at)}
              </span>
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                <Users size={14} />
                Last active {timeAgo(student.last_active_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <FileText size={20} />
            </div>
          </div>
          <p className="text-label-md text-on-surface-variant">Exams Taken</p>
          <h3 className="text-headline-md text-primary mt-1">{stats.total}</h3>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
              <BadgeCheck size={20} />
            </div>
          </div>
          <p className="text-label-md text-on-surface-variant">Passed</p>
          <h3 className="text-headline-md text-primary mt-1">{stats.passed}</h3>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg">
              <XCircle size={20} />
            </div>
          </div>
          <p className="text-label-md text-on-surface-variant">Failed</p>
          <h3 className="text-headline-md text-primary mt-1">{stats.failed}</h3>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-secondary-container/10 text-secondary rounded-lg">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-label-md text-on-surface-variant">Avg Score</p>
          <h3 className="text-headline-md text-primary mt-1">{stats.avgScore}/{stats.total > 0 ? attempts[0]?.total_questions ?? "—" : "—"} ({stats.avgPct}%)</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container overflow-hidden">
          <div className="p-6 border-b border-outline-variant/30">
            <h3 className="text-headline-md text-primary">Recent Results</h3>
          </div>

          {paginatedAttempts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-body-md text-on-surface-variant">No exam attempts yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">Exam</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">Date</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant text-center">Score</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant">
                  {paginatedAttempts.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 flex items-center justify-center bg-primary-container/10 rounded-lg text-primary">
                            <FileText size={16} />
                          </div>
                          <span className="text-body-md font-medium text-primary">
                            {a.exams?.[0]?.title || `Attempt #${a.attempt_number}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-body-md text-on-surface-variant">
                        {a.completed_at ? formatDate(a.completed_at) : "—"}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-primary">
                          {a.score ?? "?"}/{a.total_questions ?? "?"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {a.passed === true ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-label-xs font-bold">
                            PASSED
                          </span>
                        ) : a.passed === false ? (
                          <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-label-xs font-bold">
                            RETAKE
                          </span>
                        ) : (
                          <span className="text-label-sm text-on-surface-variant">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-6 border-t border-outline-variant/30 flex items-center justify-between gap-4">
              <span className="text-label-md text-on-surface-variant">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, attempts.length)} of {attempts.length}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  <ChevronLeft size={18} />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button key={p} variant={p === currentPage ? "default" : "outline"} size="icon" onClick={() => setCurrentPage(p)}>
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <h3 className="text-headline-md text-primary mb-6">Progress by Category</h3>
          {categoryStats.length === 0 ? (
            <p className="text-body-md text-on-surface-variant text-center py-8">No category data yet.</p>
          ) : (
            <div className="space-y-6">
              {categoryStats.map((cat) => {
                const Icon = categoryIcons[cat.name] || TrendingUp
                const colorClass = categoryColors[cat.name] || "bg-surface-container text-primary"
                return (
                  <div key={cat.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1 rounded ${colorClass}`}>
                        <Icon size={14} />
                      </div>
                      <span className="flex-1 text-body-md font-semibold text-primary">{cat.name}</span>
                      <span className="text-label-md font-bold text-secondary">{cat.pct}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary-container rounded-full transition-all"
                        style={{ width: `${Math.min(cat.pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-label-xs text-on-surface-variant mt-1">{cat.correct}/{cat.total} correct</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
