import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn"),
})

export const signupSchema = z
  .object({
    name: z.string().min(2, "Naam moet minimaal 2 tekens zijn"),
    email: z.email("Ongeldig e-mailadres"),
    password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn"),
    confirmPassword: z.string().min(1, "Bevestig je wachtwoord"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"],
  })

export const lessonSchema = z.object({
  title: z.string().min(3, "Titel moet minimaal 3 tekens zijn"),
  content: z.string().min(10, "Inhoud moet minimaal 10 tekens zijn"),
  category: z.string().min(1, "Categorie is verplicht"),
  published: z.boolean(),
})

const translationEntrySchema = z.object({
  lang: z.string().min(2),
  questionText: z.string().optional(),
  answerOptions: z.array(z.object({ text: z.string().optional() })).optional(),
  explanation: z.string().optional(),
  active: z.boolean().optional().default(true),
})

export const questionSchema = z.object({
  category: z.string().min(1, "Category is required"),
  questionText: z.string().min(1, "Question text is required"),
  media: z.string().optional(),
  pauseAt: z.number().min(0.5).default(3),
  answerOptions: z
    .array(z.object({ text: z.string().min(1, "Option text is required"), isCorrect: z.boolean(), x: z.number().min(0).max(100).optional(), y: z.number().min(0).max(100).optional(), imageUrl: z.string().optional() }))
    .min(1, "At least one answer option is required")
    .refine((options) => options.some((o) => o.isCorrect), {
      message: "At least one option must be marked as correct",
    }),
  explanation: z.string().optional(),
  translations: z.array(translationEntrySchema).optional(),
})

export type LoginInput = { email: string; password: string }
export type SignupInput = { name: string; email: string; password: string; confirmPassword: string }
export type LessonInput = z.infer<typeof lessonSchema>
export type QuestionInput = z.infer<typeof questionSchema>

export const courseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  icon_name: z.string().min(1, "Icon is required"),
  active: z.boolean(),
})

export type CourseInput = z.infer<typeof courseSchema>

export const examSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  is_free: z.boolean(),
  duration_minutes: z.number().min(1, "Duration must be at least 1 minute"),
  pass_type: z.enum(["percentage", "count"]),
  pass_threshold: z.number().min(1).max(100, "Threshold must be between 1 and 100"),
  pass_count: z.number().min(1, "Minimum correct answers must be at least 1"),
})

export type ExamInput = z.infer<typeof examSchema>
