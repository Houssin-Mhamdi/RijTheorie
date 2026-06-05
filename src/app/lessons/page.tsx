"use client"

import { Car, Motorbike, Bike, Truck, Ship, Filter, Download, Plus, TrendingUp, ArrowRight, Save } from "lucide-react"
import CourseCard from "@/components/dashboard/course-card"
import { Button } from "@/components/ui/button"
import SlideOver from "@/components/ui/slide-over"
import CourseForm from "@/components/courses/course-form"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery, useSupabaseMutation } from "@/lib/supabase-queries"
import { useSession } from "@/hooks/use-auth"
import { toast } from "sonner"
import type { CourseInput } from "@/lib/auth-schemas"
import { useRouter } from "next/navigation"

const iconMap: Record<string, typeof Car> = { Car, Motorbike, Bike, Truck, Ship }

function mapCourse(c: Record<string, unknown>, totalStudents: number) {
  return {
    id: c.id as string,
    icon: iconMap[c.icon_name as string] || Car,
    title: c.title as string,
    studentCount: totalStudents,
    active: c.active as boolean,
    draft: !c.active,
  }
}

export default function CoursesPage() {
  const router = useRouter()
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const { data: session } = useSession()

  const { data: coursesData, isLoading, refetch: refetchCourses } = useSupabaseQuery(
    ["courses"],
    async () => { const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false }); return { data, error } },
  )

  const { data: totalStudents = 0 } = useSupabaseQuery(
    ["student-count"],
    async () => {
      const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student")
      return { data: count ?? 0, error }
    },
  )

  const createMutation = useSupabaseMutation<CourseInput, unknown>(async (values) => {
    const { data, error } = await supabase.from("courses").insert({ ...values, created_by: session?.user?.id }).select().single()
    return { data, error }
  })

  const toggleMutation = useSupabaseMutation(async ({ courseId, active: newActive }: { courseId: string; active: boolean }) => {
    const { error } = await supabase.from("courses").update({ active: newActive }).eq("id", courseId)
    return { data: null, error }
  })

  async function handleSubmit(data: CourseInput) {
    try {
      await createMutation.mutateAsync(data)
      toast.success("Course created")
      setSlideOverOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create course")
    }
  }

  const courses = (coursesData as Record<string, unknown>[] | undefined)?.map((c) => mapCourse(c, totalStudents)) || []

  return (
    <section className="px-4 md:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-headline-lg text-primary">Cursussen Overzicht</h2>
          <p className="text-body-md text-on-surface-variant">
            Beheer en bekijk de voortgang van alle beschikbare theoriecursussen.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter size={20} />
            Filter
          </Button>
          <Button className="flex items-center gap-2">
            <Download size={20} />
            Rapport
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-6 min-h-[340px] animate-pulse" />
        ))}

        {!isLoading && courses.map((course) => (
          <div key={course.id} onClick={() => router.push(`/lessons/${course.id}`)} className="cursor-pointer">
            <CourseCard
              icon={course.icon}
              title={course.title}
              studentCount={course.studentCount}
              active={course.active}
              onToggle={async () => {
                await toggleMutation.mutateAsync({ courseId: course.id, active: !course.active })
                refetchCourses()
              }}
              draft={course.draft}
            />
          </div>
        ))}

        <button
          onClick={() => setSlideOverOpen(true)}
          className="border-2 border-dashed border-outline-variant rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-on-surface-variant hover:border-secondary-container hover:text-primary transition-all group min-h-[340px]"
        >
          <div className="size-12 rounded-full bg-surface-container flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus size={24} />
          </div>
          <span className="text-label-md">Nieuwe Cursus Toevoegen</span>
        </button>
      </div>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-primary-container text-on-primary-container p-8 rounded-3xl relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-headline-md mb-2">Populairste Cursus</h4>
            <p className="text-body-md mb-6 opacity-80">
              Auto Theorie B groeit met 12% deze maand.
            </p>
            <button className="bg-secondary-container text-on-secondary-container px-6 py-2 rounded-full font-bold active:scale-95 transition-transform">
              Bekijk Statistieken
            </button>
          </div>
          <TrendingUp size={160} className="absolute -right-4 -bottom-4 opacity-10 rotate-12 text-on-primary-container" />
        </div>

        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] flex items-center justify-between">
          <div>
            <h4 className="text-headline-md text-primary mb-2">Studenten Verzoeken</h4>
            <p className="text-body-md text-on-surface-variant">
              Er zijn 4 openstaande vragen over de &apos;Motor Theorie&apos; cursus.
            </p>
            <button className="mt-4 text-secondary font-bold flex items-center gap-1 hover:underline">
              Beantwoord nu
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="flex -space-x-3 shrink-0">
            <img alt="Student" className="size-12 rounded-full border-4 border-surface-container-lowest" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBiOa-mbu3bKKq9NSrWgP_uMIhWO-Hf_IX7lyIJWhh6263LlgbgaLXGC8b6D0yEH5xzxcbxMTxgKKxaWnXc85Xly2VO6v4umEUeOSBHP9eRrcgctJ9zaV2SKxiVgMyGeEdBCkBEmqrC-I_BfQfjX0vO8s9c02k227RSdLJ3TxLynYYYyC6R9CXDrzx7RRwEwTrv6r7EISp2ck6z0z2QsoQtVs68JleBg4bB0h_sMDoezZuvqCUhNwVGQ77-OMC0HKkp0AlbQZ99XTtU" />
            <img alt="Student" className="size-12 rounded-full border-4 border-surface-container-lowest" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMRiPNnXmXDoTSrEU00XTeA99nU9JXtWvilWHyH0Mfg0lDtA2u-OKhS3-VQPLGAwnd66loR8f8fLom-Ghd4pBc_QQ_qvbLSTPeaTFokg8b-fs9FU2lgW8lfgViSwzQnQB7ljmOwtkXG-pTCsFVdlHeQO8r50kUvBKl1xpJa7AJBiOGbj1CN7T6W_YF-5Sn9gHBOB_d_m1mFma32L16goO2CHPc62FnIzpxD55N0auLJQng-a_P98k-nhdVAjeuZYykLDci_aMiw-gM" />
            <div className="size-12 rounded-full border-4 border-surface-container-lowest bg-surface-container-highest flex items-center justify-center text-label-sm font-bold text-on-surface-variant">+2</div>
          </div>
        </div>
      </section>

      <SlideOver
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        title="Nieuwe Cursus"
        description="Maak een nieuwe theoriecursus aan"
        footer={
          <div className="flex gap-4">
            <button onClick={() => setSlideOverOpen(false)} className="flex-1 px-6 py-3 border border-outline rounded-xl text-label-md text-on-surface-variant hover:bg-surface-container-low transition-all">Cancel</button>
            <button type="submit" form="course-form" disabled={createMutation.isPending} className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-xl text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={20} />
              {createMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <CourseForm onSubmit={handleSubmit} />
      </SlideOver>
    </section>
  )
}
