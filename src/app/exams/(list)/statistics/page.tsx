"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js"
import { Radar } from "react-chartjs-2"
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  BookOpen,
  Lightbulb,
  AlertCircle,
  Eye,
  Target,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

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
  "Hazard Perception": AlertCircle,
  "Right of Way": TrendingUp,
  "Choose Images": Eye,
  Traffic: BookOpen,
  Lighting: Lightbulb,
}

const categoryColors: Record<string, string> = {
  "Hazard Perception": "bg-red-100 text-red-600",
  "Right of Way": "bg-green-100 text-green-600",
  "Choose Images": "bg-blue-100 text-blue-600",
  Traffic: "bg-purple-100 text-purple-600",
  Lighting: "bg-amber-100 text-amber-600",
}

const chartColors = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
]

export default function StatisticsPage() {
  const router = useRouter()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const perPage = 10

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr || !user) throw new Error("Niet ingelogd")
        const { data, error } = await supabase
          .from("exam_attempts")
          .select("id, exam_id, score, total_questions, passed, started_at, completed_at, category_scores")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
        if (error) throw error
        setAttempts((data as Attempt[]) ?? [])
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : String(e))
        setAttempts([])
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const completed = attempts.filter((a) => a.score != null && a.passed != null)
  const passedCount = completed.filter((a) => a.passed).length
  const totalCompleted = completed.length
  const passRate = totalCompleted > 0 ? Math.round((passedCount / totalCompleted) * 100) : 0
  const avgScore = (() => {
    if (completed.length === 0) return 0
    const total = completed.reduce((sum, a) => sum + ((a.score ?? 0) / (a.total_questions ?? 1)) * 100, 0)
    return Math.round(total / completed.length)
  })()

  const categoryStats: Record<string, { correct: number; total: number }> = {}
  completed.forEach((a) => {
    if (!a.category_scores) return
    const entries = Array.isArray(a.category_scores)
      ? a.category_scores.map((cs) => [cs.category, { correct: cs.correct, total: cs.total }] as const)
      : Object.entries(a.category_scores)
    entries.forEach(([category, cs]) => {
      if (!categoryStats[category]) categoryStats[category] = { correct: 0, total: 0 }
      categoryStats[category].correct += cs.correct
      categoryStats[category].total += cs.total
    })
  })

  const categories = Object.keys(categoryStats)
  const radarLabels = categories.length > 0 ? categories : ["Geen data"]
  const radarData = categories.length > 0
    ? categories.map((cat) => {
        const s = categoryStats[cat]
        return s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
      })
    : [0]

  const chartData = {
    labels: radarLabels,
    datasets: [
      {
        label: "Score %",
        data: radarData,
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        borderColor: "#6366f1",
        borderWidth: 2,
        pointBackgroundColor: chartColors.slice(0, radarLabels.length),
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
          font: { size: 10 },
        },
        grid: { color: "rgba(0,0,0,0.06)" },
        angleLines: { color: "rgba(0,0,0,0.06)" },
        pointLabels: {
          font: { size: 12, weight: "bold" as const },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { r: number } }) => `${ctx.parsed.r}%`,
        },
      },
    },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-[80vh] bg-surface p-4">
        <header className="bg-surface border-b border-outline-variant/50 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
          <button onClick={() => router.push("/exams")} className="size-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0 active:scale-95 transition-transform">
            <ArrowLeft size={20} className="text-primary" />
          </button>
          <h1 className="text-label-sm font-bold text-primary">Statistieken</h1>
        </header>
        <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 font-bold">Fout bij ophalen data:</p>
          <p className="text-red-600 mt-1">{fetchError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] bg-surface">
      <header className="bg-surface border-b border-outline-variant/50 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <button
          onClick={() => router.push("/exams")}
          className="size-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} className="text-primary" />
        </button>
        <h1 className="text-label-sm font-bold text-primary">Statistieken</h1>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 text-center">
            <BarChart3 size={24} className="text-primary mx-auto mb-2" />
            <p className="text-label-xs text-on-surface-variant">Examens</p>
            <p className="text-headline-md text-primary font-bold">{totalCompleted}</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 text-center">
            <Target size={24} className="text-green-600 mx-auto mb-2" />
            <p className="text-label-xs text-on-surface-variant">Slagings%</p>
            <p className="text-headline-md text-primary font-bold">{passRate}%</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 text-center">
            <TrendingUp size={24} className="text-blue-600 mx-auto mb-2" />
            <p className="text-label-xs text-on-surface-variant">Gem. Score</p>
            <p className="text-headline-md text-primary font-bold">{avgScore}%</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 text-center">
            <BookOpen size={24} className="text-purple-600 mx-auto mb-2" />
            <p className="text-label-xs text-on-surface-variant">Categorieën</p>
            <p className="text-headline-md text-primary font-bold">{categories.length}</p>
          </div>
        </div>

        {totalCompleted === 0 ? (
          <div className="text-center py-20">
            <BarChart3 size={48} className="text-outline-variant mx-auto mb-4" />
            <p className="text-body-lg text-on-surface-variant">Nog geen examens afgerond</p>
            <p className="text-label-sm text-on-surface-variant mt-1">Maak een examen om statistieken te zien</p>
          </div>
        ) : (
          <>
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6">
              <h2 className="text-label-md font-bold text-primary mb-4">Per categorie</h2>
              <div className="h-80">
                <Radar data={chartData} options={chartOptions} />
              </div>
              <div className="mt-4 space-y-3">
                {Object.entries(categoryStats)
                  .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))
                  .map(([cat, s]) => {
                    const percent = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                    const Icon = categoryIcons[cat] || BookOpen
                    const colorClass = categoryColors[cat] || "bg-surface-container text-primary"
                    return (
                      <div key={cat} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className={`size-9 rounded-lg flex items-center justify-center ${colorClass}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="text-label-sm font-bold text-primary">{cat}</p>
                            <p className="text-label-xs text-on-surface-variant">{s.correct}/{s.total} correct</p>
                          </div>
                        </div>
                        <span className="text-label-sm font-bold text-primary">{percent}%</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6">
              <h2 className="text-label-md font-bold text-primary mb-4">Recente examens</h2>
              <div className="space-y-3">
                {completed.slice(page * perPage, (page + 1) * perPage).map((a) => {
                  const pct = a.total_questions ? Math.round(((a.score ?? 0) / a.total_questions) * 100) : 0
                  const date = new Date(a.started_at).toLocaleDateString("nl-NL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                  return (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-full flex items-center justify-center ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {a.passed ? <TrendingUp size={14} /> : <BarChart3 size={14} />}
                        </div>
                        <div>
                          <p className="text-label-sm font-bold text-primary">{a.passed ? "Geslaagd" : "Gezakt"}</p>
                          <p className="text-label-xs text-on-surface-variant">{date}</p>
                        </div>
                      </div>
                      <span className={`text-label-sm font-bold ${pct >= 80 ? "text-green-600" : "text-red-600"}`}>
                        {a.score}/{a.total_questions}
                      </span>
                    </div>
                  )
                })}
              </div>
              {completed.length > perPage && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-outline-variant/20">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="size-9 rounded-xl bg-surface-container flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                  >
                    <ChevronLeft size={18} className="text-primary" />
                  </button>
                  {Array.from({ length: Math.ceil(completed.length / perPage) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`size-9 rounded-xl flex items-center justify-center text-label-sm font-bold transition-all active:scale-95 ${
                        i === page ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(Math.ceil(completed.length / perPage) - 1, p + 1))}
                    disabled={page >= Math.ceil(completed.length / perPage) - 1}
                    className="size-9 rounded-xl bg-surface-container flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                  >
                    <ChevronRight size={18} className="text-primary" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
