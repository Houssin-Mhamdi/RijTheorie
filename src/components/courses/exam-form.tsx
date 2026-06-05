"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { examSchema, type ExamInput } from "@/lib/auth-schemas"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"

interface ExamFormProps {
  onSubmit: (data: ExamInput) => void
  isPending?: boolean
}

export default function ExamForm({ onSubmit }: ExamFormProps) {
  const form = useForm<ExamInput>({
    resolver: zodResolver(examSchema),
    defaultValues: { title: "", description: "", is_free: false },
  })

  return (
    <Form {...form}>
      <form id="exam-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Exam Title</FormLabel>
            <FormControl>
              <input
                {...field}
                placeholder="e.g. Examen 1 - Borden"
                className="w-full h-12 bg-white border border-outline-variant rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-primary text-body-md"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description (optional)</FormLabel>
            <FormControl>
              <textarea
                {...field}
                placeholder="e.g. This exam covers traffic signs"
                rows={3}
                className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary text-body-md resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="is_free" render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Free access</FormLabel>
              <FormControl>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </label>
              </FormControl>
            </div>
            <p className="text-body-sm text-on-surface-variant">Students can take this exam without payment</p>
          </FormItem>
        )} />
      </form>
    </Form>
  )
}