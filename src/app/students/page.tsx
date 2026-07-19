"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Users, BadgeCheck, TrendingUp, ChevronLeft, ChevronRight, MoreHorizontal, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import DataTable from "@/components/ui/data-table"
import type { Column } from "@/components/ui/data-table"
import { supabase } from "@/lib/supabase"
import { useTranslation } from "@/lib/i18n/translations"
import type { Profile } from "@/types/database"

const ITEMS_PER_PAGE = 5

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div className={`size-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 ${className ?? ""}`}>
      {initials}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 py-1 bg-surface-variant text-primary text-label-sm font-bold rounded-full whitespace-nowrap">
      {children}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const isComplete = value >= 100
  return (
    <div className="flex items-center gap-3 w-full min-w-[120px]">
      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isComplete ? "bg-green-600" : "bg-secondary-container"}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className={`text-label-md font-bold shrink-0 ${isComplete ? "text-green-700" : "text-primary"}`}>
        {value}%
      </span>
    </div>
  )
}

function Pagination({ currentPage, totalPages, totalItems, onPageChange }: {
  currentPage: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}) {
  const from = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const to = Math.min(currentPage * ITEMS_PER_PAGE, totalItems)

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-label-md text-on-surface-variant">
        Showing {from} to {to} of {totalItems} students
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft size={18} />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        ))}
        <Button variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  )
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2) || "?"
}

type StudentWithProgress = Pick<Profile, "id" | "email" | "name" | "created_at" | "last_active_at"> & { progress: number }

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

export default function StudentsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name, created_at, last_active_at")
        .eq("role", "student")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as Pick<Profile, "id" | "email" | "name" | "created_at" | "last_active_at">[]
    },
  })

  const { data: totalExams = 0 } = useQuery({
    queryKey: ["exams-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("exams")
        .select("*", { count: "exact", head: true })
      if (error) throw error
      return count ?? 0
    },
  })

  const { data: allExamAttempts = [] } = useQuery({
    queryKey: ["all-exam-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("user_id, exam_id, passed, completed_at")
        .not("completed_at", "is", null)
      if (error) throw error
      return data as { user_id: string; exam_id: string; passed: boolean; completed_at: string }[]
    },
  })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: newStudents } = useQuery({
    queryKey: ["new-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .gte("created_at", thirtyDaysAgo)
      if (error) throw error
      return data
    },
  })

  const { data: subscriptions } = useQuery({
    queryKey: ["all-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("id, start_date, end_date, is_active")
        .order("start_date", { ascending: false })
      if (error) throw error
      return data as { id: string; start_date: string; end_date: string; is_active: boolean }[]
    },
  })

  const newSubscriptions = subscriptions?.filter((s) => new Date(s.start_date) >= new Date(thirtyDaysAgo)).length ?? 0
  const expiredSubscriptions = subscriptions?.filter((s) => !s.is_active || new Date(s.end_date) < new Date()).length ?? 0

  const mostActiveStudent = useMemo(() => {
    const counts: Record<string, { id: string; name: string; count: number }> = {}
    for (const a of allExamAttempts) {
      if (!counts[a.user_id]) counts[a.user_id] = { id: a.user_id, name: "", count: 0 }
      counts[a.user_id].count++
    }
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count)
    if (sorted.length === 0) return null
    const student = students.find((s) => s.id === sorted[0].id)
    if (student) sorted[0].name = student.name || student.email
    return sorted[0]
  }, [allExamAttempts, students])

  const studentsWithProgress: StudentWithProgress[] = useMemo(() => {
    if (totalExams === 0) return students.map((s) => ({ ...s, progress: 0 }))
    const passedExams: Record<string, Set<string>> = {}
    for (const a of allExamAttempts) {
      if (!a.passed) continue
      if (!passedExams[a.user_id]) passedExams[a.user_id] = new Set()
      passedExams[a.user_id].add(a.exam_id)
    }
    return students.map((s) => ({
      ...s,
      progress: Math.min(100, Math.round(((passedExams[s.id]?.size ?? 0) / totalExams) * 100)),
    }))
  }, [students, allExamAttempts, totalExams])

  const examStats = useMemo(() => {
    const stats: Record<string, { total: number; passed: number }> = {}
    for (const a of allExamAttempts) {
      if (!stats[a.user_id]) stats[a.user_id] = { total: 0, passed: 0 }
      stats[a.user_id].total++
      if (a.passed) stats[a.user_id].passed++
    }
    return stats
  }, [allExamAttempts])

  const totalAttempts = allExamAttempts.length
  const totalPassed = allExamAttempts.filter((a) => a.passed).length

  const totalStudents = students.length
  const avgProgress = totalStudents > 0
    ? Math.round(studentsWithProgress.reduce((sum, s) => sum + s.progress, 0) / totalStudents)
    : 0
  const fullyPassed = studentsWithProgress.filter((s) => s.progress >= 100).length

  const isLoading = studentsLoading

  const filteredStudents = studentsWithProgress
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE)
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const columns: Column<StudentWithProgress>[] = [
    {
      header: "Name",
      accessor: "name",
      render: (_, row) => (
        <button onClick={() => router.push(`/students/${row.id}`)} className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left">
          <Avatar initials={getInitials(row.name || row.email)} />
          <span className="text-body-md font-semibold text-primary">{row.name || row.email}</span>
        </button>
      ),
    },
    {
      header: "Email",
      accessor: "email",
      className: "text-body-md text-on-surface-variant",
    },
    {
      header: "Progress",
      accessor: "progress",
      className: "min-w-[160px]",
      render: (value) => <ProgressBar value={value as number} />,
    },
    {
      header: "Last Active",
      accessor: "last_active_at",
      className: "text-body-md text-on-surface-variant",
      render: (value) => timeAgo(value as string | null),
    },
    {
      header: t("students.exams"),
      accessor: "id",
      className: "text-body-md text-on-surface-variant",
      render: (value) => {
        const s = examStats[value as string]
        if (!s) return <span className="text-label-sm text-outline-variant">—</span>
        return (
          <span className={`text-label-sm font-bold ${s.passed > 0 ? "text-green-700" : "text-on-surface-variant"}`}>
            {t("students.passedCount", { passed: s.passed, total: s.total })}
          </span>
        )
      },
    },
  ]

  return (
    <section className="px-4 md:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <nav className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
            <span>Dashboard</span>
            <span className="text-[16px]">/</span>
            <span className="text-primary font-bold">Students</span>
          </nav>
          <h2 className="text-headline-lg text-primary">Student Overview</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Manage all enrolled students and their progress.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-primary/10 text-primary rounded-lg inline-flex mb-4">
            <Users size={20} />
          </div>
          <p className="text-label-md text-on-surface-variant">Total Students</p>
          <h3 className="text-headline-md text-primary mt-1">{totalStudents}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-secondary-container/10 text-secondary rounded-lg inline-flex mb-4">
            <FileText size={20} />
          </div>
          <p className="text-label-md text-on-surface-variant">Exam Attempts</p>
          <h3 className="text-headline-md text-primary mt-1">{totalAttempts}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-green-100 text-green-700 rounded-lg inline-flex mb-4">
            <BadgeCheck size={20} />
          </div>
          <p className="text-label-md text-on-surface-variant">{t("students.passed")}</p>
          <h3 className="text-headline-md text-primary mt-1">{totalPassed}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-error-container/20 text-error rounded-lg inline-flex mb-4">
            <TrendingUp size={20} />
          </div>
          <p className="text-label-md text-on-surface-variant">Avg Progress</p>
          <h3 className="text-headline-md text-primary mt-1">{avgProgress}%</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-cyan-100 text-cyan-700 rounded-lg inline-flex mb-4">
            <Users size={20} />
          </div>
          <p className="text-label-md text-on-surface-variant">{t("students.new30d")}</p>
          <h3 className="text-headline-md text-primary mt-1">{newStudents?.length ?? 0}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg inline-flex mb-4">
            <BadgeCheck size={20} />
          </div>
          <p className="text-label-md text-on-surface-variant">{t("students.newSubs30d")}</p>
          <h3 className="text-headline-md text-primary mt-1">{newSubscriptions}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-red-100 text-red-700 rounded-lg inline-flex mb-4">
            <TrendingUp size={20} className="rotate-180" />
          </div>
          <p className="text-label-md text-on-surface-variant">{t("students.expiredSubs")}</p>
          <h3 className="text-headline-md text-primary mt-1">{expiredSubscriptions}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-lg inline-flex mb-4">
            <TrendingUp size={20} />
          </div>
          <p className="text-label-md text-on-surface-variant">{t("students.mostActive")}</p>
          <h3 className="text-headline-md text-primary mt-1">
            {mostActiveStudent ? `${mostActiveStudent.count}` : "—"}
          </h3>
          <p className="text-label-xs text-on-surface-variant mt-1 truncate">
            {mostActiveStudent ? mostActiveStudent.name : t("students.noData")}
          </p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container overflow-hidden">
        <div className="p-6 border-b border-outline-variant/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-headline-md text-primary">Student List</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-label-md text-on-surface-variant">{totalStudents} students</span>
            <Button variant="outline" size="icon" className="p-2 border border-outline-variant rounded-xl">
              <MoreHorizontal size={16} />
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedStudents}
          keyFn={(row) => row.id}
          isLoading={isLoading}
        />

        <div className="p-6 border-t border-outline-variant/30">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredStudents.length}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </section>
  )
}
