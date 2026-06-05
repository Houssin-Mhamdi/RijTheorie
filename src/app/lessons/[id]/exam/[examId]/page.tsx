"use client"

import { useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery, useSupabaseMutation } from "@/lib/supabase-queries"
import { toast } from "sonner"
import { ArrowLeft, Plus, Check, X, Trash2, FileQuestion, BookOpen, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"

export default function ExamDetailPage() {
  const { id: courseId, examId } = useParams<{ id: string; examId: string }>()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const dragIndex = useRef<number | null>(null)

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

  const { data: allQuestions } = useSupabaseQuery(
    ["all-questions"],
    async () => { const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false }); return { data, error } },
    { enabled: addOpen },
  )

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

  const assignedQuestionIds = new Set(assigned.map((r) => r.question.id))

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

  if (examLoading) return <div className="px-4 md:px-6 py-8"><div className="animate-pulse h-8 w-48 bg-surface-container-highest rounded-xl" /></div>

  const unassignedQuestions = allQ.filter((q) => !assignedQuestionIds.has(q.id as string))

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
        <Button className="flex items-center gap-2" onClick={() => setAddOpen(true)}>
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
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface-container-low shadow-xl h-full overflow-y-auto">
            <div className="sticky top-0 bg-surface-container-low z-10 flex items-center justify-between p-6 border-b border-outline-variant/30">
              <div>
                <h3 className="text-headline-sm text-primary">Add Questions</h3>
                <p className="text-body-sm text-on-surface-variant">Select questions to add to this exam</p>
              </div>
              <button onClick={() => setAddOpen(false)} className="p-2 rounded-xl hover:bg-surface-container-higher transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-2">
              {unassignedQuestions.length === 0 && (
                <p className="text-center py-12 text-on-surface-variant text-body-md">All questions are already in this exam</p>
              )}
              {unassignedQuestions.map((q) => (
                <div key={q.id as string} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-higher transition-colors cursor-pointer" onClick={() => toggleSelect(q.id as string)}>
                  <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${selectedQuestionIds.has(q.id as string) ? "bg-primary border-primary" : "border-outline-variant"}`}>
                    {selectedQuestionIds.has(q.id as string) && <Check size={14} className="text-on-primary" />}
                  </div>
                  <span className="text-label-sm bg-primary-container/30 text-primary px-2 py-0.5 rounded-md shrink-0">{q.category as string}</span>
                  <span className="text-body-md truncate">{q.question_text as string}</span>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 border-t border-outline-variant/30 p-6 bg-surface-container-low">
              <div className="flex gap-4">
                <button onClick={() => setAddOpen(false)} className="flex-1 px-6 py-3 border border-outline rounded-xl text-label-md text-on-surface-variant hover:bg-surface-container-low transition-all">Cancel</button>
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
