"use client"

import { useForm } from "react-hook-form"
import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { courseSchema, type CourseInput } from "@/lib/auth-schemas"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Car, Motorbike, Bike, Truck, Ship } from "lucide-react"
import { cn } from "@/lib/utils"

const icons = [
  { value: "Car", label: "Car", icon: Car },
  { value: "Motorbike", label: "Motor", icon: Motorbike },
  { value: "Bike", label: "Bromfiets", icon: Bike },
  { value: "Truck", label: "Vrachtwagen", icon: Truck },
  { value: "Ship", label: "Vaarbewijs", icon: Ship },
]

interface CourseFormProps {
  onSubmit: (data: CourseInput) => void
  isPending?: boolean
  initialData?: CourseInput
}

export default function CourseForm({ onSubmit, initialData }: CourseFormProps) {
  const form = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    defaultValues: initialData ?? { title: "", icon_name: "Car", active: true },
  })

  useEffect(() => {
    form.reset(initialData ?? { title: "", icon_name: "Car", active: true })
  }, [initialData, form])

  return (
    <Form {...form}>
      <form id="course-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Course Title</FormLabel>
            <FormControl>
              <input
                {...field}
                placeholder="e.g. Auto Theorie B"
                className="w-full h-12 bg-white border border-outline-variant rounded-xl px-4 focus:ring-2 focus:ring-primary focus:border-primary text-body-md"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="icon_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Icon</FormLabel>
            <FormControl>
              <div className="grid grid-cols-5 gap-3">
                {icons.map((ic) => {
                  const Icon = ic.icon
                  return (
                    <button
                      key={ic.value}
                      type="button"
                      onClick={() => field.onChange(ic.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all",
                        field.value === ic.value
                          ? "border-primary bg-primary-container/20 text-primary"
                          : "border-outline-variant text-on-surface-variant hover:border-primary",
                      )}
                    >
                      <Icon size={24} />
                      <span className="text-[10px] font-medium">{ic.label}</span>
                    </button>
                  )
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="active" render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="active"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="size-5 rounded border-outline-variant text-primary focus:ring-primary"
              />
              <FormLabel htmlFor="active" className="mb-0">Active (published)</FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )} />
      </form>
    </Form>
  )
}
