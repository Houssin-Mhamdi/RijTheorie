"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery, useSupabaseMutation } from "@/lib/supabase-queries"
import { toast } from "sonner"
import { ArrowLeft, Plus, Check, X, Trash2, FileQuestion, BookOpen, GripVertical, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { FixedSizeList as List } from "react-window"

const DEBOUNCE_MS = 300
const MIN_SEARCH_LENGTH = 2
const ROW_HEIGHT = 64
const PANEL_HEIGHT_OFFSET = 280

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

export default function ExamDetailPage() {
  const { id: courseId, examId } = useParams<{ id: string; examId: string }>()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [panelHeight, setPanelHeight] = useState(600)
  const dragIndex = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const searchCacheRef = useRef<Map<string, Record<string, unknown>[]>>(new Map())
  const listRef = useRef<List | null>(null)

  const debouncedSearch = useDebounce(searchQuery, DEBOUNCE_MS)

  function QuestionRow({ index, style }: { index: number; style: React.CSSProperties }) {
    const q = filteredQuestions[index]
    if (!q) return null
    const isSelected = selectedQuestionIds.has(q.id as string)
    const exams = questionExamMap.get(q.id as string)

    return (
      <div style={style} className="px-6">
        <div
          className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-surface-container-higher border border-transparent"}`}
          onClick={() => toggleSelect(q.id as string)}
        >
          <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? "bg-primary border-primary" : "border-outline-variant"}`}>
            {isSelected && <Check size={14} className="text-on-primary" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-label-sm bg-primary-container/30 text-primary px-2 py-0.5 rounded-md shrink-0">{q.category as string}</span>
              <span className="text-body-md truncate">{q.question_text as string}</span>
            </div>
            {exams && exams.length > 0 && (
              <p className="text-label-xs text-on-surface-variant/50 mt-0.5 truncate">
                {exams.map((e) => e.title).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const { data: examData, isLoading: examLoading, refetch: refetchExam } = useSupabaseQuery(
    ["exam", examId],
    async () => { const { data, error } = await supabase.from("exams").select("*, course:courses(title, icon_name)").eq("id", examId).single(); return { data, error } },
    { enabled: !!examId },
  )

  const { data: assignedRows, isLoading: assignedLoading, refetch: refetchAssigned } = useSupabaseQuery(
    ["exam_questions", examId],
    async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("id, sort_order, question:questions(*)")
        .eq("exam_id", examId)
        .order("sort_order", { ascending: true })
      return { data, error }
    },
    { enabled: !!examId },
  )

  const { data: allQuestions, isLoading: questionsLoading } = useSupabaseQuery(
    ["all-questions"],
    async () => {
      const controller = new AbortController()
      abortRef.current = controller
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal)
      return { data, error }
    },
    { enabled: addOpen },
  )

  const { data: allExamQuestions } = useSupabaseQuery(
    ["all-exam-questions"],
    async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("question_id, exam:exams(id, title)")
        .order("created_at", { ascending: false })
      return { data, error }
    },
    { enabled: addOpen },
  )

  const questionExamMap = useMemo(() => {
    const rows = (allExamQuestions as { question_id: string; exam: { id: string; title: string } | null }[] | undefined) || []
    const map = new Map<string, { id: string; title: string }[]>()
    rows.forEach((r) => {
      if (!r.exam || r.exam.id === examId) return
      const existing = map.get(r.question_id) || []
      if (!existing.some((e) => e.id === r.exam!.id)) {
        existing.push(r.exam!)
        map.set(r.question_id, existing)
      }
    })
    return map
  }, [allExamQuestions, examId])

  const assignMutation = useSupabaseMutation(async (questionIds: string[]) => {
    const rows = questionIds.map((qid, i) => ({ exam_id: examId, question_id: qid, sort_order: i }))
    const { error } = await supabase.from("exam_questions").insert(rows)
    return { data: null, error }
  })

  const removeMutation = useSupabaseMutation(async (rowId: string) => {
    const { error } = await supabase.from("exam_questions").delete().eq("id", rowId)
    return { data: null, error }
  })

  const toggleFreeMutation = useSupabaseMutation(async (is_free: boolean) => {
    const { error } = await supabase.from("exams").update({ is_free }).eq("id", examId)
    return { data: null, error }
  })

  const exam = examData as Record<string, unknown> | undefined
  const course = exam?.course as Record<string, unknown> | undefined
  const assigned = (assignedRows as { id: string; sort_order: number; question: Record<string, unknown> }[] | undefined) || []
  const allQ = (allQuestions as Record<string, unknown>[] | undefined) || []

  const assignedQuestionIds = useMemo(() => new Set(assigned.map((r) => r.question.id)), [assigned])

  useEffect(() => {
    if (addOpen) {
      setPanelHeight(window.innerHeight - 40)
      const onResize = () => setPanelHeight(window.innerHeight - 40)
      window.addEventListener("resize", onResize)
      return () => window.removeEventListener("resize", onResize)
    }
  }, [addOpen])

  useEffect(() => {
    if (!addOpen && abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [addOpen])

  useEffect(() => {
    listRef.current?.scrollToItem(0, "start")
  }, [debouncedSearch])

  const filteredQuestions = useMemo(() => {
    const unassigned = allQ.filter((q) => !assignedQuestionIds.has(q.id as string))
    const query = debouncedSearch.trim().toLowerCase()
    if (query.length === 0) return unassigned

    if (query.length < MIN_SEARCH_LENGTH) return unassigned

    const cacheKey = query
    if (searchCacheRef.current.has(cacheKey)) {
      return searchCacheRef.current.get(cacheKey)!
    }

    const results = unassigned.filter((q) => {
      const text = (q.question_text as string || "").toLowerCase()
      const category = (q.category as string || "").toLowerCase()
      return text.includes(query) || category.includes(query)
    })

    searchCacheRef.current.set(cacheKey, results)
    if (searchCacheRef.current.size > 50) {
      const firstKey = searchCacheRef.current.keys().next().value
      if (firstKey) searchCacheRef.current.delete(firstKey)
    }

    return results
  }, [allQ, assignedQuestionIds, debouncedSearch])

  function toggleSelect(qid: string) {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid)
      else next.add(qid)
      return next
    })
  }

  async function handleAssign() {
    if (selectedQuestionIds.size === 0) return
    try {
      await assignMutation.mutateAsync(Array.from(selectedQuestionIds))
      toast.success("Questions added to exam")
      setSelectedQuestionIds(new Set())
      setAddOpen(false)
      setSearchQuery("")
      searchCacheRef.current.clear()
      refetchAssigned()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add questions")
    }
  }

  async function handleRemove(rowId: string) {
    try {
      await removeMutation.mutateAsync(rowId)
      toast.success("Question removed from exam")
      refetchAssigned()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove question")
    }
  }

  async function handleToggleFree() {
    const current = !!(exam?.is_free as boolean)
    try {
      await toggleFreeMutation.mutateAsync(!current)
      toast.success(current ? "Payment required" : "Free access enabled")
      refetchExam()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update exam")
    }
  }

  async function handleReorder(fromIdx: number, toIdx: number) {
    const items = [...assigned]
    const [moved] = items.splice(fromIdx, 1)
    items.splice(toIdx, 0, moved)
    const updates = items.map((item, i) => ({
      id: item.id,
      sort_order: i,
      question_id: item.question.id,
      exam_id: examId,
    }))
    const { error } = await supabase.from("exam_questions").upsert(updates, { onConflict: "id" })
    if (error) {
      toast.error("Failed to reorder questions")
      return
    }
    refetchAssigned()
  }

  const handleAddOpen = useCallback(() => {
    setSearchQuery("")
    searchCacheRef.current.clear()
    setSelectedQuestionIds(new Set())
    setAddOpen(true)
  }, [])

  const handleAddClose = useCallback(() => {
    setAddOpen(false)
    setSearchQuery("")
    searchCacheRef.current.clear()
  }, [])

  if (examLoading) return <div className="px-4 md:px-6 py-8"><div className="animate-pulse h-8 w-48 bg-surface-container-highest rounded-xl" /></div>

  return (
    <section className="px-4 md:px-6 py-8">
      <button onClick={() => router.push(`/lessons/${courseId}`)} className="flex items-center gap-2 text-on-surface-variant hover:text-primary mb-6 transition-colors">
        <ArrowLeft size={20} />
        <span className="text-label-md">Back to {course?.title as string || "Course"}</span>
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="size-14 bg-primary-container rounded-2xl flex items-center justify-center shrink-0">
          <BookOpen size={28} className="text-on-primary-container" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-headline-lg text-primary">{exam?.title as string}</h2>
            <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" className="sr-only peer" checked={!!(exam?.is_free as boolean)} onChange={handleToggleFree} />
              <div className="relative w-10 h-5 bg-gray-200 rounded-full after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary-container peer-checked:after:translate-x-5 peer-checked:after:border-white" />
            </label>
            <span className="text-label-sm text-on-surface-variant">{(exam?.is_free as boolean) ? "Free" : "Paid"}</span>
          </div>
          <p className="text-body-md text-on-surface-variant">
            {course?.title as string} &middot; {assigned.length} question{assigned.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-headline-sm text-primary">Questions</h3>
        <Button className="flex items-center gap-2" onClick={handleAddOpen}>
          <Plus size={18} />
          Add Questions
        </Button>
      </div>

      {assignedLoading && <div className="animate-pulse space-y-3"><div className="h-16 bg-surface-container-highest rounded-xl" /><div className="h-16 bg-surface-container-highest rounded-xl" /></div>}

      {!assignedLoading && assigned.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <FileQuestion size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-body-lg">No questions in this exam</p>
          <p className="text-body-md">Click &quot;Add Questions&quot; to add questions</p>
        </div>
      )}

      {!assignedLoading && assigned.length > 0 && (
        <div className="space-y-2">
          {assigned.map((row, idx) => (
            <div
              key={row.id}
              draggable
              onDragStart={(e) => {
                dragIndex.current = idx
                e.dataTransfer.effectAllowed = "move"
                e.currentTarget.classList.add("opacity-40")
              }}
              onDragEnd={(e) => {
                e.currentTarget.classList.remove("opacity-40")
                dragIndex.current = null
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                e.currentTarget.classList.add("border-primary")
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-primary")
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove("border-primary")
                const fromIdx = dragIndex.current
                if (fromIdx !== null && fromIdx !== idx) {
                  handleReorder(fromIdx, idx)
                }
                dragIndex.current = null
              }}
              className="flex items-center justify-between bg-surface-container-lowest rounded-xl px-4 py-3 border border-outline-variant/30 group hover:border-primary/50 transition-colors cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-3 min-w-0">
                <GripVertical size={18} className="text-outline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-label-sm text-on-surface-variant w-6 shrink-0">#{idx + 1}</span>
                <span className="text-label-sm bg-primary-container/30 text-primary px-2 py-0.5 rounded-md shrink-0">{row.question.category as string}</span>
                <span className="text-body-md truncate text-on-surface">{row.question.question_text as string}</span>
              </div>
              <div className="shrink-0 ml-4">
                <Dialog>
                  <DialogTrigger render={<button className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors" />}>
                    <Trash2 size={16} />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Remove Question</DialogTitle>
                      <DialogDescription>Remove this question from the exam?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
                      <Button variant="destructive" onClick={() => handleRemove(row.id)} disabled={removeMutation.isPending}>
                        {removeMutation.isPending ? "Removing..." : "Remove"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleAddClose} />
          <div className="relative w-full max-w-lg bg-surface-container-low shadow-xl h-full flex flex-col">

            <div className="shrink-0 p-6 border-b border-outline-variant/30 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-headline-sm text-primary">Add Questions</h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {filteredQuestions.length} question{filteredQuestions.length !== 1 ? "s" : ""} available
                  </p>
                </div>
                <button onClick={handleAddClose} className="p-2 rounded-xl hover:bg-surface-container-higher transition-colors"><X size={20} /></button>
              </div>

              <div className="flex items-center gap-2">
                {filteredQuestions.length > 0 && (
                  <button
                    onClick={() => {
                      const allSelected = filteredQuestions.every((q) => selectedQuestionIds.has(q.id as string))
                      if (allSelected) {
                        setSelectedQuestionIds((prev) => {
                          const next = new Set(prev)
                          filteredQuestions.forEach((q) => next.delete(q.id as string))
                          return next
                        })
                      } else {
                        setSelectedQuestionIds((prev) => {
                          const next = new Set(prev)
                          filteredQuestions.forEach((q) => next.add(q.id as string))
                          return next
                        })
                      }
                    }}
                    className={`shrink-0 size-7 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      filteredQuestions.every((q) => selectedQuestionIds.has(q.id as string))
                        ? "bg-primary border-primary"
                        : "border-outline-variant hover:border-primary/50"
                    }`}
                    title={filteredQuestions.every((q) => selectedQuestionIds.has(q.id as string)) ? "Alles deselecteren" : "Alles selecteren"}
                  >
                    {filteredQuestions.every((q) => selectedQuestionIds.has(q.id as string)) && <Check size={16} className="text-on-primary" />}
                  </button>
                )}

                <div className="relative flex-1 min-w-0">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                  <input
                    type="text"
                    placeholder={`Zoek op vraag of categorie (min. ${MIN_SEARCH_LENGTH} tekens)...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-surface-container-highest rounded-xl text-body-md text-on-surface placeholder:text-on-surface-variant/40 outline-none border border-outline-variant/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  {searchQuery.length > 0 && (
                    <button
                      onClick={() => { setSearchQuery(""); listRef.current?.scrollToItem(0, "start") }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-higher transition-colors"
                    >
                      <X size={16} className="text-on-surface-variant/50" />
                    </button>
                  )}
                </div>
              </div>

              {searchQuery.length > 0 && searchQuery.trim().length < MIN_SEARCH_LENGTH && (
                <p className="text-label-sm text-on-surface-variant/60 flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" />
                  Typ minstens {MIN_SEARCH_LENGTH} tekens om te zoeken
                </p>
              )}
            </div>

            <div className="flex-1 min-h-0">
              {questionsLoading && (
                <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                  <Loader2 size={32} className="animate-spin mb-3 opacity-40" />
                  <p className="text-body-md">Vragen laden...</p>
                </div>
              )}

              {!questionsLoading && filteredQuestions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-on-surface-variant px-6">
                  {searchQuery.trim().length >= MIN_SEARCH_LENGTH ? (
                    <>
                      <Search size={40} className="opacity-30 mb-3" />
                      <p className="text-body-md text-center">Geen vragen gevonden voor &quot;{searchQuery}&quot;</p>
                      <p className="text-body-sm text-center mt-1 opacity-60">Probeer een andere zoekterm</p>
                    </>
                  ) : (
                    <>
                      <FileQuestion size={40} className="opacity-30 mb-3" />
                      <p className="text-body-md">Alle vragen zitten al in dit examen</p>
                    </>
                  )}
                </div>
              )}

              {!questionsLoading && filteredQuestions.length > 0 && (
                <List
                  ref={listRef}
                  height={panelHeight - PANEL_HEIGHT_OFFSET}
                  itemCount={filteredQuestions.length}
                  itemSize={ROW_HEIGHT}
                  width="100%"
                  overscanCount={10}
                >
                  {QuestionRow}
                </List>
              )}
            </div>

            <div className="shrink-0 border-t border-outline-variant/30 p-6 bg-surface-container-low">
              <div className="flex gap-4">
                <button onClick={handleAddClose} className="flex-1 px-6 py-3 border border-outline rounded-xl text-label-md text-on-surface-variant hover:bg-surface-container-low transition-all">Cancel</button>
                <button
                  onClick={handleAssign}
                  disabled={selectedQuestionIds.size === 0 || assignMutation.isPending}
                  className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-xl text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {assignMutation.isPending ? "Adding..." : `Add (${selectedQuestionIds.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
