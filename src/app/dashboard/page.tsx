"use client"

import { useProfile } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import type { Lesson, Profile } from "@/types/database"
import { BookOpen, Users, FileText, TrendingUp } from "lucide-react"

export default function DashboardPage() {
  const { data: profile } = useProfile()

  const { data: lessons } = useSupabaseQuery<Lesson[]>(
    ["lessons", "all"],
    async () => { const { data, error } = await supabase.from("lessons").select("*").order("order_index"); return { data, error } },
  )

  const { data: allProfiles } = useSupabaseQuery<Profile[]>(
    ["profiles", "all"],
    async () => { const { data, error } = await supabase.from("profiles").select("*"); return { data, error } },
  )

  const totalLessons = lessons?.length ?? 0
  const publishedLessons = lessons?.filter((l) => l.published).length ?? 0
  const totalStudents = allProfiles?.filter((p) => p.role === "student").length ?? 0

  const stats = [
    { label: "Totaal lessen", value: totalLessons, icon: FileText, color: "text-blue-600 bg-blue-100" },
    { label: "Gepubliceerd", value: publishedLessons, icon: BookOpen, color: "text-green-600 bg-green-100" },
    { label: "Studenten", value: totalStudents, icon: Users, color: "text-purple-600 bg-purple-100" },
    { label: "Actief", value: "—", icon: TrendingUp, color: "text-orange-600 bg-orange-100" },
  ]

  return (
    <div className="px-4 md:px-6 py-8">
      <h1 className="text-headline-lg text-primary mb-2">Welkom, {profile?.name ?? "Admin"}</h1>
      <p className="text-body-md text-on-surface-variant mb-8">Overzicht van je RijTheorie Pro platform</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-outline-variant/20 bg-surface p-6">
            <div className={`inline-flex p-3 rounded-lg ${stat.color} mb-4`}>
              <stat.icon size={24} />
            </div>
            <p className="text-display-lg text-primary">{stat.value}</p>
            <p className="text-body-md text-on-surface-variant">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface p-6">
        <h2 className="text-headline-md text-primary mb-4">Snel acties</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/dashboard/lessons/new" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-body-md hover:opacity-90 transition-opacity">
            Nieuwe les aanmaken
          </a>
          <a href="/dashboard/lessons" className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-body-md hover:opacity-90 transition-opacity">
            Alle lessen bekijken
          </a>
        </div>
      </div>
    </div>
  )
}
