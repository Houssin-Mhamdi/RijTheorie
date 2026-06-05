"use client"

import DataTable, { type Column } from "@/components/ui/data-table"
import { Layers, Edit, Trash2 } from "lucide-react"

export interface Question {
  id: string | number
  text: string
  thumbnail: string
  thumbnailAlt: string
  optionCount: number
  correctAnswer: string
  category: string
}

interface QuestionsTableProps {
  questions: Question[]
  isLoading?: boolean
  emptyState?: React.ReactNode
  onEdit?: (question: Question) => void
  onDelete?: (question: Question) => void
}

export default function QuestionsTable({ questions, isLoading, emptyState, onEdit, onDelete }: QuestionsTableProps) {
  const columns: Column<Question>[] = [
    {
      header: "Vraag Tekst",
      accessor: "text" as keyof Question,
      className: "max-w-xs",
      render: (_, q) => <p className="font-medium text-primary truncate">{q.text}</p>,
    },
    {
      header: "Thumbnail",
      accessor: (q) => (
        q.thumbnail ? (
          <img
            alt={q.thumbnailAlt}
            className="w-20 h-12 object-cover rounded-lg shadow-sm border border-surface-container"
            src={q.thumbnail}
          />
        ) : (
          <div className="w-20 h-12 rounded-lg bg-surface-container-higher flex items-center justify-center border border-surface-container">
            <Layers size={16} className="text-on-surface-variant" />
          </div>
        )
      ),
    },
    {
      header: "Antwoorden",
      accessor: (q) => (
        <div className="flex items-center gap-1.5">
          <Layers size={18} className="text-on-surface-variant" />
          {q.optionCount} Opties
        </div>
      ),
    },
    {
      header: "Correct",
      accessor: "correctAnswer" as keyof Question,
      className: "text-center",
      headerClassName: "text-center",
      render: (value) => (
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-label-sm font-bold">{value as string}</span>
      ),
    },
    {
      header: "Categorie",
      accessor: "category" as keyof Question,
      render: (value) => (
        <span className="px-3 py-1 bg-surface-container-high text-primary rounded-full text-label-sm font-medium">
          {value as string}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={questions}
      keyFn={(q) => q.id}
      isLoading={isLoading}
      emptyState={emptyState}
      actions={(q) => (
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={() => onEdit(q)} className="p-2 hover:bg-surface-container rounded-lg text-primary transition-colors">
              <Edit size={20} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(q)} className="p-2 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant transition-colors">
              <Trash2 size={20} />
            </button>
          )}
        </div>
      )}
    />
  )
}
