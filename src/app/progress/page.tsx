"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
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
import { Line, Bar, Radar } from "react-chartjs-2"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Flame,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BookOpen,
  Eye,
  Lightbulb,
  BarChart3,
  Clock,
  Loader2,
  Zap,
} from "lucide-react"

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
  category_scores:
    | { category: string; correct: number; total: number }[]
    | Record<string, { correct: number; total: number }>
    | null
}

const categoryIcons: Record<string, typeof BarChart3> = {
  "Hazard Perception": AlertTriangle,
  "Right of Way": TrendingUp,
  "Choose Images": Eye,
  Traffic: BookOpen,
  Lighting: Lightbulb,
}

const categoryBg: Record<string, string> = {
  "Hazard Perception": "bg-red-100 text-red-600",
  "Right of Way": "bg-green-100 text-green-600",
  "Choose Images": "bg-blue-100 text-blue-600",
  Traffic: "bg-purple-100 text-purple-600",
  Lighting: "bg-amber-100 text-amber-600",
}

const chartPalette = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4",
  "#ec4899", "#8b5cf6", "#14b8a6",
]

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function ProgressPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const { data, error: err } = await supabase
          .from("exam_attempts")
          .select("id, exam_id, score, total_questions, passed, started_at, completed_at, category_scores")
          .order("started_at", { ascending: true })
        if (err) throw err
        setAttempts((data as Attempt[]) ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    fetchAttempts()
  }, [])

  const completed = useMemo(
    () => attempts.filter((a) => a.score != null && a.passed != null),
    [attempts],
  )

  const totalAttempts = attempts.length
  const totalCompleted = completed.length
  const passedCount = completed.filter((a) => a.passed).length
  const failedCount = totalCompleted - passedCount
  const passRate = totalCompleted > 0 ? Math.round((passedCount / totalCompleted) * 100) : 0
  const avgScore = useMemo(() => {
    if (completed.length === 0) return 0
    const sum = completed.reduce((s, a) => s + ((a.score ?? 0) / (a.total_questions ?? 1)) * 100, 0)
    return Math.round(sum / completed.length)
  }, [completed])

  const bestScore = useMemo(() => {
    if (completed.length === 0) return 0
    return Math.max(...completed.map((a) => Math.round(((a.score ?? 0) / (a.total_questions ?? 1)) * 100)))
  }, [completed])

  const streak = useMemo(() => {
    if (completed.length === 0) return 0
    const days = new Set(
      completed.map((a) => new Date(a.completed_at ?? a.started_at).toDateString()),
    )
    let count = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (days.has(d.toDateString())) {
        count++
      } else if (i > 0) {
        break
      }
    }
    return count
  }, [completed])

  const longestStreak = useMemo(() => {
    if (completed.length === 0) return 0
    const days = Array.from(
      new Set(
        completed.map((a) => new Date(a.completed_at ?? a.started_at).toDateString()),
      ),
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    let max = 1
    let current = 1
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1])
      const cur = new Date(days[i])
      const diff = (prev.getTime() - cur.getTime()) / 86400000
      if (diff === 1) {
        current++
        max = Math.max(max, current)
      } else {
        current = 1
      }
    }
    return days.length > 0 ? max : 0
  }, [completed])

  const categoryStats = useMemo(() => {
    const stats: Record<string, { correct: number; total: number }> = {}
    completed.forEach((a) => {
      if (!a.category_scores) return
      const entries = Array.isArray(a.category_scores)
        ? a.category_scores.map((cs) => [cs.category, { correct: cs.correct, total: cs.total }] as const)
        : Object.entries(a.category_scores)
      entries.forEach(([cat, cs]) => {
        if (!stats[cat]) stats[cat] = { correct: 0, total: 0 }
        stats[cat].correct += cs.correct
        stats[cat].total += cs.total
      })
    })
    return stats
  }, [completed])

  const categoryPercentages = useMemo(() => {
    return Object.entries(categoryStats)
      .map(([cat, s]) => ({
        category: cat,
        percent: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        correct: s.correct,
        total: s.total,
      }))
      .sort((a, b) => a.percent - b.percent)
  }, [categoryStats])

  const weakCategories = categoryPercentages.filter((c) => c.percent < 70)
  const strongCategories = categoryPercentages.filter((c) => c.percent >= 80)

  const scoreTrendData = useMemo(() => {
    const labels = completed.map((a, i) => {
      const d = new Date(a.completed_at ?? a.started_at)
      return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" })
    })
    const scores = completed.map((a) =>
      Math.round(((a.score ?? 0) / (a.total_questions ?? 1)) * 100),
    )

    return {
      labels,
      datasets: [
        {
          label: "Score %",
          data: scores,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          borderWidth: 2,
          pointBackgroundColor: scores.map((s) => (s >= 80 ? "#22c55e" : "#ef4444")),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.3,
        },
      ],
    }
  }, [completed])

  const scoreTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, font: { size: 11 }, callback: (v: number | string) => `${v}%` },
        grid: { color: "rgba(0,0,0,0.04)" },
      },
      x: {
        ticks: { font: { size: 10 }, maxRotation: 45 },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => `Score: ${ctx.parsed.y}%`,
        },
      },
    },
  }

  const categoryBarData = useMemo(() => ({
    labels: categoryPercentages.map((c) => c.category),
    datasets: [
      {
        label: "Score %",
        data: categoryPercentages.map((c) => c.percent),
        backgroundColor: categoryPercentages.map((_, i) => chartPalette[i % chartPalette.length] + "80"),
        borderColor: categoryPercentages.map((_, i) => chartPalette[i % chartPalette.length]),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  }), [categoryPercentages])

  const categoryBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, font: { size: 11 }, callback: (v: number | string) => `${v}%` },
        grid: { color: "rgba(0,0,0,0.04)" },
      },
      y: {
        ticks: { font: { size: 11, weight: "bold" as const } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { x: number | null } }) => `${ctx.parsed.x}%`,
        },
      },
    },
  }

  const radarData = useMemo(() => {
    const cats = categoryPercentages.length > 0 ? categoryPercentages : [{ category: "Geen data", percent: 0 }]
    return {
      labels: cats.map((c) => c.category),
      datasets: [
        {
          label: "Score %",
          data: cats.map((c) => c.percent),
          backgroundColor: "rgba(99, 102, 241, 0.2)",
          borderColor: "#6366f1",
          borderWidth: 2,
          pointBackgroundColor: cats.map((_, i) => chartPalette[i % chartPalette.length]),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
        },
      ],
    }
  }, [categoryPercentages])

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, font: { size: 10 } },
        grid: { color: "rgba(0,0,0,0.06)" },
        angleLines: { color: "rgba(0,0,0,0.06)" },
        pointLabels: { font: { size: 11, weight: "bold" as const } },
      },
    },
    plugins: { legend: { display: false } },
  }

  const activityDays = useMemo(() => {
    const days: Record<string, number> = {}
    completed.forEach((a) => {
      const d = new Date(a.completed_at ?? a.started_at).toDateString()
      days[d] = (days[d] || 0) + 1
    })
    return days
  }, [completed])

  const recentActivity = useMemo(() => {
    return [...completed]
      .sort((a, b) => new Date(b.completed_at ?? b.started_at).getTime() - new Date(a.completed_at ?? a.started_at).getTime())
      .slice(0, 7)
  }, [completed])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[80vh] p-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 font-bold">Fout: {error}</p>
        </div>
      </div>
    )
  }

  if (totalCompleted === 0) {
    return (
      <div className="min-h-[80vh] bg-surface">
        <header className="bg-surface border-b border-outline-variant/50 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
          <button onClick={() => router.push("/exams")} className="size-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0 active:scale-95 transition-transform">
            <ArrowLeft size={20} className="text-primary" />
          </button>
          <h1 className="text-label-sm font-bold text-primary">{t("progress.title")}</h1>
        </header>
        <div className="text-center py-20">
          <BarChart3 size={48} className="text-outline-variant mx-auto mb-4" />
          <p className="text-body-lg text-on-surface-variant">{t("progress.noData")}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">{t("progress.takeFirst")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] bg-surface">
      <header className="bg-surface border-b border-outline-variant/50 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <button onClick={() => router.push("/exams")} className="size-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <ArrowLeft size={20} className="text-primary" />
        </button>
        <h1 className="text-label-sm font-bold text-primary">{t("progress.title")}</h1>
      </header>

      <main className="px-4 py-6 max-w-5xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: Target, label: t("progress.totalExams"), value: totalAttempts, color: "text-primary" },
            { icon: CheckCircle2, label: t("progress.passed"), value: passedCount, color: "text-green-600" },
            { icon: XCircle, label: t("progress.failed"), value: failedCount, color: "text-red-600" },
            { icon: TrendingUp, label: t("progress.passRate"), value: `${passRate}%`, color: passRate >= 80 ? "text-green-600" : "text-amber-600" },
            { icon: Zap, label: t("progress.avgScore"), value: `${avgScore}%`, color: "text-primary" },
            { icon: Flame, label: t("progress.bestScore"), value: `${bestScore}%`, color: "text-orange-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 text-center">
              <Icon size={20} className={`${color} mx-auto mb-1.5`} />
              <p className="text-label-xs text-on-surface-variant">{label}</p>
              <p className={`text-headline-md ${color} font-bold`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Streak Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={24} />
              <span className="text-label-md font-bold">{t("progress.currentStreak")}</span>
            </div>
            <p className="text-headline-lg font-bold">{streak} {streak === 1 ? "dag" : "dagen"}</p>
            <p className="text-label-xs opacity-80 mt-1">{t("progress.streakDesc")}</p>
          </div>
          <div className="bg-gradient-to-br from-primary to-primary-container rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={24} />
              <span className="text-label-md font-bold">{t("progress.longestStreak")}</span>
            </div>
            <p className="text-headline-lg font-bold">{longestStreak} {longestStreak === 1 ? "dag" : "dagen"}</p>
            <p className="text-label-xs opacity-80 mt-1">{t("progress.longestStreakDesc")}</p>
          </div>
        </div>

        {/* Score Trend */}
        {completed.length >= 2 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6">
            <h2 className="text-label-md font-bold text-primary mb-4">{t("progress.scoreTrend")}</h2>
            <div className="h-64">
              <Line data={scoreTrendData} options={scoreTrendOptions} />
            </div>
          </div>
        )}

        {/* Category Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {categoryPercentages.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6">
              <h2 className="text-label-md font-bold text-primary mb-4">{t("progress.categoryPerformance")}</h2>
              <div className="h-64">
                <Bar data={categoryBarData} options={categoryBarOptions} />
              </div>
            </div>
          )}
          {categoryPercentages.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6">
              <h2 className="text-label-md font-bold text-primary mb-4">{t("progress.categoryRadar")}</h2>
              <div className="h-64">
                <Radar data={radarData} options={radarOptions} />
              </div>
            </div>
          )}
        </div>

        {/* Weak Categories */}
        {weakCategories.length > 0 && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-red-600" />
              <h2 className="text-label-md font-bold text-red-700">{t("progress.weakCategories")}</h2>
            </div>
            <div className="space-y-3">
              {weakCategories.map((c) => (
                <div key={c.category} className="flex items-center justify-between bg-white rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-lg flex items-center justify-center ${categoryBg[c.category] || "bg-gray-100 text-gray-600"}`}>
                      {(() => { const Icon = categoryIcons[c.category] || BookOpen; return <Icon size={18} /> })()}
                    </div>
                    <div>
                      <p className="text-label-md font-bold text-on-surface">{c.category}</p>
                      <p className="text-label-xs text-on-surface-variant">{c.correct}/{c.total} {t("progress.correctAnswers")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-headline-sm font-bold text-red-600">{c.percent}%</span>
                    <p className="text-label-xs text-red-500">{t("progress.needsWork")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strong Categories */}
        {strongCategories.length > 0 && (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={20} className="text-green-600" />
              <h2 className="text-label-md font-bold text-green-700">{t("progress.strongCategories")}</h2>
            </div>
            <div className="space-y-2">
              {strongCategories.map((c) => (
                <div key={c.category} className="flex items-center justify-between bg-white rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-8 rounded-lg flex items-center justify-center ${categoryBg[c.category] || "bg-gray-100 text-gray-600"}`}>
                      {(() => { const Icon = categoryIcons[c.category] || BookOpen; return <Icon size={14} /> })()}
                    </div>
                    <span className="text-label-sm font-bold text-on-surface">{c.category}</span>
                  </div>
                  <span className="text-label-sm font-bold text-green-600">{c.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6">
            <h2 className="text-label-md font-bold text-primary mb-4">{t("progress.recentActivity")}</h2>
            <div className="space-y-3">
              {recentActivity.map((a) => {
                const pct = a.total_questions ? Math.round(((a.score ?? 0) / a.total_questions) * 100) : 0
                const date = new Date(a.completed_at ?? a.started_at)
                const timeAgoStr = (() => {
                  const diff = Date.now() - date.getTime()
                  const min = Math.floor(diff / 60000)
                  if (min < 60) return `${min}m geleden`
                  const hr = Math.floor(min / 60)
                  if (hr < 24) return `${hr}u geleden`
                  const day = Math.floor(hr / 24)
                  return `${day}d geleden`
                })()
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-full flex items-center justify-center ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {a.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      </div>
                      <div>
                        <p className="text-label-sm font-bold text-primary">{a.passed ? t("progress.passedLabel") : t("progress.failedLabel")}</p>
                        <p className="text-label-xs text-on-surface-variant">{timeAgoStr}</p>
                      </div>
                    </div>
                    <span className={`text-label-sm font-bold ${pct >= 80 ? "text-green-600" : "text-red-600"}`}>
                      {a.score}/{a.total_questions}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
