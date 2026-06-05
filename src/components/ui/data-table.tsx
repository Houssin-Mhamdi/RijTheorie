"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => ReactNode)
  className?: string
  headerClassName?: string
  render?: (value: unknown, row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyFn: (row: T) => string | number
  onRowClick?: (row: T) => void
  isLoading?: boolean
  emptyState?: ReactNode
  actions?: (row: T) => ReactNode
  actionsHeader?: string
  actionsClassName?: string
}

export default function DataTable<T>({
  columns,
  data,
  keyFn,
  onRowClick,
  isLoading,
  emptyState,
  actions,
  actionsHeader = "Acties",
  actionsClassName,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
            <tr>
              {columns.map((col) => (
                <th key={col.header} className={cn("px-6 py-4 font-semibold", col.headerClassName)}>
                  {col.header}
                </th>
              ))}
              {actions && <th className={cn("px-6 py-4 font-semibold text-right", actionsClassName)}>{actionsHeader}</th>}
            </tr>
          </thead>
        </table>
        <div className="flex items-center justify-center py-12">
          <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
            <tr>
              {columns.map((col) => (
                <th key={col.header} className={cn("px-6 py-4 font-semibold", col.headerClassName)}>
                  {col.header}
                </th>
              ))}
              {actions && <th className={cn("px-6 py-4 font-semibold text-right", actionsClassName)}>{actionsHeader}</th>}
            </tr>
          </thead>
        </table>
        <div className="flex items-center justify-center py-16">
          {emptyState ?? <p className="text-body-md text-on-surface-variant">Geen gegevens</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className={cn("px-6 py-4 font-semibold", col.headerClassName)}>
                {col.header}
              </th>
            ))}
            {actions && <th className={cn("px-6 py-4 font-semibold text-right", actionsClassName)}>{actionsHeader}</th>}
          </tr>
        </thead>
        <tbody className="text-body-md text-on-surface divide-y divide-surface-container">
          {data.map((row) => {
            const id = keyFn(row)
            return (
              <tr
                key={id}
                onClick={() => onRowClick?.(row)}
                className={cn("hover:bg-surface-container-lowest transition-colors group", onRowClick && "cursor-pointer")}
              >
                {columns.map((col) => {
                  const value = typeof col.accessor === "function" ? col.accessor(row) : row[col.accessor]
                  return (
                    <td key={col.header} className={cn("px-6 py-5", col.className)}>
                      {col.render ? col.render(value, row) : (value as ReactNode)}
                    </td>
                  )
                })}
                {actions && <td className={cn("px-6 py-5 text-right", actionsClassName)}>{actions(row)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
