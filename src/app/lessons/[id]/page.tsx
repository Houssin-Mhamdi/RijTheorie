"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery, useSupabaseMutation } from "@/lib/supabase-queries"
import { toast } from "sonner"
import { ArrowLeft, Plus, Car, Motorbike, Bike, Truck, Ship, FileQuestion, Save, Trash2, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import SlideOver from "@/components/ui/slide-over"
import ExamForm from "@/components/courses/exam-form"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import type { ExamInput } from "@/lib/auth-schemas"

const iconMap: Record<string, typeof Car> = { Car, Motorbike, Bike, Truck, Ship }

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [slideOverOpen, setSlideOverOpen] = useState(false)

  const { data: courseData, isLoading: courseLoading } = useSupabaseQuery(
    ["course", id],
    async () => { const { data, error } = await supabase.from("courses").select("*").eq("id", id).single(); return { data, error } },
    { enabled: !!id },
  )

  const { data: examsData, isLoading: examsLoading, refetch: refetchExams } = useSupabaseQuery(
    ["exams", id],
    async () => { const { data, error } = await supabase.from("exams").select("*, exam_questions(count)").eq("course_id", id).order("created_at", { ascending: true }); return { data, error } },
    { enabled: !!id },
  )

  const createMutation = useSupabaseMutation<ExamInput & { course_id: string }, unknown>(async (values) => {
    const { data, error } = await supabase.from("exams").insert(values).select().single()
    return { data, error }
  })

  const deleteMutation = useSupabaseMutation(async (examId: string) => {
    const { error } = await supabase.from("exams").delete().eq("id", examId)
    return { data: null, error }
  })

  const toggleFreeMutation = useSupabaseMutation(async ({ examId, is_free }: { examId: string; is_free: boolean }) => {
    const { error } = await supabase.from("exams").update({ is_free }).eq("id", examId)
    return { data: null, error }
  })

  const course = courseData as Record<string, unknown> | undefined
  const exams = (examsData as Record<string, unknown>[] | undefined) || []

  async function handleSubmit(data: ExamInput) {
    try {
      await createMutation.mutateAsync({ ...data, course_id: id })
      toast.success("Exam created")
      setSlideOverOpen(false)
      refetchExams()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create exam")
    }
  }

  async function handleDelete(examId: string) {
    try {
      await deleteMutation.mutateAsync(examId)
      toast.success("Exam deleted")
      refetchExams()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete exam")
    }
  }

  async function handleToggleFree(examId: string, current: boolean) {
    try {
      await toggleFreeMutation.mutateAsync({ examId, is_free: !current })
      toast.success(current ? "Payment required" : "Free access enabled")
      refetchExams()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update exam")
    }
  }

  const IconComponent = course ? (iconMap[course.icon_name as string] || Car) : Car

  if (courseLoading) return <div className="px-4 md:px-6 py-8"><div className="animate-pulse h-8 w-48 bg-surface-container-highest rounded-xl" /></div>

  return (
    <section className="px-4 md:px-6 py-8">
      <button onClick={() => router.push("/lessons")} className="flex items-center gap-2 text-on-surface-variant hover:text-primary mb-6 transition-colors">
        <ArrowLeft size={20} />
        <span className="text-label-md">Back to Courses</span>
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="size-14 bg-primary-container rounded-2xl flex items-center justify-center shrink-0">
          <IconComponent size={28} className="text-on-primary-container" />
        </div>
        <div>
          <h2 className="text-headline-lg text-primary">{course?.title as string}</h2>
          <p className="text-body-md text-on-surface-variant">{exams.length} exam{exams.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-headline-sm text-primary">Exams</h3>
        <Button className="flex items-center gap-2" onClick={() => setSlideOverOpen(true)}>
          <Plus size={18} />
          New Exam
        </Button>
      </div>

      {examsLoading && (
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-surface-container-highest rounded-xl" />
          <div className="h-20 bg-surface-container-highest rounded-xl" />
        </div>
      )}

      {!examsLoading && exams.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <BookOpen size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-body-lg">No exams yet</p>
          <p className="text-body-md">Create your first exam for this course</p>
        </div>
      )}

      {!examsLoading && exams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div
              key={exam.id as string}
              onClick={() => router.push(`/lessons/${id}/exam/${exam.id}`)}
              className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 hover:border-secondary-container hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="size-10 rounded-xl bg-primary-container/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BookOpen size={20} className="text-primary" />
                </div>
                <Dialog>
                  <DialogTrigger render={<button className="p-1.5 rounded-lg text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-all" />} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Trash2 size={15} />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Exam</DialogTitle>
                      <DialogDescription>Are you sure you want to delete &quot;{exam.title as string}&quot;? Questions in this exam will not be deleted.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
                      <Button variant="destructive" onClick={() => handleDelete(exam.id as string)} disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <h4 className="text-headline-sm text-primary mb-1">{exam.title as string}</h4>
              {(exam.description as string | undefined) && (
                <p className="text-body-sm text-on-surface-variant mb-3 line-clamp-2">{exam.description as string}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/20">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <FileQuestion size={16} />
                  <span className="text-label-sm">{(exam.exam_questions as { count: number }[] | undefined)?.[0]?.count ?? 0} questions</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only peer" checked={!!(exam.is_free as boolean)} onChange={() => handleToggleFree(exam.id as string, exam.is_free as boolean)} />
                  <div className="relative w-10 h-5 bg-gray-200 rounded-full after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary-container peer-checked:after:translate-x-5 peer-checked:after:border-white" />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <SlideOver
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        title="New Exam"
        description="Create a new exam for this course"
        footer={
          <div className="flex gap-4">
            <button onClick={() => setSlideOverOpen(false)} className="flex-1 px-6 py-3 border border-outline rounded-xl text-label-md text-on-surface-variant hover:bg-surface-container-low transition-all">Cancel</button>
            <button type="submit" form="exam-form" disabled={createMutation.isPending} className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-xl text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={20} />
              {createMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <ExamForm onSubmit={handleSubmit} />
      </SlideOver>
    </section>
  )
}
