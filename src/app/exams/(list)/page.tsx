"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import { supabase } from "@/lib/supabase"
import { useProfile } from "@/hooks/use-auth"
import { useTranslation } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  FileText,
  ListOrdered,
  Timer,
  RotateCcw,
  ChevronRight,
  Clock,
  Settings,
  ChevronDown,
  LogOut,
  X,
  Lock,
} from "lucide-react"

export default function ExamsPage() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { t } = useTranslation()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [attemptData, setAttemptData] = useState<Record<string, { count: number; passedCount: number; passed: boolean | null }>>({})
  const [subscription, setSubscription] = useState<{ plan: { name: string; features: string[] }; end_date: string } | null>(null)
  const [plans, setPlans] = useState<{ id: string; name: string; description: string; price: number; duration_days: number; features: string[] }[]>([])
  const [subLoading, setSubLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [availableLangs, setAvailableLangs] = useState<string[]>(["nl"])
  const [studentLang, setStudentLang] = useState("nl")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const name = profile?.name || ""
  const email = profile?.email || ""
  const initials = (name || email)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const langLabels: Record<string, string> = {
    nl: "Nederlands", en: "English", ar: "العربية", fr: "Français",
    de: "Deutsch", tr: "Türkçe", pl: "Polski", es: "Español", it: "Italiano",
  }

  useEffect(() => {
    supabase.from("site_settings").select("languages").eq("id", 1).single().then(({ data, error }) => {
      if (error && error.code === "PGRST205") return
      if (data) setAvailableLangs(data.languages as string[] || ["nl"])
    })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("language").eq("id", user.id).single().then(({ data }) => {
          if (data?.language) setStudentLang(data.language)
        })
        supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .gte("end_date", new Date().toISOString())
          .order("end_date", { ascending: false })
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              setSubscription({
                plan: { name: "", features: [] },
                end_date: data[0].end_date as string,
              })
            }
            setSubLoading(false)
          })
      } else {
        setSubLoading(false)
      }
    }).catch(() => setSubLoading(false))
    supabase.from("subscription_plans").select("*").eq("is_active", true).order("duration_days", { ascending: true }).then(({ data }) => {
      if (data) setPlans(data as typeof plans)
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("subscription") === "success") {
      setStatusMessage({ type: "success", text: "Betaling gelukt! Abonnement wordt geactiveerd..." })
      window.history.replaceState({}, "", "/exams")

      // Poll until webhook creates the subscription (retries every 2s, up to 30s)
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { clearInterval(interval); return }

        const { data } = await supabase.from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id).eq("is_active", true).gte("end_date", new Date().toISOString())
          .order("end_date", { ascending: false }).limit(1)

        if (data && data.length > 0) {
          setSubscription({
            plan: { name: "", features: [] },
            end_date: data[0].end_date as string,
          })
          setStatusMessage({ type: "success", text: "Betaling gelukt! Je abonnement is geactiveerd." })
          clearInterval(interval)
        } else if (attempts > 15) {
          setStatusMessage({ type: "error", text: "Betaling verwerkt, maar activering duurt langer dan verwacht. Ververs de pagina of neem contact op." })
          clearInterval(interval)
        }
      }, 2000)
    } else if (params.get("subscription") === "cancelled") {
      setStatusMessage({ type: "error", text: "Betaling geannuleerd. Je kunt het later opnieuw proberen." })
      window.history.replaceState({}, "", "/exams")
    } else if (params.get("subscription") === "required") {
      setStatusMessage({ type: "error", text: "Je hebt een actief abonnement nodig om dit examen te maken." })
      window.history.replaceState({}, "", "/exams")
    }
  }, [])

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
    ["exams", "all"],
    async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*, exam_questions(count), course:courses(title, icon_name)")
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

  const handleLangChange = async (code: string) => {
    setStudentLang(code)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("profiles").update({ language: code }).eq("id", user.id)
    }
  }

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in")

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, userId: user.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Checkout failed")

      window.location.href = json.url
    } catch (e) {
      setStatusMessage({ type: "error", text: e instanceof Error ? e.message : "Subscription failed" })
      setSubscribing(null)
    }
  }

  const renderExamCard = (examData: Record<string, unknown>) => {
    const courseData = examData.course as Record<string, unknown> | undefined
    const questionCount = (examData.exam_questions as { count: number }[] | undefined)?.[0]?.count ?? 0
    const examId = examData.id as string
    const att = attemptData[examId]
    const hasStarted = att && att.count > 0
    const hasPassed = att?.passed === true
    const isComplete = att?.passed !== null
    const statusLabel = hasPassed ? t("exams.passed") : hasStarted && isComplete ? t("exams.failed") : hasStarted ? t("exams.inProgress") : t("exams.notStarted")
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
                    {t("exams.attempt", { n: att!.count })}
                  </span>
                )}
                {hasStarted && (
                  <span className={`px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold ${(att?.passedCount ?? 0) > 0 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                    {t("exams.passedCount", { passed: att!.passedCount, total: att!.count })}
                  </span>
                )}
              </div>
              <h3 className="text-headline-md md:text-headline-lg font-bold text-primary truncate">
                {examData.title as string}
              </h3>
              {courseData && (
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/courses/${examData.course_id}`) }}
                  className="text-label-sm text-on-surface-variant mt-0.5 hover:text-primary transition-colors text-left"
                >
                  {courseData.title as string}
                </button>
              )}
            </div>
            <div className="size-10 md:size-12 rounded-xl bg-primary-container/10 flex items-center justify-center shrink-0">
              <FileText size={20} className="md:size-6 text-primary" />
            </div>
          </div>

          <div className="flex items-center gap-5 mb-5">
            <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
              <ListOrdered size={16} />
              <span>{t("exams.questions", { n: questionCount })}</span>
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
  }

  return (
    <div className="flex flex-col min-h-full bg-surface">
      <div className="px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {availableLangs.map((code) => (
              <button
                key={code}
                onClick={() => handleLangChange(code)}
                className={`px-3 py-1.5 rounded-full text-label-sm font-bold transition-all active:scale-95 ${
                  studentLang === code
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {langLabels[code] || code.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 hover:bg-surface-container rounded-full py-1 pl-1 pr-2 transition-all active:scale-95"
            >
              <span className="size-10 md:size-11 rounded-full bg-primary flex items-center justify-center text-on-primary text-label-md font-bold shrink-0">
                {initials || "?"}
              </span>
              <span className="text-label-md font-semibold text-on-surface hidden sm:block max-w-[120px] truncate">{name || email}</span>
              <ChevronDown size={16} className="text-on-surface-variant" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-13 w-64 bg-surface shadow-lg rounded-2xl border border-outline-variant/30 overflow-hidden z-50">
                <div className="px-4 py-4 border-b border-outline-variant/20">
                  <p className="text-label-md font-bold text-primary truncate">{name || email}</p>
                  <p className="text-label-xs text-on-surface-variant truncate mt-0.5">{email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { router.push("/dashboard/settings"); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <Settings size={18} className="text-on-surface-variant" />
                    Instellingen
                  </button>
                </div>
                <div className="border-t border-outline-variant/20 py-1">
                  <button
                    onClick={() => { setDropdownOpen(false); setLogoutOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-label-md text-error hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    Uitloggen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mb-1">
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Exams</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Select a practice exam to start</p>
        </div>
      </div>

      {statusMessage && (
        <div className={`mx-4 sm:mx-6 mb-4 px-5 py-4 rounded-xl text-label-md font-bold ${
          statusMessage.type === "success"
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}>
          <div className="flex items-center gap-2">
            <span>{statusMessage.type === "success" ? "✓" : "✕"}</span>
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {examsLoading && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-label-sm text-on-surface-variant">Loading exams...</span>
          </div>
        </div>
      )}

      {!examsLoading && exams && exams.length > 0 && (
        <>
          {(() => {
            const allExams = exams as Record<string, unknown>[]
            const freeExams = allExams.filter((e) => e.is_free === true)
            const paidExams = allExams.filter((e) => e.is_free !== true)
            const showPaid = profile?.role !== "student" || subscription

            return (
              <div className="flex-1 px-4 sm:px-6 pb-4 space-y-6">
                {/* Free exams section */}
                {freeExams.length > 0 && (
                  <>
                    <h2 className="text-headline-sm font-bold text-primary">{t("exams.gratis")}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {freeExams.map((exam) => renderExamCard(exam))}
                    </div>
                  </>
                )}

                {/* Paid exams section */}
                {paidExams.length > 0 && (
                  <>
                    <h2 className="text-headline-sm font-bold text-primary">
                      {showPaid ? t("exams.all") : t("exams.premium")}
                    </h2>
                    {showPaid ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {paidExams.map((exam) => renderExamCard(exam))}
                      </div>
                    ) : (
                      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-8 text-center">
                        <Lock size={36} className="text-outline-variant mx-auto mb-3" />
                        <p className="text-body-lg text-primary font-semibold mb-1">{t("exams.unlockTitle")}</p>
                        <p className="text-body-md text-on-surface-variant mb-6 max-w-md mx-auto">
                          {t("exams.unlockDesc")}
                        </p>
                        {freeExams.length > 0 && (
                          <p className="text-label-sm text-on-surface-variant mb-6">
                            {t("exams.freeAvailable")}
                          </p>
                        )}
                        {plans.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                            {plans.map((plan) => (
                              <div key={plan.id} className="bg-surface rounded-xl border border-outline-variant/30 p-5 text-left">
                                <h3 className="text-headline-sm font-bold text-primary mb-1">{plan.name}</h3>
                                <p className="text-headline-lg font-bold text-primary mb-3">&euro;{plan.price.toFixed(2)}</p>
                                <div className="space-y-1.5 mb-5">
                                  {(plan.features as string[]).map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                                      <span className="size-1.5 rounded-full bg-primary shrink-0" />
                                      {f}
                                    </div>
                                  ))}
                                </div>
                                <button
                                  onClick={() => handleSubscribe(plan.id)}
                                  disabled={subscribing === plan.id}
                                  className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                                >
                                  {subscribing === plan.id ? (
                                    <span className="flex items-center justify-center gap-2">
                                      <Loader2 size={16} className="animate-spin" />
                                      {t("exams.loadingShort")}
                                    </span>
                                  ) : (
                                    t("exams.subscribe")
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}
        </>
      )}

      {!examsLoading && (!exams || exams.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-5">
          <div className="size-20 rounded-full bg-surface-container-low flex items-center justify-center mb-5">
            <FileText size={36} className="text-outline-variant" />
          </div>
          <p className="text-body-lg text-on-surface font-semibold mb-1">{t("exams.noExams")}</p>
          <p className="text-body-md text-on-surface-variant text-center">{t("exams.noExamsDesc")}</p>
        </div>
      )}

      {(profile?.role !== "student" || subscription) && (
      <div className="px-4 sm:px-6 pb-6 pt-2">
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 md:p-6 text-white">
          <div className="flex items-start md:items-center gap-4">
            <div className="size-12 md:size-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <RotateCcw size={24} className="md:size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-headline-md md:text-headline-lg font-bold mb-1">{t("exams.reviewTitle")}</h4>
              <p className="text-body-md opacity-85 leading-relaxed">
                {t("exams.reviewDesc")}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/exams/review")}
            className="mt-4 md:mt-5 w-full bg-white/20 rounded-xl py-3 px-4 flex items-center justify-between text-label-md font-bold active:bg-white/30 transition-colors hover:bg-white/30"
          >
            <span>{t("exams.reviewButton")}</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      )}
      {logoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setLogoutOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <button onClick={() => setLogoutOpen(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <X size={20} />
            </button>
            <h3 className="text-headline-md text-primary mb-2">{t("exams.logout")}</h3>
            <p className="text-body-md text-on-surface-variant mb-6">{t("exams.logoutConfirm")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLogoutOpen(false)} className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-all">
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push("/") }}
                className="px-5 py-2.5 rounded-xl bg-error text-on-error text-label-md font-bold hover:opacity-90 transition-all flex items-center gap-2"
              >
                <LogOut size={16} />
                {t("exams.logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
