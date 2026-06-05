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
}

type Question = {
  id: string
  category: string
  questionText: string
  media: string | null
  mediaMime: string | null
  answerOptions: AnswerOption[]
  explanation: string | null
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
  const [attemptNumber, setAttemptNumber] = useState(1)
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
        return {
          id: q.id as string,
          category: q.category as string,
          questionText: q.question_text as string,
          media,
          mediaMime: mime,
          answerOptions: (q.answer_options as AnswerOption[]) ?? [],
          explanation: null,
        }
      })

      setQuestions(mappedQuestions)

      if (!attemptCreated.current) {
        attemptCreated.current = true
        const res = await fetch("/api/exam/start-attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exam_id: examId }),
        })
        const attemptResult = await res.json()
        if (attemptResult.attempt_number) setAttemptNumber(attemptResult.attempt_number)
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
    const correct = questions.filter((q) => {
      const r = answerResults[q.id]
      if (r) return r.correct
      const hr = hotspotResults[q.id]
      if (hr) return hr.results.every((res) => res.correct)
      return false
    }).length
    const total = questions.length
    const passed = total > 0 && correct >= Math.ceil(total * 0.8)
    fetch("/api/exam/finish-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam_id: examId, score: correct, total_questions: total, passed }),
    })
  }, [questions, answerResults, hotspotResults, examId])

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

  const timerFinished = 45 * 60 - timeLeft
  const minutes = Math.floor(timerFinished / 60)
  const seconds = timerFinished % 60

  if (showResults) {
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

        <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full pb-8 flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 md:p-6 text-white mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-label-sm opacity-80">Je score</p>
                <h2 className="text-3xl font-bold mt-1">{correctCount}/{totalQuestions}</h2>
                <p className="text-label-md opacity-80 mt-1">
                  Tijd: {minutes}:{seconds.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="size-20 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-2xl font-bold">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</span>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all"
                style={{ width: `${totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0}%` }}
              />
            </div>
          </div>

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

          <div className="mt-6 flex justify-center">
            <button
              onClick={() => router.push("/exams")}
              className="px-8 py-3 bg-primary text-on-primary rounded-xl font-bold text-label-md hover:opacity-90 transition-all active:scale-95"
            >
              Terug naar overzicht
            </button>
          </div>
          </div>
        </main>
      </div>
    )
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
            <h1 className="text-label-sm font-bold text-primary truncate">{exam?.title}</h1>
            <p className="text-label-xs text-on-surface-variant">
              Poging {attemptNumber} &middot; {answeredCount}/{totalQuestions} beantwoord
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${timeLeft < 300 ? "bg-red-50" : "bg-surface-container"}`}>
            <Clock size={16} className={timeLeft < 300 ? "text-red-500" : "text-primary"} />
            <span
              className={`text-label-sm font-bold tabular-nums ${timeLeft < 300 ? "text-red-500" : "text-primary"}`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl mx-auto w-full">
        <main className="flex-1 px-4 py-5 pb-36 min-w-0">
          <section key={currentQuestion.id} className="space-y-5">
            {currentQuestion.category && (
              <span className="inline-block px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-label-xs font-bold">
                {currentQuestion.category}
              </span>
            )}
            <h1 className="text-headline-md md:text-headline-xl text-primary leading-tight">{currentQuestion.questionText}</h1>

          {currentQuestion.media && !isHotspot && !isChooseImages && (
            <div className="rounded-2xl overflow-hidden aspect-video border border-outline-variant/30 bg-surface-container">
              {currentQuestion.mediaMime?.startsWith("video/") ? (
                <video
                  src={currentQuestion.media}
                  controls
                  preload="auto"
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={currentQuestion.media}
                  alt="Traffic situation"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          {isHotspot ? (
            <div>
              <StudentHotspot
                key={currentQuestion.id}
                media={currentQuestion.media!}
                mediaMime={currentQuestion.mediaMime}
                correctOptions={currentQuestion.answerOptions}
                onComplete={handleHotspotSubmit}
                initialPositions={hotspotAnswers[currentQuestion.id]?.positions}
                initialSubmitted={submitted[currentQuestion.id] ?? undefined}
                validationResults={hotspotResult?.results}
              />
            </div>
          ) : isChooseImages ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentQuestion.answerOptions.map((option, idx) => {
                const state = getOptionState(idx)

                if (state === "idle") {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelect(idx)}
                      className="relative rounded-xl overflow-hidden border-2 border-outline-variant/50 transition-all active:scale-[0.97] hover:border-primary hover:shadow-sm cursor-pointer bg-surface"
                    >
                      {option.imageUrl && (
                        <img src={option.imageUrl} alt={`Option ${idx + 1}`} className="w-full aspect-square object-cover" />
                      )}
                      {option.text && (
                        <div className="p-3 text-center text-label-sm font-medium text-on-surface">{option.text}</div>
                      )}
                    </button>
                  )
                }

                if (state === "correct-selected" || state === "correct-unselected") {
                  return (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border-2 border-green-500 bg-green-50"
                    >
                      {option.imageUrl && (
                        <img src={option.imageUrl} alt={`Option ${idx + 1}`} className="w-full aspect-square object-cover" />
                      )}
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-label-xs font-bold px-2 py-1 rounded-md">
                        CORRECT
                      </div>
                    </div>
                  )
                }

                if (state === "wrong-selected") {
                  return (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border-2 border-red-500 bg-red-50"
                    >
                      {option.imageUrl && (
                        <img src={option.imageUrl} alt={`Option ${idx + 1}`} className="w-full aspect-square object-cover" />
                      )}
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-label-xs font-bold px-2 py-1 rounded-md">
                        JOUW KEUZE
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={idx}
                    className="relative rounded-xl overflow-hidden border-2 border-outline-variant opacity-40 bg-surface-container-lowest"
                  >
                    {option.imageUrl && (
                      <img src={option.imageUrl} alt={`Option ${idx + 1}`} className="w-full aspect-square object-cover" />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {currentQuestion.answerOptions.map((option, idx) => {
                const state = getOptionState(idx)
                const prefix = String.fromCharCode(65 + idx)

                if (state === "idle") {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelect(idx)}
                      className="flex items-center w-full p-4 border-2 border-outline-variant/50 rounded-xl transition-all active:scale-[0.99] hover:border-primary hover:shadow-sm text-left cursor-pointer bg-surface"
                    >
                      <div className="size-10 rounded-full bg-surface-container flex items-center justify-center mr-4 text-outline shrink-0">
                        <span className="font-bold text-label-md">{prefix}</span>
                      </div>
                      <span className="text-body-md md:text-body-lg text-on-surface flex-1">{option.text}</span>
                    </button>
                  )
                }

                if (state === "correct-selected") {
                  return (
                    <div
                      key={idx}
                      className="flex items-center w-full p-4 border-2 border-green-500 rounded-xl bg-green-50"
                    >
                      <div className="size-10 rounded-full bg-green-100 flex items-center justify-center mr-4 text-green-700 shrink-0">
                        <CheckCircle size={20} className="fill-green-500 text-white" />
                      </div>
                      <span className="text-body-md font-medium text-green-900 flex-1">{option.text}</span>
                      <span className="text-label-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-md shrink-0 ml-2">
                        CORRECT
                      </span>
                    </div>
                  )
                }

                if (state === "wrong-selected") {
                  return (
                    <div
                      key={idx}
                      className="flex items-center w-full p-4 border-2 border-red-500 rounded-xl bg-red-50"
                    >
                      <div className="size-10 rounded-full bg-red-100 flex items-center justify-center mr-4 text-red-700 shrink-0">
                        <XCircle size={20} className="fill-red-500 text-white" />
                      </div>
                      <span className="text-body-md font-medium text-red-900 flex-1">{option.text}</span>
                      <span className="text-label-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-md shrink-0 ml-2">
                        JOUW KEUZE
                      </span>
                    </div>
                  )
                }

                if (state === "correct-unselected") {
                  return (
                    <div
                      key={idx}
                      className="flex items-center w-full p-4 border-2 border-green-500 rounded-xl bg-green-50"
                    >
                      <div className="size-10 rounded-full bg-green-100 flex items-center justify-center mr-4 text-green-700 shrink-0">
                        <CheckCircle size={20} className="fill-green-500 text-white" />
                      </div>
                      <span className="text-body-md font-medium text-green-900 flex-1">{option.text}</span>
                      <span className="text-label-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-md shrink-0 ml-2">
                        CORRECT
                      </span>
                    </div>
                  )
                }

                return (
                  <div
                    key={idx}
                    className="opacity-40 pointer-events-none flex items-center w-full p-4 border-2 border-outline-variant rounded-xl bg-surface-container-lowest"
                  >
                    <div className="size-10 rounded-full bg-surface-container flex items-center justify-center mr-4 text-outline shrink-0">
                      <span className="font-bold text-label-md">{prefix}</span>
                    </div>
                    <span className="text-body-md text-on-surface-variant">{option.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {showError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mt-5">
            <AlertCircle size={20} className="text-red-500 shrink-0" />
            <span className="text-body-md text-red-700">Selecteer eerst een antwoord voordat je verder gaat.</span>
          </div>
        )}

        {hasAnswered && explanationText && (
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 mt-5">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
                <Info size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-label-md font-bold text-primary mb-1.5">Uitleg</h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(explanationText) }} />
              </div>
            </div>
          </div>
        )}
      </main>

      <aside className="hidden md:flex flex-col w-64 shrink-0 border-l border-outline-variant/30 bg-surface-container-lowest p-4 sticky top-0 h-screen overflow-y-auto">
        <h3 className="text-label-sm font-bold text-primary mb-4">Vragen</h3>
        <div className="grid grid-cols-5 gap-2">
          {questions.map((_, idx) => {
            const questionId = questions[idx].id
            const isAnswered = submitted[questionId]
            const isCurrent = idx === currentIndex
            return (
              <button
                key={questionId}
                onClick={() => goToQuestion(idx)}
                className={`size-9 rounded-lg flex items-center justify-center text-label-sm font-bold transition-all active:scale-95 ${
                  isCurrent
                    ? "bg-primary text-on-primary ring-2 ring-primary/30"
                    : isAnswered
                    ? "bg-green-100 text-green-700"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {isAnswered ? <Check size={14} /> : idx + 1}
              </button>
            )
          })}
        </div>
      </aside>
    </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant/50 px-4 py-3 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <button
            disabled={currentIndex === 0}
            onClick={() => goToQuestion(currentIndex - 1)}
            className={`flex items-center gap-1.5 px-5 py-3 rounded-xl font-bold text-label-md transition-all active:scale-95 ${
              currentIndex === 0
                ? "text-outline-variant bg-transparent"
                : "text-primary bg-surface-container hover:bg-surface-container-high"
            }`}
          >
            <ChevronLeft size={18} />
            <span>Vorige</span>
          </button>

          <span className="text-label-sm text-on-surface-variant tabular-nums font-medium">
            {currentIndex + 1} / {totalQuestions}
          </span>

          {isLastQuestion && hasAnswered ? (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl font-bold text-label-md transition-all active:scale-95 bg-green-600 text-white shadow-sm hover:bg-green-700"
            >
              <BarChart3 size={18} />
              <span>Toon resultaat</span>
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={isLastQuestion}
              className={`flex items-center gap-1.5 px-6 py-3 rounded-xl font-bold text-label-md transition-all active:scale-95 ${
                isLastQuestion
                  ? "text-outline-variant bg-transparent"
                  : "bg-primary text-on-primary shadow-sm hover:opacity-90"
              }`}
            >
              <span>Volgende</span>
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
