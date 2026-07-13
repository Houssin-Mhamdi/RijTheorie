"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import StudentHotspot from "@/components/questions/student-hotspot"
import {
  CheckCircle,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  AlertCircle,
  BarChart3,
  Check,
  X,
  Eye,
  RotateCcw,
  TrendingUp,
  BookOpen,
  Lightbulb,
  Globe,
  ChevronDown,
} from "lucide-react"
import DOMPurify from "dompurify"

type AnswerOption = {
  text: string
  x?: number
  y?: number
  imageUrl?: string
}

type Exam = {
  id: string
  title: string
  description?: string | null
  duration_minutes?: number
  pass_threshold?: number
  pass_type?: string
  pass_count?: number
}

type Translation = {
  question_text: string
  answer_options?: { text: string }[]
  explanation?: string
  active?: boolean
}

type Question = {
  id: string
  category: string
  questionText: string
  pauseAt?: number
  media: string | null
  mediaMime: string | null
  answerOptions: AnswerOption[]
  explanation: string | null
  translations?: Record<string, Translation>
}

export default function ExamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | null>>({})
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({})
  const [answerResults, setAnswerResults] = useState<Record<string, { correct: boolean; correct_index: number; explanation: string | null }>>({})
  const [hotspotResults, setHotspotResults] = useState<Record<string, { results: { index: number; correct: boolean; distance: number | null }[]; explanation: string | null }>>({})
  const [hotspotAnswers, setHotspotAnswers] = useState<Record<string, { positions: { x: number; y: number }[] }>>({})
  const [timeLeft, setTimeLeft] = useState(45 * 60)
  const [showError, setShowError] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [studentLang, setStudentLang] = useState<string>("")
  const [selectedLang, setSelectedLang] = useState<string>("nl")
  const [showLangMenu, setShowLangMenu] = useState(false)
  const attemptCreated = useRef(false)

  const currentQuestion = questions[currentIndex]
  const hasAnswered = submitted[currentQuestion?.id] ?? false
  const totalQuestions = questions.length
  const answeredCount = Object.keys(submitted).length

  useEffect(() => {
    const fetchExamData = async () => {
      setLoading(true)
      setError(null)

      const { data: examData, error: examErr } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single()

      if (examErr || !examData) {
        setError("Exam not found")
        setLoading(false)
        return
      }

      setExam(examData)
      setTimeLeft((examData.duration_minutes ?? 45) * 60)

      const { data: rpcData, error: rpcErr } = await supabase
        .rpc("get_exam_questions", { p_exam_id: examId })

      if (rpcErr || !rpcData || !Array.isArray(rpcData) || rpcData.length === 0) {
        setError("No questions found in this exam")
        setLoading(false)
        return
      }

      const mappedQuestions: Question[] = (rpcData as Record<string, unknown>[]).map((q) => {
        const media = (q.media as string) || null
        const ext = media?.split(".").pop()?.toLowerCase() ?? ""
        const mime = /^(mp4|webm|ogg|mov)$/i.test(ext) ? `video/${ext}` : media ? "image/unknown" : null
        const rawTranslations = (q as Record<string, unknown>).translations as Record<string, unknown> | null | undefined
        const translations: Record<string, Translation> | undefined = rawTranslations && typeof rawTranslations === "object" && !Array.isArray(rawTranslations) && Object.keys(rawTranslations).length > 0
          ? Object.keys(rawTranslations).reduce((acc, lang) => ({ ...acc, [lang]: rawTranslations[lang] as Translation }), {} as Record<string, Translation>)
          : undefined
        return {
          id: q.id as string,
          category: q.category as string,
          questionText: q.question_text as string,
          pauseAt: (q as Record<string, unknown>).pause_at as number ?? 3,
          media,
          mediaMime: mime,
          answerOptions: (q.answer_options as AnswerOption[]) ?? [],
          explanation: null,
          translations,
        }
      })

      setQuestions(mappedQuestions)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("language").eq("id", user.id).single()
        if (prof?.language) { setStudentLang(prof.language); setSelectedLang(prof.language) }
      }

      if (!attemptCreated.current) {
        attemptCreated.current = true
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: existing } = await supabase
            .from("exam_attempts")
            .select("id, attempt_number, completed_at")
            .eq("user_id", user.id)
            .eq("exam_id", examId)
            .order("started_at", { ascending: false })
            .limit(1)
          if (existing && existing.length > 0) {
            if (existing[0].completed_at) {
              router.push("/exams")
              return
            }
            setAttemptNumber(existing[0].attempt_number)
          } else {
            const { data: count } = await supabase.rpc("count_user_exam_attempts", {
              p_user_id: user.id,
              p_exam_id: examId,
            })
            const nextNumber = (typeof count === "number" ? count : 0) + 1
            await supabase.rpc("insert_exam_attempt", {
              p_user_id: user.id,
              p_exam_id: examId,
              p_attempt_number: nextNumber,
            })
            setAttemptNumber(nextNumber)
          }
        }
      }

      setLoading(false)
    }

    fetchExamData()
  }, [examId])

  useEffect(() => {
    if (timeLeft <= 0) return
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft])

  const handleSelect = useCallback(
    async (optionIndex: number) => {
      if (!currentQuestion) return
      if (hasAnswered) return

      setShowError(false)
      const questionId = currentQuestion.id
      setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))

      const { data, error } = await supabase.rpc("check_answer", {
        p_question_id: questionId,
        p_selected_index: optionIndex,
      })
      if (error || !data) {
        setSubmitted((prev) => ({ ...prev, [questionId]: true }))
        return
      }
      setAnswerResults((prev) => ({ ...prev, [questionId]: data as { correct: boolean; correct_index: number; explanation: string | null } }))
      setSubmitted((prev) => ({ ...prev, [questionId]: true }))
    },
    [currentQuestion, hasAnswered],
  )

  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalQuestions) return
      setShowError(false)
      setCurrentIndex(index)
    },
    [totalQuestions],
  )

  const goNext = useCallback(() => {
    if (!currentQuestion) return
    if (!hasAnswered) {
      setShowError(true)
      return
    }
    setShowError(false)
    goToQuestion(currentIndex + 1)
  }, [currentQuestion, hasAnswered, currentIndex, goToQuestion])

  const handleFinish = useCallback(() => {
    setShowResults(true)
    setSaveError(null)
    const correct = questions.filter((q) => {
      const r = answerResults[q.id]
      if (r) return r.correct
      const hr = hotspotResults[q.id]
      if (hr) return hr.results.every((res) => res.correct)
      return false
    }).length
    const total = questions.length
    const passType = exam?.pass_type ?? "percentage"
    const passed = total > 0 && (passType === "count"
      ? correct >= (exam?.pass_count ?? total)
      : correct >= Math.ceil(total * ((exam?.pass_threshold ?? 80) / 100)))
    const categoryStats: Record<string, { correct: number; total: number }> = {}
    questions.forEach((q) => {
      const cat = q.category || "Overig"
      if (!categoryStats[cat]) categoryStats[cat] = { correct: 0, total: 0 }
      categoryStats[cat].total++
      const r = answerResults[q.id]
      const hr = hotspotResults[q.id]
      if (r?.correct || hr?.results.every((res) => res.correct)) categoryStats[cat].correct++
    })
    setSaving(true)
    fetch("/api/exam/finish-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: examId,
        score: correct,
        total_questions: total,
        passed,
        category_scores: Object.keys(categoryStats).length > 0 ? categoryStats : null,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setSaving(false)
      console.log("finish: success", { correct, total, passed })
    }).catch((e) => {
      setSaving(false)
      setSaveError(e.message)
      console.log("finish: error", e)
    })
  }, [questions, answerResults, hotspotResults, examId, exam])

  const handleHotspotSubmit = useCallback(async (positions: { x: number; y: number }[]) => {
    if (!currentQuestion?.id) return
    setShowError(false)
    const qId = currentQuestion.id
    setHotspotAnswers((prev) => ({ ...prev, [qId]: { positions } }))

    const { data, error } = await supabase.rpc("check_hotspot", {
      p_question_id: qId,
      p_positions: positions,
    })
    if (error || !data) {
      setSubmitted((prev) => ({ ...prev, [qId]: true }))
      return
    }
    setHotspotResults((prev) => ({ ...prev, [qId]: data as { results: { index: number; correct: boolean; distance: number | null }[]; explanation: string | null } }))
    setSubmitted((prev) => ({ ...prev, [qId]: true }))
  }, [currentQuestion?.id])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-red-500" />
        <p className="text-body-lg text-on-surface-variant">{error}</p>
        <Button variant="outline" onClick={() => router.push("/exams")}>
          Back to exams
        </Button>
      </div>
    )
  }

  if (!currentQuestion && !showResults) return null

  const isLastQuestion = currentIndex === totalQuestions - 1

  const selectedIndex = answers[currentQuestion?.id] ?? null
  const answerResult = answerResults[currentQuestion.id]
  const hotspotResult = hotspotResults[currentQuestion.id]
  const correctIndex = answerResult?.correct_index ?? -1
  const explanationText = answerResult?.explanation ?? hotspotResult?.explanation ?? null
  const isHotspot =
    currentQuestion.media != null &&
    currentQuestion.answerOptions.length > 0 &&
    currentQuestion.answerOptions.some((o) => o.x != null && o.y != null)
  const isChooseImages = currentQuestion.category === "Choose Images"

  const getOptionState = (idx: number) => {
    if (!hasAnswered) return "idle"
    if (idx === selectedIndex && idx === correctIndex) return "correct-selected"
    if (idx === selectedIndex && idx !== correctIndex) return "wrong-selected"
    if (idx !== selectedIndex && idx === correctIndex) return "correct-unselected"
    return "dimmed"
  }

  const correctCount = questions.filter((q) => {
    const r = answerResults[q.id]
    if (r) return r.correct
    const hr = hotspotResults[q.id]
    if (hr) return hr.results.every((res) => res.correct)
    return false
  }).length

  const availableLangs = currentQuestion?.translations
    ? Object.entries(currentQuestion.translations).filter(([, t]) => t.active !== false).map(([lang]) => lang)
    : []
  const translation: Translation | undefined = selectedLang ? currentQuestion.translations?.[selectedLang] : undefined

  const getQuestionText = () => translation?.question_text || currentQuestion.questionText
  const getOptionText = (idx: number) => translation?.answer_options?.[idx]?.text || currentQuestion.answerOptions[idx]?.text || ""
  const getExplanationText = () => translation?.explanation || explanationText || ""

  const examDuration = exam?.duration_minutes ?? 45
  const timerFinished = examDuration * 60 - timeLeft
  const minutes = Math.floor(timerFinished / 60)
  const seconds = timerFinished % 60

  if (showResults) {
    const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    const passType = exam?.pass_type ?? "percentage"
    const isGeslaagd = totalQuestions > 0 && (passType === "count"
      ? correctCount >= (exam?.pass_count ?? totalQuestions)
      : scorePercent >= (exam?.pass_threshold ?? 80))

    const categoryStats: Record<string, { total: number; correct: number }> = {}
    questions.forEach((q) => {
      const cat = q.category || "Overig"
      if (!categoryStats[cat]) categoryStats[cat] = { total: 0, correct: 0 }
      categoryStats[cat].total++
      const r = answerResults[q.id]
      const hr = hotspotResults[q.id]
      if (r?.correct || hr?.results.every((res) => res.correct)) categoryStats[cat].correct++
    })

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
      "Traffic": "bg-purple-100 text-purple-700",
      "Lighting": "bg-amber-100 text-amber-700",
    }

    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <header className="bg-surface border-b border-outline-variant/50 px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/exams")}
              className="size-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} className="text-primary" />
            </button>
            <div className="min-w-0">
              <h1 className="text-label-sm font-bold text-primary truncate">Resultaten</h1>
              <p className="text-label-xs text-on-surface-variant">{exam?.title}</p>
            </div>
          </div>
        </header>

        {saveError && (
          <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 font-bold">Fout bij opslaan resultaat:</p>
            <p className="text-red-600 mt-1 text-sm">{saveError}</p>
            <p className="text-red-500 mt-1 text-xs">Je resultaat is lokaal zichtbaar maar niet opgeslagen. Neem contact op met de administrator.</p>
          </div>
        )}
        <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-x-hidden">
          <div className="mb-12">
            <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container-high relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-secondary-container/10 rounded-full -mr-20 -mt-20 blur-3xl" />
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                <div className="text-center md:text-left">
                  <span className={`inline-block px-4 py-1.5 rounded-full font-bold text-label-md mb-4 ${isGeslaagd ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {isGeslaagd ? "Examen Afgerond" : "Niet Geslaagd"}
                  </span>
                  <h1 className="text-display-lg text-primary mb-2">{isGeslaagd ? "Gefeliciteerd, je bent Geslaagd!" : "Helaas, je bent niet geslaagd"}</h1>
                  <p className="text-body-lg text-on-surface-variant max-w-xl">
                    {isGeslaagd
                      ? "Je hebt laten zien dat je de Nederlandse verkeersregels uitstekend beheerst."
                      : "Je hebt het net niet gehaald. Bekijk je fouten en probeer het opnieuw."}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle className="text-surface-container" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="12" />
                      <circle
                        className={`transition-all duration-1000 ease-out ${isGeslaagd ? "text-green-500" : "text-red-500"}`}
                        cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="12"
                        strokeDasharray={553}
                        strokeDashoffset={553 - (553 * scorePercent) / 100}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-display-lg text-primary">{scorePercent}%</span>
                      <span className="text-label-md text-on-surface-variant">Score</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container-high flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center mb-4">
                <CheckCircle size={24} className="text-on-primary-container" />
              </div>
              <span className="text-label-md text-on-surface-variant mb-1">Totaal Score</span>
              <h3 className="text-headline-md text-primary">{correctCount} / {totalQuestions}</h3>
              <p className="text-label-sm text-on-surface-variant mt-2">{isGeslaagd ? "Geslaagd!" : "Nog 80% nodig"}</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container-high flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center mb-4">
                <Clock size={24} className="text-primary" />
              </div>
              <span className="text-label-md text-on-surface-variant mb-1">Tijd Gebruikt</span>
              <h3 className="text-headline-md text-primary">{minutes}:{seconds.toString().padStart(2, "0")}</h3>
              <p className="text-label-sm text-on-surface-variant mt-2">Maximum tijd: 45:00</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container-high flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center mb-4">
                <TrendingUp size={24} className="text-primary" />
              </div>
              <span className="text-label-md text-on-surface-variant mb-1">Sterkste Onderdeel</span>
              <h3 className="text-headline-md text-primary">
                {Object.entries(categoryStats).sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))[0]?.[0] || "—"}
              </h3>
              <p className="text-label-sm text-on-surface-variant mt-2">
                {(() => {
                  const top = Object.entries(categoryStats).sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))[0]
                  return top ? `${Math.round((top[1].correct / top[1].total) * 100)}% correct` : ""
                })()}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => { setShowResults(false); setCurrentIndex(0); setAnswers({}); setSubmitted({}); setAnswerResults({}); setHotspotResults({}); setTimeLeft(examDuration * 60) }}
              className="w-full sm:w-auto px-8 py-4 bg-secondary-container text-on-secondary-container font-bold rounded-xl transition-all active:scale-[0.98] shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Eye size={20} />
              Vragen nakijken
            </button>
            <button
              onClick={() => router.push("/exams")}
              className="w-full sm:w-auto px-8 py-4 border-2 border-primary text-primary font-bold rounded-xl transition-all hover:bg-surface-container-low active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} />
              Nieuw examen
            </button>
          </div>

          <div className="mb-16">
            <h2 className="text-headline-md text-primary mb-6">Resultaten per categorie</h2>
            <div className="space-y-4">
              {Object.entries(categoryStats).map(([cat, stats]) => {
                const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                const Icon = categoryIcons[cat] || BookOpen
                const colorClass = categoryColors[cat] || "bg-surface-container-high text-primary"
                return (
                  <div key={cat} className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-label-md text-primary">{cat}</h4>
                        <p className="text-label-sm text-on-surface-variant">{stats.total} vragen</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-primary">{stats.correct}/{stats.total}</span>
                      <div className="w-32 h-2 bg-surface-container rounded-full mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${percent >= 80 ? "bg-green-500" : percent >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-headline-md text-primary mb-6">Alle vragen</h2>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const qAnswerResult = answerResults[q.id]
                const qHotspotResult = hotspotResults[q.id]
                const qSelectedIndex = answers[q.id]
                const qCorrectIndex = qAnswerResult?.correct_index ?? -1
                const qIsCorrect = qAnswerResult?.correct ?? qHotspotResult?.results.every((r) => r.correct) ?? false
                const qExplanation = qAnswerResult?.explanation ?? qHotspotResult?.explanation ?? null
                const qIsHotspot = q.media != null && q.answerOptions.some((o) => o.x != null && o.y != null)
                const qIsChooseImages = q.category === "Choose Images"

                return (
                  <div key={q.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden">
                    <div className={`px-5 py-4 flex items-center gap-3 border-b border-outline-variant/20 ${qIsCorrect ? "bg-green-50/50" : "bg-red-50/50"}`}>
                      <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${qIsCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {qIsCorrect ? <Check size={18} /> : <X size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-label-sm font-bold text-primary">Vraag {idx + 1}</p>
                        {q.category && <p className="text-label-xs text-on-surface-variant">{q.category}</p>}
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <p className="text-body-md font-medium text-primary">{q.questionText}</p>

                      {q.media && !qIsHotspot && !qIsChooseImages && (
                        <div className="rounded-xl overflow-hidden aspect-video border border-outline-variant/30 bg-surface-container">
                          {q.mediaMime?.startsWith("video/") ? (
                            <video src={q.media} controls preload="auto" className="w-full h-full object-cover" />
                          ) : (
                            <img src={q.media} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      )}

                      {qIsChooseImages ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {q.answerOptions.map((opt, oi) => {
                            const isSelected = qSelectedIndex === oi
                            const isCorrectOpt = qCorrectIndex === oi
                            const borderColor = isCorrectOpt ? "border-green-500" : isSelected && !isCorrectOpt ? "border-red-500" : "border-outline-variant/30"
                            return (
                              <div key={oi} className={`relative rounded-xl overflow-hidden border-2 ${borderColor} ${isCorrectOpt ? "bg-green-50" : isSelected ? "bg-red-50" : ""}`}>
                                {opt.imageUrl && <img src={opt.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                                {isCorrectOpt && (
                                  <div className="absolute top-2 right-2 bg-green-500 text-white text-label-xs font-bold px-2 py-0.5 rounded">CORRECT</div>
                                )}
                                {isSelected && !isCorrectOpt && (
                                  <div className="absolute top-2 right-2 bg-red-500 text-white text-label-xs font-bold px-2 py-0.5 rounded">JOUW KEUZE</div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : qIsHotspot ? (
                        <div className="text-label-sm text-on-surface-variant">Hotspot vraag — bekijk de resultaten hierboven</div>
                      ) : (
                        <div className="space-y-2">
                          {q.answerOptions.map((opt, oi) => {
                            const prefix = String.fromCharCode(65 + oi)
                            const isSelected = qSelectedIndex === oi
                            const isCorrectOpt = qCorrectIndex === oi
                            const borderColor = isCorrectOpt ? "border-green-500" : isSelected && !isCorrectOpt ? "border-red-500" : "border-outline-variant/30"
                            const bgColor = isCorrectOpt ? "bg-green-50" : isSelected ? "bg-red-50" : "bg-surface"
                            return (
                              <div key={oi} className={`flex items-center w-full p-3 border-2 ${borderColor} ${bgColor} rounded-xl`}>
                                <div className={`size-9 rounded-full flex items-center justify-center mr-3 shrink-0 font-bold text-label-sm ${isCorrectOpt ? "bg-green-100 text-green-700" : isSelected ? "bg-red-100 text-red-700" : "bg-surface-container text-outline"}`}>
                                  {isCorrectOpt ? <Check size={16} /> : isSelected ? <X size={16} /> : prefix}
                                </div>
                                <span className="text-body-md flex-1">{opt.text}</span>
                                {isCorrectOpt && (
                                  <span className="text-label-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded shrink-0 ml-2">CORRECT</span>
                                )}
                                {isSelected && !isCorrectOpt && (
                                  <span className="text-label-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded shrink-0 ml-2">JOUW KEUZE</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {qExplanation && (
                        <div className="flex items-start gap-3 bg-surface-container-low rounded-xl p-4">
                          <Info size={18} className="text-primary shrink-0 mt-0.5" />
                          <p className="text-body-md text-on-surface-variant" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qExplanation ?? "") }} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-center pb-8">
            <button
              onClick={() => router.push("/exams")}
              className="px-8 py-3 bg-primary text-on-primary rounded-xl font-bold text-label-md hover:opacity-90 transition-all active:scale-95"
            >
              Terug naar overzicht
            </button>
          </div>
        </main>
      </div>
    )
  }

  const qText = getQuestionText()
  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0

  const langLabels: Record<string, string> = {
    nl: "Nederlands", en: "English", ar: "العربية", fr: "Français",
    de: "Deutsch", tr: "Türkçe", pl: "Polski", es: "Español", it: "Italiano",
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-surface border-b border-outline-variant/50 px-4 py-3 md:px-6 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/exams")}
            className="size-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-primary" />
          </button>
          <div className="min-w-0">
            <span className="text-label-md font-bold text-primary truncate block">{exam?.title}</span>
            <span className="text-body-md text-on-surface-variant">Question {currentIndex + 1} of {totalQuestions}</span>
          </div>
        </div>
        <div className="hidden md:flex flex-1 mx-8 max-w-2xl bg-surface-container rounded-full h-3 overflow-hidden">
          <div className="bg-secondary-container h-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {availableLangs.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container transition-colors"
              >
                <Globe size={16} className="text-primary" />
                <span className="text-label-sm font-bold text-primary uppercase">{langLabels[selectedLang] || selectedLang.toUpperCase()}</span>
                <ChevronDown size={14} className="text-outline" />
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-10 bg-white border border-outline-variant rounded-xl shadow-lg z-50 py-2 min-w-[160px]">
                  {[["nl", "Nederlands"] as const, ...availableLangs.map((code) => [code, langLabels[code] || code.toUpperCase()] as const)].map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      className={`w-full text-left px-4 py-2 text-body-md hover:bg-surface-container-high transition-colors ${selectedLang === code ? "font-bold text-primary" : "text-on-surface"}`}
                      onClick={() => { setSelectedLang(code); setShowLangMenu(false) }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${timeLeft < 300 ? "bg-red-50" : "bg-surface-container-high"}`}>
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: "18px", lineHeight: 1 }}>timer</span>
            <span className={`text-label-md font-bold tabular-nums ${timeLeft < 300 ? "text-red-500" : "text-primary"}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </header>

      <div className="md:hidden w-full bg-surface-container h-1">
        <div className="bg-secondary-container h-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 md:px-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <section key={currentQuestion.id}>
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 p-6 md:p-8" style={{ boxShadow: "0px 4px 20px rgba(26,60,110,0.05)" }}>
                <div className="flex flex-col gap-6">
                  <h1 className="text-headline-md md:text-headline-xl text-on-surface leading-tight">{qText}</h1>

                  {currentQuestion.media && !isHotspot && !isChooseImages && (
                    <div className="relative rounded-xl overflow-hidden aspect-video bg-surface-container">
                      {currentQuestion.mediaMime?.startsWith("video/") ? (
                        <video src={currentQuestion.media} controls preload="auto" className="w-full h-full object-cover" />
                      ) : (
                        <img src={currentQuestion.media} alt="Traffic situation" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}

                  {isHotspot && (
                    <StudentHotspot
                      key={currentQuestion.id}
                      media={currentQuestion.media!}
                      mediaMime={currentQuestion.mediaMime}
                      correctOptions={currentQuestion.answerOptions}
                      onComplete={handleHotspotSubmit}
                      initialPositions={hotspotAnswers[currentQuestion.id]?.positions}
                      initialSubmitted={submitted[currentQuestion.id] ?? undefined}
                      validationResults={hotspotResult?.results}
                      pauseAt={currentQuestion.pauseAt ?? 3}
                      optionLabels={currentQuestion.answerOptions.map((_, i) => getOptionText(i))}
                    />
                  )}
                </div>
              </div>
            </section>

            {showError && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle size={20} className="text-red-500 shrink-0" />
                <span className="text-body-md text-red-700">Selecteer eerst een antwoord voordat je verder gaat.</span>
              </div>
            )}

            {hasAnswered && getExplanationText() && (
              <div className="bg-surface-container-low border border-surface-container-high rounded-xl p-4 flex items-start gap-4">
                <Info size={20} className="text-primary-container shrink-0 mt-0.5" />
                <div>
                  <p className="text-label-md text-on-surface font-bold mb-1">Uitleg</p>
                  <p className="text-body-md text-on-surface-variant leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getExplanationText()!) }} />
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            {isChooseImages ? (
              <div className="grid grid-cols-2 gap-3">
                {currentQuestion.answerOptions.map((option, idx) => {
                  const state = getOptionState(idx)
                  if (state === "idle") {
                    return (
                      <button key={idx} type="button" onClick={() => handleSelect(idx)}
                        className="relative rounded-xl overflow-hidden border-2 border-outline-variant/50 transition-all active:scale-[0.97] hover:border-primary hover:shadow-sm cursor-pointer bg-surface"
                      >
                        {option.imageUrl && <img src={option.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                      </button>
                    )
                  }
                  if (state === "correct-selected" || state === "correct-unselected") {
                    return (
                      <div key={idx} className="relative rounded-xl overflow-hidden border-2 border-green-500 bg-green-50">
                        {option.imageUrl && <img src={option.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-label-xs font-bold px-2 py-1 rounded-md">CORRECT</div>
                      </div>
                    )
                  }
                  if (state === "wrong-selected") {
                    return (
                      <div key={idx} className="relative rounded-xl overflow-hidden border-2 border-red-500 bg-red-50">
                        {option.imageUrl && <img src={option.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-label-xs font-bold px-2 py-1 rounded-md">JOUW KEUZE</div>
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className="relative rounded-xl overflow-hidden border-2 border-outline-variant opacity-40 bg-surface-container-lowest">
                      {option.imageUrl && <img src={option.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                    </div>
                  )
                })}
              </div>
            ) : !isHotspot ? (
              <div className="flex flex-col gap-4" id="options-container">
                {currentQuestion.answerOptions.map((option, idx) => {
                  const state = getOptionState(idx)
                  const prefix = String.fromCharCode(65 + idx)
                  const optionText = getOptionText(idx)

                  if (state === "idle") {
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelect(idx)}
                        className="group relative flex items-center w-full bg-surface-container-lowest p-6 rounded-2xl border-2 border-transparent hover:border-secondary transition-all text-left outline-none active:scale-[0.98]"
                        style={{ boxShadow: "0px 4px 20px rgba(26,60,110,0.05)" }}
                      >
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-surface-container text-primary group-hover:bg-secondary-fixed group-hover:text-on-secondary-fixed transition-colors font-bold text-headline-md mr-4">
                          {prefix}
                        </div>
                        <span className="text-body-lg text-on-surface flex-grow">{optionText}</span>
                      </button>
                    )
                  }

                  if (state === "correct-selected") {
                    return (
                      <div key={idx} className="flex items-center w-full bg-surface-container-lowest p-6 rounded-2xl border-2 border-green-500 bg-green-50" style={{ boxShadow: "0px 4px 20px rgba(26,60,110,0.05)" }}>
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-headline-md mr-4">
                          <CheckCircle size={24} className="fill-green-500 text-white" />
                        </div>
                        <span className="text-body-lg font-medium text-green-900 flex-grow">{optionText}</span>
                        <span className="text-label-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-md shrink-0 ml-2">CORRECT</span>
                      </div>
                    )
                  }

                  if (state === "wrong-selected") {
                    return (
                      <div key={idx} className="flex items-center w-full bg-surface-container-lowest p-6 rounded-2xl border-2 border-red-500 bg-red-50" style={{ boxShadow: "0px 4px 20px rgba(26,60,110,0.05)" }}>
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-headline-md mr-4">
                          <XCircle size={24} className="fill-red-500 text-white" />
                        </div>
                        <span className="text-body-lg font-medium text-red-900 flex-grow">{optionText}</span>
                        <span className="text-label-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-md shrink-0 ml-2">JOUW KEUZE</span>
                      </div>
                    )
                  }

                  if (state === "correct-unselected") {
                    return (
                      <div key={idx} className="flex items-center w-full bg-surface-container-lowest p-6 rounded-2xl border-2 border-green-500 bg-green-50" style={{ boxShadow: "0px 4px 20px rgba(26,60,110,0.05)" }}>
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-headline-md mr-4">
                          <CheckCircle size={24} className="fill-green-500 text-white" />
                        </div>
                        <span className="text-body-lg font-medium text-green-900 flex-grow">{optionText}</span>
                        <span className="text-label-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-md shrink-0 ml-2">CORRECT</span>
                      </div>
                    )
                  }

                  return (
                    <div key={idx} className="opacity-40 pointer-events-none flex items-center w-full bg-surface-container-lowest p-6 rounded-2xl border-2 border-outline-variant" style={{ boxShadow: "0px 4px 20px rgba(26,60,110,0.05)" }}>
                      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-surface-container text-outline font-bold text-headline-md mr-4">
                        {prefix}
                      </div>
                      <span className="text-body-lg text-on-surface-variant flex-grow">{optionText}</span>
                    </div>
                  )
                })}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                disabled={currentIndex === 0}
                onClick={() => goToQuestion(currentIndex - 1)}
                className={`flex items-center gap-2 px-6 py-4 rounded-full font-label-md text-label-md transition-all active:scale-[0.98] ${
                  currentIndex === 0
                    ? "border border-outline-variant text-outline-variant bg-transparent"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <ChevronLeft size={18} />
                <span className="hidden sm:inline">Vorige</span>
              </button>

              {isLastQuestion && hasAnswered ? (
                <button
                  onClick={handleFinish}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-secondary-container text-on-secondary-container px-8 py-4 rounded-full font-label-md text-label-md shadow-md hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  <BarChart3 size={18} />
                  Toon resultaat
                </button>
              ) : (
                <button
                  onClick={goNext}
                  disabled={isLastQuestion}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-full font-label-md text-label-md shadow-md transition-all active:scale-[0.98] ${
                    isLastQuestion
                      ? "bg-outline-variant text-outline"
                      : "bg-secondary-container text-on-secondary-container hover:opacity-90"
                  }`}
                >
                  Volgende
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-surface-container-lowest border-t border-outline-variant/50 flex gap-4 z-40">
        {currentIndex > 0 && (
          <button
            onClick={() => goToQuestion(currentIndex - 1)}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-outline-variant text-on-surface-variant font-label-md text-label-md active:scale-[0.98] bg-surface"
          >
            <ChevronLeft size={18} />
            Vorige
          </button>
        )}
        {isLastQuestion && hasAnswered ? (
          <button
            onClick={handleFinish}
            className="flex-1 bg-secondary-container text-on-secondary-container py-4 rounded-xl font-label-md text-label-md shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <BarChart3 size={18} />
            Toon resultaat
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex-1 bg-secondary-container text-on-secondary-container py-4 rounded-xl font-label-md text-label-md shadow-md active:scale-[0.98]"
          >
            Volgende Vraag
          </button>
        )}
      </div>
    </div>
  )
}
