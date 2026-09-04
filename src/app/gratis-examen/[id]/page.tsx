"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ChevronLeft,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Eye,
  RotateCcw,
  Check,
  X,
} from "lucide-react"
import DOMPurify from "dompurify"
import StudentHotspot from "@/components/questions/student-hotspot"
import QuestionVideo from "@/components/questions/question-video"
import SmartImage from "@/components/ui/smart-image"

type AnswerOption = { text: string; x?: number; y?: number; imageUrl?: string }

type FreeExam = {
  id: string
  title: string
  description?: string | null
  duration_minutes: number
  pass_threshold?: number
  pass_type?: string
  pass_count?: number
}

type FreeQuestion = {
  id: string
  category: string
  questionText: string
  pauseAt?: number
  media: string | null
  mediaMime: string | null
  answerOptions: AnswerOption[]
  translations?: Record<string, { question_text?: string; answer_options?: { text: string }[]; explanation?: string }>
  audioTranslations?: Record<string, string>
  explanationAudioTranslations?: Record<string, string>
}

export default function GratisExamenPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [exam, setExam] = useState<FreeExam | null>(null)
  const [questions, setQuestions] = useState<FreeQuestion[]>([])
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

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const hasAnswered = submitted[currentQuestion?.id] ?? false
  const answeredCount = Object.keys(submitted).length
  const examActive = !showResults && questions.length > 0

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/free-exam/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      })
      const json = await res.json().catch(() => ({ error: "Network error" }))
      if (!res.ok) {
        setError(json.error || "Kon het examen niet laden")
        setLoading(false)
        return
      }
      setExam(json.exam)
      setTimeLeft((json.exam.duration_minutes ?? 45) * 60)
      setQuestions(json.questions)
      setLoading(false)
    }
    load()
  }, [examId])

  useEffect(() => {
    if (timeLeft <= 0 || !examActive) return
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft, examActive])

  const check = useCallback(async (qId: string, body: Record<string, unknown>) => {
    const res = await fetch("/api/free-exam/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: qId, ...body }),
    })
    return res.json()
  }, [])

  const handleSelect = useCallback(
    async (optionIndex: number) => {
      if (!currentQuestion || hasAnswered) return
      setShowError(false)
      const qId = currentQuestion.id
      setAnswers((prev) => ({ ...prev, [qId]: optionIndex }))
      const data = await check(qId, { type: "choice", selectedIndex: optionIndex })
      setAnswerResults((prev) => ({ ...prev, [qId]: data as { correct: boolean; correct_index: number; explanation: string | null } }))
      setSubmitted((prev) => ({ ...prev, [qId]: true }))
    },
    [currentQuestion, hasAnswered, check],
  )

  const handleHotspotSubmit = useCallback(
    async (positions: { x: number; y: number }[]) => {
      if (!currentQuestion?.id) return
      setShowError(false)
      const qId = currentQuestion.id
      setHotspotAnswers((prev) => ({ ...prev, [qId]: { positions } }))
      const data = await check(qId, { type: "hotspot", positions })
      setHotspotResults((prev) => ({ ...prev, [qId]: data as { results: { index: number; correct: boolean; distance: number | null }[]; explanation: string | null } }))
      setSubmitted((prev) => ({ ...prev, [qId]: true }))
    },
    [currentQuestion, check],
  )

  const goNext = useCallback(() => {
    if (!currentQuestion) return
    if (!hasAnswered) {
      setShowError(true)
      return
    }
    setShowError(false)
    setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1))
  }, [currentQuestion, hasAnswered, totalQuestions])

  const goPrev = useCallback(() => {
    setShowError(false)
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }, [])

  const finish = (onTimeUp = false) => {
    setShowResults(true)
  }

  useEffect(() => {
    if (timeLeft <= 0 && examActive) finish(true)
  }, [timeLeft, examActive])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <AlertCircle size={48} className="text-red-500" />
        <p className="text-lg">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90"
        >
          Terug naar home
        </button>
      </div>
    )
  }

  if (!currentQuestion && !showResults) return null

  const isHotspot =
    currentQuestion.media != null &&
    currentQuestion.answerOptions.length > 0 &&
    currentQuestion.answerOptions.some((o) => o.x != null && o.y != null)
  const isChooseImages =
    currentQuestion.answerOptions.length > 0 && currentQuestion.answerOptions.some((o) => o.imageUrl)
  const selectedIndex = answers[currentQuestion?.id] ?? null
  const answerResult = answerResults[currentQuestion.id]
  const hotspotResult = hotspotResults[currentQuestion.id]
  const correctIndex = answerResult?.correct_index ?? -1
  const explanationText = answerResult?.explanation ?? hotspotResult?.explanation ?? null
  const isLastQuestion = currentIndex === totalQuestions - 1

  const correctCount = questions.filter((q) => {
    const r = answerResults[q.id]
    if (r) return r.correct
    const hr = hotspotResults[q.id]
    if (hr) return hr.results.every((res) => res.correct)
    return false
  }).length

  const getOptionState = (idx: number) => {
    if (!hasAnswered) return "idle"
    if (idx === selectedIndex && idx === correctIndex) return "correct-selected"
    if (idx === selectedIndex && idx !== correctIndex) return "wrong-selected"
    if (idx !== selectedIndex && idx === correctIndex) return "correct-unselected"
    return "dimmed"
  }

  const getOptionText = (idx: number) => currentQuestion.answerOptions[idx]?.text || ""
  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
  const passType = exam?.pass_type ?? "percentage"
  const isGeslaagd =
    totalQuestions > 0 &&
    (passType === "count" ? correctCount >= (exam?.pass_count ?? totalQuestions) : scorePercent >= (exam?.pass_threshold ?? 80))

  if (showResults) {
    return (
      <div className="min-h-screen bg-surface">
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="text-center bg-white rounded-3xl p-8 shadow-sm border border-surface-container-high">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold mb-4 ${isGeslaagd ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {isGeslaagd ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {isGeslaagd ? "Geslaagd!" : "Niet gehaald"}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{scorePercent}%</h1>
            <p className="text-slate-500 mb-2">
              {correctCount} / {totalQuestions} vragen goed
            </p>
            <div className="w-full h-3 bg-slate-100 rounded-full mt-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isGeslaagd ? "bg-green-500" : "bg-red-500"}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <p className="text-sm text-slate-400 mt-6">
              Dit was een gratis proefexamen. Geen account nodig en niets wordt opgeslagen.
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Alle vragen</h2>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const qRes = answerResults[q.id]
                const qHot = hotspotResults[q.id]
                const qSel = answers[q.id]
                const qCorrectIdx = qRes?.correct_index ?? -1
                const qCorrect = qRes?.correct ?? qHot?.results.every((r) => r.correct) ?? false
                const qExpl = qRes?.explanation ?? qHot?.explanation ?? null
                const qHotQ = q.media != null && q.answerOptions.some((o) => o.x != null && o.y != null)
                const qChoose = q.answerOptions.length > 0 && q.answerOptions.some((o) => o.imageUrl)
                return (
                  <div key={q.id} className="bg-white rounded-2xl border border-surface-container-high overflow-hidden">
                    <div className={`px-5 py-4 flex items-center gap-3 border-b ${qCorrect ? "bg-green-50/60" : "bg-red-50/60"}`}>
                      <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${qCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {qCorrect ? <Check size={16} /> : <X size={16} />}
                      </div>
                      <p className="font-bold text-sm text-slate-800">Vraag {idx + 1}</p>
                    </div>
                    <div className="p-5 space-y-4">
                      <p className="font-medium text-slate-800">{q.questionText}</p>
                      {q.media && !qHotQ && !qChoose && (
                        <div className="rounded-xl overflow-hidden aspect-video bg-slate-100">
                          {q.mediaMime?.startsWith("video/") ? (
                            <QuestionVideo src={q.media} autoPlay muted className="w-full h-full object-cover" />
                          ) : (
                            <SmartImage src={q.media} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      )}
                      {qChoose ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {q.answerOptions.map((opt, oi) => {
                            const isCorrectOpt = qCorrectIdx === oi
                            const isSel = qSel === oi
                            return (
                              <div key={oi} className={`relative rounded-xl overflow-hidden border-2 ${isCorrectOpt ? "border-green-500" : isSel ? "border-red-500" : "border-slate-200"}`}>
                                {opt.imageUrl && <SmartImage src={opt.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                              </div>
                            )
                          })}
                        </div>
                      ) : !qHotQ ? (
                        <div className="space-y-2">
                          {q.answerOptions.map((opt, oi) => {
                            const isCorrectOpt = qCorrectIdx === oi
                            const isSel = qSel === oi
                            return (
                              <div key={oi} className={`flex items-center p-3 border-2 rounded-xl ${isCorrectOpt ? "border-green-500 bg-green-50" : isSel ? "border-red-500 bg-red-50" : "border-slate-200"}`}>
                                <span className="text-sm flex-1">{opt.text}</span>
                                {isCorrectOpt && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">Correct</span>}
                                {isSel && !isCorrectOpt && <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">Jouw keuze</span>}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Hotspot vraag — zie resultaat van je plaatsten.</p>
                      )}
                      {qExpl && (
                        <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                          <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qExpl) }} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-8 flex justify-center pb-10">
            <button
              onClick={() => router.push("/")}
              className="px-8 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90"
            >
              Terug naar home
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-white border-b border-surface-container-high z-40 shrink-0">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/")}
              className="size-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} className="text-primary" />
            </button>
            <div className="min-w-0">
              <span className="text-sm font-bold text-slate-900 truncate block">{exam?.title}</span>
              <span className="text-xs text-slate-500">
                Vraag {currentIndex + 1} / {totalQuestions} · {answeredCount} beantwoord
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            <Clock size={18} className={timeLeft < 300 ? "text-red-500" : "text-primary"} />
            <span className={`text-sm font-bold tabular-nums ${timeLeft < 300 ? "text-red-500" : "text-primary"}`}>{formatTime(timeLeft)}</span>
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div className="bg-primary h-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        <section key={currentQuestion.id}>
          <div className="bg-white rounded-2xl border border-surface-container-high p-6">
            <div className="flex flex-col gap-5">
              {currentQuestion.category && (
                <span className="self-start text-xs font-bold text-white bg-primary px-3 py-1 rounded-full">
                  {currentQuestion.category}
                </span>
              )}
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">{currentQuestion.questionText}</h1>
              {currentQuestion.media && !isHotspot && !isChooseImages && (
                <div className="rounded-xl overflow-hidden aspect-video bg-slate-100">
                  {currentQuestion.mediaMime?.startsWith("video/") ? (
                    <QuestionVideo src={currentQuestion.media} className="w-full h-full object-contain" />
                  ) : (
                    <SmartImage src={currentQuestion.media} alt="Verkeerssituatie" className="w-full h-full object-contain" />
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
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
            <AlertCircle size={20} className="text-red-500 shrink-0" />
            <span className="text-sm text-red-700">Beantwoord de vraag eerst voordat je verder gaat.</span>
          </div>
        )}

        {hasAnswered && explanationText && (
          <div className="bg-white border border-surface-container-high rounded-xl p-4 mt-4 flex items-start gap-4">
            <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 mb-1">Uitleg</p>
              <p className="text-sm text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(explanationText) }} />
            </div>
          </div>
        )}

        {isChooseImages ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
            {currentQuestion.answerOptions.map((option, idx) => {
              const state = getOptionState(idx)
              if (state === "idle") {
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    className="relative rounded-xl overflow-hidden border-2 border-slate-200 hover:border-primary active:scale-[0.97] transition-all cursor-pointer bg-white"
                  >
                    {option.imageUrl && <SmartImage src={option.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                  </button>
                )
              }
              const isCorrect = state === "correct-selected" || state === "correct-unselected"
              return (
                <div key={idx} className={`relative rounded-xl overflow-hidden border-4 ${isCorrect ? "border-green-500" : "border-red-500"}`}>
                  {option.imageUrl && <SmartImage src={option.imageUrl} alt="" className="w-full aspect-square object-cover" />}
                  {isCorrect && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">Correct</div>
                  )}
                  {!isCorrect && state === "wrong-selected" && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">Jouw keuze</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : !isHotspot ? (
          <div className="space-y-3 mt-5">
            {currentQuestion.answerOptions.map((option, idx) => {
              const state = getOptionState(idx)
              const prefix = String.fromCharCode(65 + idx)
              if (state === "idle") {
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    className="w-full flex items-center p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-primary hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer text-left"
                  >
                    <span className="size-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 mr-3">
                      {prefix}
                    </span>
                    <span className="text-sm md:text-base text-slate-800 flex-1">{option.text}</span>
                  </button>
                )
              }
              const isCorrect = state === "correct-selected" || state === "correct-unselected"
              return (
                <div key={idx} className={`w-full flex items-center p-4 border-2 rounded-xl ${isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
                  <span className={`size-9 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {isCorrect ? <Check size={16} /> : <X size={16} />}
                  </span>
                  <span className="text-sm md:text-base text-slate-800 flex-1">{option.text}</span>
                  {isCorrect && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">Correct</span>}
                  {!isCorrect && state === "wrong-selected" && (
                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">Jouw keuze</span>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </main>

      <footer className="sticky bottom-0 bg-white border-t border-surface-container-high px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            Vorige
          </button>
          {isLastQuestion && hasAnswered ? (
            <button
              onClick={() => finish()}
              className="flex-1 ml-2 px-8 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 active:scale-[0.98] transition-all"
            >
              Toon resultaat
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex-1 ml-2 px-8 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Volgende
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
