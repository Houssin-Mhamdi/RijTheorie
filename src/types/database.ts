export type Profile = {
  id: string
  email: string
  name: string
  role: "admin" | "student"
  created_at: string
  last_active_at: string | null
  avatar_url: string | null
  language: string
}

export type Lesson = {
  id: string
  title: string
  content: string
  category: string
  order_index: number
  published: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type LessonFormData = {
  title: string
  content: string
  category: string
  published: boolean
}

export type UserProgress = {
  id: string
  user_id: string
  lesson_id: string
  completed: boolean
  score: number | null
  completed_at: string | null
  created_at: string
}

export type SiteSettings = {
  id: number
  site_name: string
  site_logo_url: string | null
  languages: string[]
  created_at: string
  updated_at: string
}
