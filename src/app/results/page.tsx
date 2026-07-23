"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useQuery } from "@tanstack/react-query"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  FileText,
  Award,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  BookOpen,
  Lightbulb,
  AlertCircle,
  Clock,
} from "lucide-react"
import { useTranslation } from "@/lib/i18n/translations"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Filler,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js"
import { Line, Radar } from "react-chartjs-2"

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Filler,
  ChartTooltip,
  Legend,
)

type Attempt = {
  id: string
  exam_id: string
  score: number | null
  total_questions: number | null
  passed: boolean | null
  started_at: string
  completed_at: string | null
  category_scores: Record<string, { correct: number; total: number }> | null
  exams: { title: string }[] | null
}

const categoryIcons: Record<string, typeof BarChart3> = {
  "Hazard Perception": AlertCircle,
  "Right of Way": TrendingUp,
  "Choose Images": Eye,
  Traffic: BookOpen,
  Lighting: Lightbulb,
}

const categoryColors: Record<string, string> = {
  "Hazard Perception": "bg-red-100 text-red-700",
  "Right of Way": "bg-green-100 text-green-700",
  "Choose Images": "bg-blue-100 text-blue-700",
  Traffic: "bg-purple-100 text-purple-700",
  Lighting: "bg-amber-100 text-amber-700",
}

const ITEMS_PER_PAGE = 8
const chartPalette = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6"]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ResultsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["results-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("id, exam_id, score, total_questions, passed, started_at, completed_at, category_scores, exams(title)")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
      if (error) throw error
      return data as unknown as Attempt[]
    },
  })

  const stats = useMemo(() => {
    const total = attempts.length
    const passed = attempts.filter((a) => a.passed).length
    const failed = total - passed
    const avgPct =
      total > 0
        ? Math.round(
            attempts.reduce((sum, a) => {
              const pct = a.total_questions && a.total_questions > 0 ? ((a.score ?? 0) / a.total_questions) * 100 : 0
              return sum + pct
            }, 0) / total,
          )
        : 0
    return { total, passed, failed, avgPct }
  }, [attempts])

  const categoryStats = useMemo(() => {
    const map: Record<string, { correct: number; total: number }> = {}
    for (const a of attempts) {
      if (!a.category_scores) continue
      for (const [cat, s] of Object.entries(a.category_scores)) {
        if (!map[cat]) map[cat] = { correct: 0, total: 0 }
        map[cat].correct += s.correct
        map[cat].total += s.total
      }
    }
    return Object.entries(map)
      .map(([name, s]) => ({
        name,
        pct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        correct: s.correct,
        total: s.total,
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [attempts])

  const scoreTrendData = useMemo(() => {
    const sorted = [...attempts]
      .filter((a) => a.completed_at && a.total_questions)
      .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())

    return {
      labels: sorted.map((a) =>
        new Date(a.completed_at!).toLocaleDateString("nl-NL", { day: "2-digit", month: "short" }),
      ),
      datasets: [
        {
          label: "Score %",
          data: sorted.map((a) => Math.round(((a.score ?? 0) / (a.total_questions ?? 1)) * 100)),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.1)",
          borderWidth: 2,
          pointBackgroundColor: sorted.map((a) =>
            a.passed ? "#22c55e" : "#ef4444",
          ),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          fill: true,
          tension: 0.3,
        },
      ],
    }
  }, [attempts])

  const radarData = useMemo(() => {
    const cats =
      categoryStats.length > 0
        ? categoryStats
        : [{ name: "Geen data", pct: 0, correct: 0, total: 0 }]
    return {
      labels: cats.map((c) => c.name),
      datasets: [
        {
          label: "Score %",
          data: cats.map((c) => c.pct),
          backgroundColor: "rgba(99,102,241,0.2)",
          borderColor: "#6366f1",
          borderWidth: 2,
          pointBackgroundColor: cats.map((_, i) => chartPalette[i % chartPalette.length]),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
        },
      ],
    }
  }, [categoryStats])

  const totalPages = Math.ceil(attempts.length / ITEMS_PER_PAGE)
  const paginatedAttempts = attempts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-headline-lg text-primary mb-2">{t("results.title")}</h1>
          <p className="text-body-lg text-on-surface-variant">{t("results.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary-container/10">
              <FileText size={20} className="text-primary" />
            </div>
          </div>
          <p className="text-headline-lg text-primary font-bold">{stats.total}</p>
          <p className="text-label-sm text-on-surface-variant">{t("results.totalExams")}</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-green-100">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
          </div>
          <p className="text-headline-lg text-green-600 font-bold">{stats.passed}</p>
          <p className="text-label-sm text-on-surface-variant">{t("results.passed")}</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-red-100">
              <XCircle size={20} className="text-red-600" />
            </div>
          </div>
          <p className="text-headline-lg text-red-600 font-bold">{stats.failed}</p>
          <p className="text-label-sm text-on-surface-variant">{t("results.failed")}</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-secondary-container/20">
              <Award size={20} className="text-secondary-container" />
            </div>
          </div>
          <p className="text-headline-lg text-primary font-bold">{stats.avgPct}%</p>
          <p className="text-label-sm text-on-surface-variant">{t("results.avgScore")}</p>
        </div>
      </div>

      {attempts.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6">
            <h3 className="text-headline-sm text-primary mb-4">{t("progress.scoreTrend")}</h3>
            <div className="h-56">
              <Line
                data={scoreTrendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true, max: 100, ticks: { stepSize: 20, font: { size: 10 }, callback: (v: number | string) => `${v}%` }, grid: { color: "rgba(0,0,0,0.04)" } },
                    x: { ticks: { font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
                  },
                  plugins: { legend: { display: false } },
                }}
              />
            </div>
          </div>

          {categoryStats.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6">
              <h3 className="text-headline-sm text-primary mb-4">{t("progress.categoryRadar")}</h3>
              <div className="h-56">
                <Radar
                  data={radarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 20, font: { size: 9 } },
                        grid: { color: "rgba(0,0,0,0.06)" },
                        angleLines: { color: "rgba(0,0,0,0.06)" },
                        pointLabels: { font: { size: 10, weight: "bold" as const } },
                      },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/20">
          <h3 className="text-headline-sm text-primary">{t("results.history")}</h3>
        </div>

        {attempts.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 size={48} className="mx-auto text-outline-variant mb-4" />
            <p className="text-body-md text-on-surface-variant">{t("results.noResults")}</p>
            <p className="text-body-sm text-outline-variant mt-1">{t("results.noResultsDesc")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-4 py-3 text-label-md text-on-surface-variant">{t("results.history")}</th>
                    <th className="px-4 py-3 text-label-md text-on-surface-variant">Datum</th>
                    <th className="px-4 py-3 text-label-md text-on-surface-variant text-center">Score</th>
                    <th className="px-4 py-3 text-label-md text-on-surface-variant text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant/50">
                  {paginatedAttempts.map((a) => {
                    const pct = a.total_questions ? Math.round(((a.score ?? 0) / a.total_questions) * 100) : 0
                    return (
                      <tr key={a.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`size-8 rounded-lg flex items-center justify-center ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {a.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            </div>
                            <span className="text-body-md font-medium text-primary">
                              {a.exams?.[0]?.title || "Exam"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-body-sm text-on-surface-variant">
                          {a.completed_at ? formatDate(a.completed_at) : "—"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-label-md font-bold ${pct >= 80 ? "text-green-600" : "text-red-600"}`}>
                              {a.score}/{a.total_questions}
                            </span>
                            <span className="text-label-xs text-on-surface-variant">({pct}%)</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {a.passed === true ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-label-xs font-bold">
                              {t("exams.passed")}
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-label-xs font-bold">
                              {t("exams.failed")}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-outline-variant/20 flex items-center justify-between">
                <span className="text-label-sm text-on-surface-variant">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, attempts.length)} van {attempts.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="size-8 rounded-lg flex items-center justify-center hover:bg-surface-container disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`size-8 rounded-lg text-label-sm font-bold transition-colors ${
                        p === currentPage
                          ? "bg-primary text-on-primary"
                          : "hover:bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="size-8 rounded-lg flex items-center justify-center hover:bg-surface-container disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
