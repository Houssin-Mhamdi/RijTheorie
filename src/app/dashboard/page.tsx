"use client"

import { useProfile } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import type { Course, Profile } from "@/types/database"
import { BookOpen, Users, FileText, GraduationCap, BarChart3, CheckCircle, XCircle, AlertCircle, Clock, TrendingUp } from "lucide-react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { Bar, Doughnut, Line } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler)

export default function DashboardPage() {
  const { data: profile } = useProfile()

  const { data: courses } = useSupabaseQuery<Course[]>(
    ["courses", "all"],
    async () => { const { data, error } = await supabase.from("courses").select("*").order("created_at"); return { data, error } },
  )

  const { data: exams } = useSupabaseQuery(
    ["exams", "all"],
    async () => { const { data, error } = await supabase.from("exams").select("*"); return { data, error } },
  )

  const { data: allProfiles } = useSupabaseQuery<Profile[]>(
    ["profiles", "all"],
    async () => { const { data, error } = await supabase.from("profiles").select("*"); return { data, error } },
  )

  const { data: questionsData } = useSupabaseQuery(
    ["questions", "all"],
    async () => { const { data, error } = await supabase.from("questions").select("category, answer_options"); return { data, error } },
  )

  const { data: examAttempts } = useSupabaseQuery(
    ["exam_attempts", "stats"],
    async () => {
      const { data, error } = await supabase.rpc("get_exam_stats_full")
      return { data, error }
    },
  )

  const { data: activeSubscriptions } = useSupabaseQuery<{ id: string }[]>(
    ["user_subscriptions", "active_count"],
    async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("is_active", true)
        .gt("end_date", new Date().toISOString())
      return { data, error }
    },
  )

  const totalCourses = courses?.length ?? 0
  const activeCourses = courses?.filter((c) => c.active !== false).length ?? 0
  const totalStudents = allProfiles?.filter((p) => p.role === "student").length ?? 0
  const totalExams = exams?.length ?? 0

  const activeStudentCount = activeSubscriptions?.length ?? 0

  const attempts = (examAttempts as Record<string, unknown>[] | undefined) ?? []
  const passedAttempts = attempts.filter((a) => a.passed === true).length
  const failedAttempts = attempts.filter((a) => a.passed === false).length
  const pendingAttempts = attempts.filter((a) => a.passed == null).length
  const totalAttemptCount = attempts.length

  const MAX_EXAM_MS = 3 * 3600000
  const avgStudyHours = (() => {
    const completed = attempts.filter((a: Record<string, unknown>) => a.started_at && a.completed_at)
    if (completed.length === 0) return "0"
    const totalMs = completed.reduce((sum: number, a: Record<string, unknown>) => {
      const diff = new Date(a.completed_at as string).getTime() - new Date(a.started_at as string).getTime()
      return sum + Math.min(diff, MAX_EXAM_MS)
    }, 0)
    return (totalMs / completed.length / 3600000).toFixed(1)
  })()

  const stats = [
    { label: "Totaal cursussen", value: totalCourses, icon: FileText, color: "text-blue-600 bg-blue-100" },
    { label: "Actief", value: activeCourses, icon: BookOpen, color: "text-green-600 bg-green-100" },
    { label: "Studenten", value: totalStudents, icon: Users, color: "text-purple-600 bg-purple-100" },
    { label: "Actieve abonnementen", value: activeStudentCount, icon: GraduationCap, color: "text-emerald-600 bg-emerald-100" },
    { label: "Examens", value: totalExams, icon: BarChart3, color: "text-orange-600 bg-orange-100" },
    { label: "Gem. studietijd", value: `${avgStudyHours}h`, icon: Clock, color: "text-cyan-600 bg-cyan-100" },
  ]

  const avgScore = (() => {
    const completed = attempts.filter((a) => a.score != null && a.total_questions != null)
    if (completed.length === 0) return null
    const total = completed.reduce((sum: number, a) => sum + ((a.score as number) / (a.total_questions as number)) * 100, 0)
    return Math.round(total / completed.length)
  })()

  const categoryIncorrectRanking = (() => {
    const agg: Record<string, { correct: number; total: number }> = {}
    attempts.forEach((a: Record<string, unknown>) => {
      const cs = a.category_scores
      if (!cs) return
      const entries = Array.isArray(cs)
        ? (cs as { category: string; correct: number; total: number }[]).map((c) => [c.category, { correct: c.correct, total: c.total }] as const)
        : Object.entries(cs as Record<string, { correct: number; total: number }>)
      entries.forEach(([category, s]) => {
        if (!agg[category]) agg[category] = { correct: 0, total: 0 }
        agg[category].correct += s.correct
        agg[category].total += s.total
      })
    })
    return Object.entries(agg)
      .map(([category, s]) => ({ category, correct: s.correct, total: s.total, incorrect: s.total - s.correct }))
      .sort((a, b) => b.incorrect - a.incorrect)
  })()

  const topProblemCategories = categoryIncorrectRanking.slice(0, 5)

  const studentGrowth = (() => {
    const students = (allProfiles ?? []).filter((p) => p.role === "student")
    const grouped: Record<string, number> = {}
    students.forEach((s) => {
      const m = new Date(s.created_at).toLocaleDateString("nl-NL", { month: "short", year: "2-digit" })
      grouped[m] = (grouped[m] || 0) + 1
    })
    const sorted = Object.entries(grouped).sort((a, b) => {
      const [mA, yA] = a[0].split(" ")
      const [mB, yB] = b[0].split(" ")
      const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
      return yA !== yB ? Number(yA) - Number(yB) : months.indexOf(mA) - months.indexOf(mB)
    })
    let cum = 0
    return sorted.map(([month, count]) => { cum += count; return { month, count: cum } })
  })()

  const studentGrowthData = {
    labels: studentGrowth.map((d) => d.month),
    datasets: [{
      label: "Totaal studenten",
      data: studentGrowth.map((d) => d.count),
      borderColor: "#8b5cf6",
      backgroundColor: "rgba(139,92,246,0.1)",
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  }

  const questionsByCategory = (() => {
    const qs = (questionsData as Record<string, unknown>[] | undefined) ?? []
    const counts: Record<string, number> = {}
    qs.forEach((q) => {
      const cat = (q.category as string) || "Unknown"
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  })()

  const attemptsOverTime = (() => {
    const grouped: Record<string, { total: number; passed: number }> = {}
    attempts.forEach((a) => {
      const date = new Date(a.started_at as string).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" })
      if (!grouped[date]) grouped[date] = { total: 0, passed: 0 }
      grouped[date].total++
      if (a.passed) grouped[date].passed++
    })
    const sorted = Object.entries(grouped).sort((a, b) => {
      const [dA, mA] = a[0].split("/").map(Number)
      const [dB, mB] = b[0].split("/").map(Number)
      return mA !== mB ? mA - mB : dA - dB
    })
    return sorted
  })()

  const passRateData = {
    labels: ["Geslaagd", "Gezakt", "Bezig"],
    datasets: [{
      data: [passedAttempts, failedAttempts, pendingAttempts],
      backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
      borderWidth: 0,
      borderRadius: 4,
    }],
  }

  const categoryData = {
    labels: Object.keys(questionsByCategory),
    datasets: [{
      label: "Vragen",
      data: Object.values(questionsByCategory),
      backgroundColor: ["#6366f1", "#06b6d4", "#f59e0b", "#ef4444", "#22c55e", "#ec4899", "#8b5cf6", "#14b8a6"],
      borderRadius: 6,
      borderWidth: 0,
    }],
  }

  const attemptsOverTimeData = {
    labels: attemptsOverTime.map(([date]) => date),
    datasets: [
      {
        label: "Totaal",
        data: attemptsOverTime.map(([, d]) => d.total),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: "Geslaagd",
        data: attemptsOverTime.map(([, d]) => d.passed),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }

  return (
    <div className="px-4 md:px-6 py-8">
      <h1 className="text-headline-lg text-primary mb-2">Welkom, {profile?.name ?? "Admin"}</h1>
      <p className="text-body-md text-on-surface-variant mb-8">Overzicht van je RijTheorie Pro platform</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-outline-variant/20 bg-surface p-6">
            <div className={`inline-flex p-3 rounded-lg ${stat.color} mb-4`}>
              <stat.icon size={24} />
            </div>
            <p className="text-display-lg text-primary">{stat.value}</p>
            <p className="text-body-md text-on-surface-variant">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-outline-variant/20 bg-surface p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-primary" />
            <h2 className="text-headline-sm text-primary">Examens over tijd</h2>
          </div>
          {attemptsOverTime.length > 0 ? (
            <Line data={attemptsOverTimeData} options={{ responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
          ) : (
            <p className="text-on-surface-variant text-body-md py-8 text-center">Nog geen examens afgelegd</p>
          )}
        </div>

        <div className="rounded-xl border border-outline-variant/20 bg-surface p-6">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle size={20} className="text-green-600" />
            <h2 className="text-headline-sm text-primary">Slagingspercentage</h2>
          </div>
          {totalAttemptCount > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-48 h-48 sm:w-64 sm:h-64 shrink-0">
                <Doughnut data={passRateData} options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: "bottom" } }, cutout: "60%" }} />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-body-md"><span className="size-3 rounded-full bg-green-500" /> Geslaagd</span>
                  <span className="font-bold text-green-600">{passedAttempts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-body-md"><span className="size-3 rounded-full bg-red-500" /> Gezakt</span>
                  <span className="font-bold text-red-600">{failedAttempts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-body-md"><span className="size-3 rounded-full bg-amber-500" /> Bezig</span>
                  <span className="font-bold text-amber-600">{pendingAttempts}</span>
                </div>
                <div className="pt-2 border-t border-outline-variant/30">
                  <span className="text-body-md text-on-surface-variant">Slagingsgraad</span>
                  <p className="text-headline-sm text-primary font-bold">{avgScore !== null ? `${avgScore}%` : "—"}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-on-surface-variant text-body-md py-8 text-center">Nog geen examens afgelegd</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-2xl bg-surface-container-lowest shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-headline-sm text-primary">Studentengroei</h2>
              <p className="text-label-xs text-on-surface-variant">Cumulatief over tijd</p>
            </div>
          </div>
          {studentGrowth.length > 0 ? (
            <div className="h-64">
              <Line data={studentGrowthData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } }, x: { ticks: { font: { size: 11 } } } } }} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant">
              <TrendingUp size={40} className="opacity-30 mb-3" />
              <p className="text-body-md">Nog geen studenten</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-surface-container-lowest shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <BarChart3 size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-headline-sm text-primary">Vragen per categorie</h2>
              <p className="text-label-xs text-on-surface-variant">{Object.keys(questionsByCategory).length} categorie&euml;n</p>
            </div>
          </div>
          {Object.keys(questionsByCategory).length > 0 ? (
            <div className="h-64">
              <Bar data={categoryData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } }, x: { ticks: { font: { size: 11 } } } } }} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant">
              <BarChart3 size={40} className="opacity-30 mb-3" />
              <p className="text-body-md">Nog geen vragen aangemaakt</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={20} className="text-red-500" />
          <h2 className="text-headline-sm text-primary">Meest foutieve categorie&euml;n</h2>
        </div>
        {topProblemCategories.length > 0 ? (
          <div className="space-y-3">
            {topProblemCategories.map((cat, i) => {
              const pct = cat.total > 0 ? Math.round((cat.incorrect / cat.total) * 100) : 0
              return (
                <div key={cat.category} className="flex items-center gap-4">
                  <span className="size-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-label-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-label-sm font-bold text-primary truncate">{cat.category}</span>
                      <span className="text-label-sm text-red-600 font-bold shrink-0 ml-2">{pct}% fout</span>
                    </div>
                    <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-label-xs text-on-surface-variant mt-0.5">
                      {cat.incorrect} van {cat.total} vragen foutief beantwoord
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-on-surface-variant text-body-md py-4 text-center">Nog geen examenresultaten beschikbaar</p>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface p-6">
        <h2 className="text-headline-sm text-primary mb-4">Snel acties</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/lessons" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-body-md hover:opacity-90 transition-opacity">
            Cursussen beheren
          </a>
          <a href="/questions" className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-body-md hover:opacity-90 transition-opacity">
            Vragen beheren
          </a>
          <a href="/students" className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg text-body-md hover:opacity-90 transition-opacity">
            Studenten bekijken
          </a>
        </div>
      </div>
    </div>
  )
}
