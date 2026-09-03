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
  Infinity as InfinityIcon,
  RefreshCw,
} from "lucide-react"

type AttemptLimit = {
  max_attempts: number | null
  used_attempts: number | null
  remaining_attempts: number | null
  is_locked: boolean
}

export default function ExamsPage() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { t } = useTranslation()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [attemptData, setAttemptData] = useState<Record<string, { count: number; passedCount: number; passed: boolean | null }>>({})
  const [attemptLimits, setAttemptLimits] = useState<Record<string, AttemptLimit>>({})
  const [subscription, setSubscription] = useState<{ plan: { name: string; features: string[] }; end_date: string } | null>(null)
  const [plans, setPlans] = useState<{ id: string; name: string; description: string; price: number; duration_days: number; features: string[] }[]>([])
  const [subLoading, setSubLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Coupon state
  const [paymentExpanded, setPaymentExpanded] = useState(false)
  const [pendingActivation, setPendingActivation] = useState(false)
  const [couponInput, setCouponInput] = useState("")
  const [coupon, setCoupon] = useState<{ code: string; discount_percent: number; plan_ids: string[] } | null>(null)
  const [couponError, setCouponError] = useState("")
  const [couponLoading, setCouponLoading] = useState(false)

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponLoading(true)
    setCouponError("")
    try {
      const { data, error } = await supabase.rpc("validate_coupon_preview", { p_code: code })
      if (error || !data) throw new Error()
      const result = data as { valid: boolean; error?: string; discount_percent?: number; plan_ids?: string[] }
      if (!result.valid) {
        const errorKeys: Record<string, string> = {
          invalid: "coupons.invalid",
          inactive: "coupons.invalid",
          expired: "coupons.expired",
          limit_reached: "coupons.limit",
          already_used: "coupons.used",
        }
        setCouponError(t(errorKeys[result.error ?? "invalid"] ?? "coupons.invalid"))
        setCoupon(null)
        return
      }
      setCoupon({ code, discount_percent: result.discount_percent ?? 0, plan_ids: result.plan_ids ?? [] })
    } catch {
      setCouponError(t("coupons.invalid"))
      setCoupon(null)
    }
    setCouponLoading(false)
  }

  const clearCoupon = () => {
    setCoupon(null)
    setCouponInput("")
    setCouponError("")
  }

  const discountedPrice = (planId: string, price: number) =>
    coupon && coupon.plan_ids.includes(planId)
      ? Math.round(price * (100 - coupon.discount_percent)) / 100
      : price

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
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
      const code = params.get("code") ?? ""
      const sessionId = params.get("session_id") ?? ""
      setStatusMessage({ type: "success", text: "Betaling gelukt! Abonnement wordt geactiveerd..." })
      window.history.replaceState({}, "", "/exams")

      // For card payments the webhook fires almost instantly. For iDEAL the
      // bank confirmation is asynchronous (can take a couple of minutes), so
      // we poll longer and never tell the user their payment failed — we show
      // a friendly "pending activation" state and offer a manual refresh.
      let attempts = 0
      const maxAttempts = 120 // ~4 minutes
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
        } else if (attempts >= maxAttempts) {
          // Don't claim failure. The webhook may still be pending (iDEAL).
          setStatusMessage({ type: "success", text: "Betaling verwerkt. Je abonnement wordt binnen enkele minuten geactiveerd — klik op 'Status verversen' om te controleren." })
          setPendingActivation(true)
          clearInterval(interval)
        }
      }, 2000)

      // Stop polling if the tab is hidden; resume when it becomes visible again
      // so the network/api usage doesn't run in the background.
      const onVisibility = () => {
        if (document.hidden) clearInterval(interval)
      }
      document.addEventListener("visibilitychange", onVisibility)
      return () => {
        clearInterval(interval)
        document.removeEventListener("visibilitychange", onVisibility)
      }
    } else if (params.get("subscription") === "cancelled") {
      setStatusMessage({ type: "error", text: "Betaling geannuleerd. Je kunt het later opnieuw proberen." })
      window.history.replaceState({}, "", "/exams")
    } else if (params.get("subscription") === "required") {
      setStatusMessage({ type: "error", text: "Je hebt een actief abonnement nodig om dit examen te maken." })
      window.history.replaceState({}, "", "/exams")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!exams) return
    const examIds = (exams as Record<string, unknown>[]).map((e) => e.id as string)
    if (examIds.length === 0) return
    const fetchLimits = async () => {
      try {
        const { data, error } = await supabase
          .rpc("get_exam_attempt_status", { p_exam_ids: examIds })
        if (error) throw error
        const map: Record<string, AttemptLimit> = {}
        ;(data as unknown[]).forEach((row) => {
          const r = row as AttemptLimit & { exam_id: string }
          map[r.exam_id] = { max_attempts: r.max_attempts, used_attempts: r.used_attempts, remaining_attempts: r.remaining_attempts, is_locked: r.is_locked }
        })
        setAttemptLimits(map)
      } catch (e) {
        console.error("Failed to fetch attempt limits:", e)
      }
    }
    fetchLimits()
  }, [exams])

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (authorized === false) return null

  const anyLocked = Object.values(attemptLimits).some((l) => l.is_locked)

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in")

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, userId: user.id, couponCode: coupon?.code ?? null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Checkout failed")

      window.location.href = json.url
    } catch (e) {
      setStatusMessage({ type: "error", text: e instanceof Error ? e.message : "Subscription failed" })
      setSubscribing(null)
    }
  }

  // Manually re-check the subscription status (used after an iDEAL payment
  // whose activation is still pending).
  const checkSubscriptionStatus = async () => {
    setPendingActivation(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id).eq("is_active", true).gte("end_date", new Date().toISOString())
      .order("end_date", { ascending: false }).limit(1)
    if (data && data.length > 0) {
      setSubscription({ plan: { name: "", features: [] }, end_date: data[0].end_date as string })
      setStatusMessage({ type: "success", text: "Je abonnement is geactiveerd." })
    } else {
      setPendingActivation(true)
      setStatusMessage({ type: "success", text: "Nog niet geactiveerd. Probeer het over een minuut opnieuw." })
    }
  }

  const renderPlanCard = (plan: { id: string; name: string; price: number; features: string[] }) => {
    const hasDiscount = coupon && coupon.plan_ids.includes(plan.id)
    return (
    <div key={plan.id} className="bg-surface rounded-xl border border-outline-variant/30 p-5 text-left">
      <h3 className="text-headline-sm font-bold text-primary mb-1">{plan.name}</h3>
      <p className="text-headline-lg font-bold text-primary mb-3">
        {hasDiscount ? (
          <>
            <span className="text-label-md text-on-surface-variant line-through mr-2">&euro;{plan.price.toFixed(2)}</span>
            &euro;{discountedPrice(plan.id, plan.price).toFixed(2)}
          </>
        ) : (
          <>&euro;{plan.price.toFixed(2)}</>
        )}
      </p>
      {hasDiscount && (
        <span className="inline-block mb-3 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-label-sm font-bold">
          -{coupon!.discount_percent}% {coupon!.code}
        </span>
      )}
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
        className={`w-full py-2.5 rounded-xl text-label-md font-bold transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${
          hasDiscount ? "bg-green-600 text-white hover:opacity-90" : "bg-primary text-on-primary hover:opacity-90"
        }`}
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
    )
  }

  const renderCouponInput = () => (
    <div className="max-w-3xl mx-auto mb-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={couponInput}
          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
          placeholder={t("coupons.placeholder")}
          maxLength={24}
          className="flex-1 h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary font-mono font-bold uppercase tracking-wider outline-none bg-surface"
        />
        {coupon ? (
          <button
            onClick={clearCoupon}
            className="px-5 h-12 rounded-xl border border-outline-variant text-label-md font-bold text-error hover:bg-red-50 transition-colors active:scale-[0.97]"
          >
            {t("common.cancel")}
          </button>
        ) : (
          <button
            onClick={applyCoupon}
            disabled={couponLoading || !couponInput.trim()}
            className="px-6 h-12 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
          >
            {couponLoading ? <Loader2 size={16} className="animate-spin" /> : t("coupons.apply")}
          </button>
        )}
      </div>
      {couponError && (
        <p className="mt-2 text-label-md text-error font-medium">{couponError}</p>
      )}
    </div>
  )

  const renderPlansGrid = () =>
    plans.length > 0 && (
      <div className="max-w-3xl mx-auto">
        {renderCouponInput()}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(renderPlanCard)}
        </div>
      </div>
    )

  const renderExamCard = (examData: Record<string, unknown>) => {
    const courseData = examData.course as Record<string, unknown> | undefined
    const questionCount = (examData.exam_questions as { count: number }[] | undefined)?.[0]?.count ?? 0
    const examId = examData.id as string
    const att = attemptData[examId]
    const limit = attemptLimits[examId]
    const hasStarted = att && att.count > 0
    const hasPassed = att?.passed === true
    const isComplete = att?.passed !== null
    const isLocked = limit?.is_locked === true
    const remaining = limit?.remaining_attempts ?? null
    const max = limit?.max_attempts ?? null
    const statusLabel = hasPassed ? t("exams.passed") : hasStarted && isComplete ? t("exams.failed") : hasStarted ? t("exams.inProgress") : t("exams.notStarted")
    const statusClass = hasPassed ? "bg-green-100 text-green-700" : hasStarted && isComplete ? "bg-red-100 text-red-700" : hasStarted ? "bg-primary-container/10 text-primary" : "bg-surface-container-low text-on-surface-variant"

    return (
      <div
        key={examId}
        className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/40 overflow-hidden active:scale-[0.98] md:active:scale-[0.99] transition-transform ${
          isLocked ? "opacity-60 grayscale" : ""
        }`}
      >
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 flex-wrap">
                <span className={`px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold ${statusClass}`}>
                  {statusLabel}
                </span>
                {max != null ? (
                  <span className={`px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold ${(remaining ?? 0) > 0 ? "bg-primary-container/10 text-primary" : "bg-gray-200 text-gray-500"}`}>
                    {t("exams.attemptsLeft", { n: remaining ?? 0 })}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold bg-primary-container/10 text-primary flex items-center gap-1">
                    <InfinityIcon size={12} />
                    {t("exams.unlimited")}
                  </span>
                )}
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

            {isLocked ? (
              <Button
                className="w-full h-12 md:h-11 rounded-xl text-label-md font-bold bg-primary text-on-primary"
                onClick={() => {
                  setPaymentExpanded(true)
                  document.getElementById("payment-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <Lock size={16} />
                  {t("exam.buySubscription")}
                </span>
              </Button>
            ) : (
              <Button
                className="w-full h-12 md:h-11 rounded-xl text-label-md font-bold"
                variant="secondary"
                onClick={() => router.push(`/exams/${examData.id}`)}
              >
                {t("exams.start")}
              </Button>
            )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-surface">
      <div className="px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center justify-between gap-3 mb-4">
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
          {pendingActivation && (
            <div className="mt-3">
              <button
                onClick={checkSubscriptionStatus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white text-label-sm font-bold hover:opacity-90 active:scale-[0.97] transition-all"
              >
                <RefreshCw size={16} />
                Status verversen
              </button>
            </div>
          )}
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
            // Students always see paid exams; they're individually gated (locked)
            // by the attempt counter. Admin/staff see everything instantly.
            const isStudent = profile?.role === "student"
            const showPaid = true
            // A student needs to (re)buy when they have no active subscription OR
            // they have exhausted attempts on at least one exam.
            const showPaymentCta =
              isStudent && (!!subscription === false || anyLocked || paymentExpanded)
            const paymentEligible = isStudent && (!!subscription === false || anyLocked)

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

                {/* Paid exams section — always visible */}
                {paidExams.length > 0 && (
                  <>
                    <h2 className="text-headline-sm font-bold text-primary">
                      {showPaid ? t("exams.all") : t("exams.premium")}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {paidExams.map((exam) => renderExamCard(exam))}
                    </div>

                    {/* Purchase / reactivation CTA (scrolls into view from locked card) */}
                    {showPaymentCta && (
                      <div id="payment-section" className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-8 text-center">
                        {paymentEligible && anyLocked ? (
                          <>
                            <Lock size={36} className="text-outline-variant mx-auto mb-3" />
                            <p className="text-body-lg text-primary font-semibold mb-1">{t("exams.attemptsUsedTitle")}</p>
                            <p className="text-body-md text-on-surface-variant mb-6 max-w-md mx-auto">
                              {t("exams.attemptsUsedDesc")}
                            </p>
                          </>
                        ) : paymentEligible ? (
                          <>
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
                          </>
                        ) : null}
                        {renderPlansGrid()}
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
