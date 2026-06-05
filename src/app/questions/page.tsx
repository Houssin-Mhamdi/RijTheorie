"use client"

import { Plus, Filter, TrendingUp, Info, Save, Trash2 } from "lucide-react"
import StatsCard from "@/components/dashboard/stats-card"
import QuestionsTable from "@/components/dashboard/questions-table"
import Pagination from "@/components/dashboard/pagination"
import SlideOver from "@/components/ui/slide-over"
import QuestionForm from "@/components/questions/question-form"
import { useState } from "react"
import type { QuestionInput } from "@/lib/auth-schemas"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery, useSupabaseMutation } from "@/lib/supabase-queries"
import { useSession } from "@/hooks/use-auth"
import { toast } from "sonner"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function mapQuestion(q: Record<string, unknown>) {
  const options = (q.answer_options as Array<{ text: string; isCorrect: boolean }>) || []
  const correctOption = options.find((o) => o.isCorrect)
  return {
    id: q.id as string,
    text: q.question_text as string,
    thumbnail: (q.media as string) || "",
    thumbnailAlt: q.category as string,
    optionCount: options.length,
    correctAnswer: correctOption?.text || "",
    category: q.category as string,
  }
}

export default function QuestionsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null)
  const { data: session } = useSession()
  const [isUploading, setIsUploading] = useState(false)

  const { data: questionsData, isLoading } = useSupabaseQuery(
    ["questions"],
    async () => { const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false }); return { data, error } },
  )

  const createMutation = useSupabaseMutation<QuestionInput, unknown>(async (values) => {
    const { data, error } = await supabase
      .from("questions")
      .insert({
        category: values.category,
        question_text: values.questionText,
        media: values.media || null,
        answer_options: values.answerOptions as unknown as Record<string, unknown>,
        explanation: values.explanation || null,
        created_by: session?.user?.id,
      })
      .select()
      .single()
    return { data, error }
  })

  const updateMutation = useSupabaseMutation<{ id: string; values: QuestionInput }, unknown>(async ({ id, values }) => {
    const { data, error } = await supabase
      .from("questions")
      .update({
        category: values.category,
        question_text: values.questionText,
        media: values.media || null,
        answer_options: values.answerOptions as unknown as Record<string, unknown>,
        explanation: values.explanation || null,
      })
      .eq("id", id)
      .select()
      .single()
    return { data, error }
  })

  async function handleSubmit(data: QuestionInput) {
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, values: data })
        toast.success("Question updated")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Question saved")
      }
      setSlideOverOpen(false)
      setEditId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save question")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await supabase.from("questions").delete().eq("id", deleteTarget.id)
      toast.success("Question deleted")
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete question")
    }
  }

  function handleEdit(q: Record<string, unknown>) {
    const options = (q.answer_options as Array<{ text: string; isCorrect: boolean; x?: number; y?: number }>) || []
    setEditId(q.id as string)
    setSlideOverOpen(true)
  }

  const editQuestion = editId
    ? ((questionsData as Record<string, unknown>[])?.find((q) => q.id === editId) as Record<string, unknown>)
    : null

  const initialData: QuestionInput | undefined = editQuestion
    ? {
        category: editQuestion.category as string,
        questionText: editQuestion.question_text as string,
        media: (editQuestion.media as string) || undefined,
        answerOptions: (editQuestion.answer_options as Array<{ text: string; isCorrect: boolean; x?: number; y?: number }>) || [],
        explanation: (editQuestion.explanation as string) || undefined,
      }
    : undefined

  const questions = (questionsData as Record<string, unknown>[] | undefined)?.map(mapQuestion) || []

  return (
    <section className="px-4 md:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-headline-lg text-primary">Theory Questions</h2>
          <p className="text-body-md text-on-surface-variant">Manage the exam question database.</p>
        </div>
        <button
          onClick={() => { setEditId(null); setSlideOverOpen(true) }}
          className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-6 py-3 rounded-xl font-label-md hover:opacity-90 active:scale-95 transition-all shadow-md"
        >
          <Plus size={20} />
          <span>Add Question</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard label="Total Questions" value={String(questions.length)}>
          {isLoading && <p className="text-on-surface-variant">Loading…</p>}
        </StatsCard>
        <StatsCard label="Most Tested" value="Right of Way">
          <p className="text-on-surface-variant">{(questionsData as Record<string, unknown>[] | undefined)?.filter((q) => q.category === "Right of Way").length || 0} questions</p>
        </StatsCard>
        <StatsCard label="Avg Student Score" value="74.2%">
          <div className="flex items-center gap-1 text-red-600">
            <Info size={16} />
            <span>Hazard perception is tough</span>
          </div>
        </StatsCard>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container overflow-hidden">
        <div className="p-6 border-b border-surface-container flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-label-md text-primary">All Questions</h3>
            <span className="px-2 py-0.5 bg-surface-container text-primary text-[11px] font-bold rounded-full">
              CAR LICENSE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-label-md text-on-surface-variant border border-outline-variant rounded-lg hover:bg-surface-container-low flex items-center gap-2 transition-colors">
              <Filter size={20} />
              Filter
            </button>
          </div>
        </div>

        <QuestionsTable
          questions={questions}
          isLoading={isLoading}
          onEdit={(q) => handleEdit(q as unknown as Record<string, unknown>)}
          onDelete={(q) => setDeleteTarget({ id: String(q.id) })}
        />

        <div className="px-6 py-4 border-t border-surface-container">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(questions.length / 10))}
            from={1}
            to={questions.length}
            total={questions.length}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <SlideOver
        open={slideOverOpen}
        onClose={() => { setSlideOverOpen(false); setEditId(null) }}
        title={editId ? "Edit Question" : "Add Question"}
        description={editId ? "Update the question details" : "Create a new theory question"}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => { setSlideOverOpen(false); setEditId(null) }}
              className="flex-1 px-6 py-3 border border-outline rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="question-form"
              disabled={createMutation.isPending || updateMutation.isPending || isUploading}
              className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={20} />
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <QuestionForm onSubmit={handleSubmit} initialData={initialData ?? null} userId={session?.user?.id} onUploadingChange={setIsUploading} />
      </SlideOver>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Question</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleDelete} className="flex items-center gap-2">
              <Trash2 size={16} />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
