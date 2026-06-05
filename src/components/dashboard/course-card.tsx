import { type LucideIcon, Users } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

interface CourseCardProps {
  icon: LucideIcon
  title: string
  studentCount: number
  active: boolean
  onToggle: () => void
  draft?: boolean
}

export default function CourseCard({ icon: Icon, title, studentCount, active, onToggle, draft }: CourseCardProps) {
  return (
    <Card className={`flex flex-col rounded-2xl p-6 shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-transparent hover:border-secondary-container transition-all group min-h-[340px] justify-between ${draft ? "opacity-75" : ""}`} size="sm">
      <CardContent className="p-0 flex flex-col gap-0 flex-1">
        <div
          className={`size-12 rounded-xl flex items-center justify-center mb-4 ${
            draft
              ? "bg-surface-container-highest text-on-surface-variant"
              : "bg-primary-container text-on-primary-container"
          }`}
        >
          <Icon size={24} />
        </div>

        <h3 className="text-headline-md text-primary mb-2 leading-tight">{title}</h3>

        <div className="flex items-center gap-2 text-on-surface-variant">
          <Users size={18} />
          <span className="text-label-md">
            {studentCount.toLocaleString()} Studenten{draft ? " (Draft)" : ""}
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-0 mt-6 border-t border-outline-variant pt-4 flex items-center justify-between">
        <span className="text-label-md text-on-surface">Status</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={active} onChange={() => onToggle()} className="sr-only peer" />
          <div className={`w-11 h-6 rounded-full transition-colors after:content-[''] after:absolute after:left-1 after:top-1 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all ${active ? "bg-primary-container after:translate-x-5" : "bg-surface-container-highest after:translate-x-0"}`} />
        </label>
      </CardFooter>
    </Card>
  )
}
