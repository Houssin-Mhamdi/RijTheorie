"use client"

import { Plus, Filter, TrendingUp, Info, Save, Trash2, Search, X, ChevronDown } from "lucide-react"
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
import { cn } from "@/lib/utils"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterMedia, setFilterMedia] = useState<"all" | "with" | "without">("all")
  const [filterAnswers, setFilterAnswers] = useState<"all" | "min3" | "exact4">("all")
  const [showFilters, setShowFilters] = useState(false)

  const { data: questionsData, isLoading } = useSupabaseQuery(
    ["questions"],
    async () => { const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false }); return { data, error } },
  )

  const { data: examAttempts, isLoading: attemptsLoading } = useSupabaseQuery(
    ["exam_attempts", "admin"],
    async () => {
      const res = await fetch("/api/exam/stats")
      if (!res.ok) return { data: null, error: null }
      const json = await res.json()
      return { data: json.attempts, error: null }
    },
  )

  const avgScore = (() => {
    if (!examAttempts || examAttempts.length === 0) return null
    const total = examAttempts.reduce((sum: number, a: Record<string, unknown>) => {
      const s = a as Record<string, unknown>
      const score = s.score as number
      const totalQ = s.total_questions as number
      return sum + (totalQ > 0 ? (score / totalQ) * 100 : 0)
    }, 0)
    return Math.round(total / examAttempts.length)
  })()

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

  const categories = [...new Set(questions.map((q) => q.category))].filter(Boolean)

  const filteredQuestions = questions.filter((q) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!q.text.toLowerCase().includes(query) && !q.category.toLowerCase().includes(query) && !q.correctAnswer.toLowerCase().includes(query)) {
        return false
      }
    }
    if (filterCategory !== "all" && q.category !== filterCategory) return false
    if (filterMedia === "with" && !q.thumbnail) return false
    if (filterMedia === "without" && q.thumbnail) return false
    if (filterAnswers === "min3" && q.optionCount < 3) return false
    if (filterAnswers === "exact4" && q.optionCount !== 4) return false
    return true
  })

  const activeFilterCount = [filterCategory !== "all", filterMedia !== "all", filterAnswers !== "all", searchQuery.length > 0].filter(Boolean).length

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
        <StatsCard label="Avg Student Score" value={avgScore !== null ? `${avgScore}%` : "—"}>
          <div className="flex items-center gap-1 text-on-surface-variant">
            <span>{examAttempts?.length ?? 0} completed exams</span>
          </div>
        </StatsCard>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container overflow-hidden">
        <div className="p-6 border-b border-surface-container flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-label-md text-primary">All Questions</h3>
            <span className="px-2 py-0.5 bg-surface-container text-primary text-[11px] font-bold rounded-full">
              {filteredQuestions.length} / {questions.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                placeholder="Search questions..."
                className="pl-9 pr-4 py-2 w-48 md:w-64 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "px-4 py-2 text-label-md border rounded-lg flex items-center gap-2 transition-colors",
                activeFilterCount > 0
                  ? "bg-primary text-on-primary border-primary"
                  : "text-on-surface-variant border-outline-variant hover:bg-surface-container-low"
              )}
            >
              <Filter size={20} />
              Filter
              {activeFilterCount > 0 && (
                <span className="size-5 rounded-full bg-white/30 text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="px-6 py-4 border-b border-surface-container bg-surface-container-low flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-label-xs text-on-surface-variant font-bold uppercase">Categorie</label>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1) }}
                className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="all">Alle categorieën</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-xs text-on-surface-variant font-bold uppercase">Media</label>
              <select
                value={filterMedia}
                onChange={(e) => { setFilterMedia(e.target.value as "all" | "with" | "without"); setCurrentPage(1) }}
                className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="all">Alles</option>
                <option value="with">Met media</option>
                <option value="without">Zonder media</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-xs text-on-surface-variant font-bold uppercase">Antwoorden</label>
              <select
                value={filterAnswers}
                onChange={(e) => { setFilterAnswers(e.target.value as "all" | "min3" | "exact4"); setCurrentPage(1) }}
                className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="all">Alles</option>
                <option value="min3">Minimaal 3 antwoorden</option>
                <option value="exact4">Precies 4 antwoorden</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterCategory("all"); setFilterMedia("all"); setFilterAnswers("all"); setSearchQuery(""); setCurrentPage(1) }}
                className="self-end px-3 py-2 text-label-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1"
              >
                <X size={14} />
                Wis alles
              </button>
            )}
          </div>
        )}

        <QuestionsTable
          questions={filteredQuestions}
          isLoading={isLoading}
          onEdit={(q) => handleEdit(q as unknown as Record<string, unknown>)}
          onDelete={(q) => setDeleteTarget({ id: String(q.id) })}
        />

        <div className="px-6 py-4 border-t border-surface-container">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(filteredQuestions.length / 10))}
            from={filteredQuestions.length > 0 ? 1 : 0}
            to={Math.min(filteredQuestions.length, 10)}
            total={filteredQuestions.length}
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
