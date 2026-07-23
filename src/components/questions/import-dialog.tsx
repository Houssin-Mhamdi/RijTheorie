"use client"

import { useState, useCallback, useRef } from "react"
import {
  parseCSV,
  validateRows,
  getImportSummary,
  escapeHtml,
  MAX_FILE_SIZE,
  type ParsedRow,
  type ValidatedRow,
  type ImportDuplicateStrategy,
  type ImportResult,
} from "@/lib/question-import"
import { supabase } from "@/lib/supabase"
import { useTranslation } from "@/lib/i18n/translations"
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from "lucide-react"

type Stage = "upload" | "preview" | "importing" | "done"

type Props = {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation()
  const [stage, setStage] = useState<Stage>("upload")
  const [fileName, setFileName] = useState("")
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [strategy, setStrategy] = useState<ImportDuplicateStrategy>("skip")
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [searchFilter, setSearchFilter] = useState("")
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStage("upload")
    setFileName("")
    setRawRows([])
    setValidatedRows([])
    setParseErrors([])
    setStrategy("skip")
    setImportResult(null)
    setImportProgress({ current: 0, total: 0 })
    setSearchFilter("")
    setShowErrorsOnly(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setParseErrors([`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB`])
      return
    }

    if (!file.name.endsWith(".csv")) {
      setParseErrors(["Only CSV files are supported"])
      return
    }

    setFileName(file.name)
    const text = await file.text()
    const { rows, errors } = parseCSV(text)

    if (errors.length > 0) {
      setParseErrors(errors)
      return
    }

    setRawRows(rows)

    const { data: existing } = await supabase.from("questions").select("id, question_text")
    const existingMap = new Map<string, string>()
    if (existing) {
      for (const q of existing) {
        existingMap.set((q.question_text as string).toLowerCase().trim(), q.id as string)
      }
    }

    const validated = validateRows(rows, existingMap)
    setValidatedRows(validated)
    setStage("preview")
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleImport = useCallback(async () => {
    const summary = getImportSummary(validatedRows, strategy)
    if (summary.toImport === 0) {
      setImportResult({
        totalRows: summary.total,
        imported: 0,
        skipped: summary.skipped,
        failed: summary.withErrors,
        errors: summary.allErrors,
      })
      setStage("done")
      return
    }

    setStage("importing")
    setImportProgress({ current: 0, total: summary.toImport })

    const rowsToImport = validatedRows
      .filter((r) => r.errors.length === 0)
      .filter((r) => !r.isDuplicate || strategy !== "skip")

    const BATCH_SIZE = 50
    let imported = 0
    const allErrors: Array<{ row: number; error: string }> = []
    let skipped = 0

    for (let i = 0; i < rowsToImport.length; i += BATCH_SIZE) {
      const batch = rowsToImport.slice(i, i + BATCH_SIZE)
      const payload = batch.map((r) => ({
        question: escapeHtml(r.question),
        category: escapeHtml(r.category),
        options: [
          r.optionA && { text: escapeHtml(r.optionA), isCorrect: r.correct.toUpperCase() === "A" },
          r.optionB && { text: escapeHtml(r.optionB), isCorrect: r.correct.toUpperCase() === "B" },
          r.optionC && { text: escapeHtml(r.optionC), isCorrect: r.correct.toUpperCase() === "C" },
          r.optionD && { text: escapeHtml(r.optionD), isCorrect: r.correct.toUpperCase() === "D" },
        ].filter(Boolean),
        explanation: r.explanation ? escapeHtml(r.explanation) : null,
        replace_id: strategy === "replace" && r.isDuplicate ? r.existingQuestionId : null,
      }))

      try {
        const res = await fetch("/api/questions/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: payload, strategy }),
        })

        const result: ImportResult = await res.json()

        if (res.ok) {
          imported += result.imported
          skipped += result.skipped
          allErrors.push(...result.errors)
        } else {
          allErrors.push(
            ...batch.map((r) => ({ row: r.rowIndex, error: (result as { error?: string }).error || "Batch import failed" }))
          )
        }
      } catch {
        allErrors.push(
          ...batch.map((r) => ({ row: r.rowIndex, error: "Network error" }))
        )
      }

      setImportProgress({ current: Math.min(i + BATCH_SIZE, rowsToImport.length), total: rowsToImport.length })
    }

    setImportResult({
      totalRows: validatedRows.length,
      imported,
      skipped,
      failed: allErrors.length,
      errors: allErrors,
    })
    setStage("done")
    if (imported > 0) onImported()
  }, [validatedRows, strategy, onImported])

  const downloadErrorReport = useCallback(() => {
    if (!importResult) return
    const header = "Row,Error\n"
    const csv = importResult.errors.map((e) => `${e.row},"${e.error.replace(/"/g, '""')}"`).join("\n")
    const blob = new Blob([header + csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `import-errors-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [importResult])

  const downloadTemplate = useCallback(() => {
    const header = "question,category,option_a,option_b,option_c,option_d,correct,explanation\n"
    const example = '"What does a red traffic light mean?,Traffic,"Stop immediately","Slow down","Speed up","Continue",A,"A red traffic light means you must stop."\n'
    const blob = new Blob([header + example], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "question-import-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const summary = validatedRows.length > 0 ? getImportSummary(validatedRows, strategy) : null
  const filteredRows = validatedRows.filter((r) => {
    if (showErrorsOnly && r.errors.length === 0) return false
    if (searchFilter) {
      const q = searchFilter.toLowerCase()
      return (
        r.question.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.optionA.toLowerCase().includes(q) ||
        r.optionB.toLowerCase().includes(q)
      )
    }
    return true
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-outline-variant/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-primary" />
            <h2 className="text-label-lg font-bold text-primary">{t("import.title")}</h2>
          </div>
          <button onClick={handleClose} className="size-8 rounded-lg flex items-center justify-center hover:bg-surface-container transition-colors">
            <X size={18} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STAGE: Upload */}
          {stage === "upload" && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-outline-variant/50 hover:border-primary/50 hover:bg-surface-container-low"
                }`}
              >
                <Upload size={40} className={`mx-auto mb-4 ${isDragOver ? "text-primary" : "text-outline-variant"}`} />
                <p className="text-label-lg text-on-surface mb-1">{t("import.dropHere")}</p>
                <p className="text-body-md text-on-surface-variant">{t("import.orClick")}</p>
                <p className="text-label-sm text-outline-variant mt-3">CSV — max {MAX_FILE_SIZE / 1024 / 1024}MB — max 10,000 rows</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {parseErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={18} className="text-red-500" />
                    <span className="text-label-md font-bold text-red-700">{t("import.parseErrors")}</span>
                  </div>
                  {parseErrors.map((e, i) => (
                    <p key={i} className="text-body-sm text-red-600 ml-6">{e}</p>
                  ))}
                </div>
              )}

              <div className="bg-surface-container-low rounded-xl p-5">
                <h3 className="text-label-md font-bold text-primary mb-3">{t("import.formatSpec")}</h3>
                <div className="text-body-sm text-on-surface-variant space-y-2">
                  <p><strong>{t("import.requiredColumns")}:</strong> question, category, option_a, option_b, correct</p>
                  <p><strong>{t("import.optionalColumns")}:</strong> option_c, option_d, explanation</p>
                  <p><strong>{t("import.correctValues")}:</strong> A, B, C, or D</p>
                  <p><strong>{t("import.categories")}:</strong> Hazard Perception, Right of Way, Choose Images, Traffic, Lighting</p>
                  <p><strong>{t("import.maxSizes")}:</strong> question {500} chars, options {200} chars, explanation {1000} chars</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 flex items-center gap-2 text-label-sm text-primary hover:underline"
                >
                  <Download size={14} />
                  {t("import.downloadTemplate")}
                </button>
              </div>
            </div>
          )}

          {/* STAGE: Preview */}
          {stage === "preview" && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-low">
                  <FileText size={16} className="text-primary" />
                  <span className="text-label-sm text-on-surface">{t("import.total")}: <strong>{summary?.total ?? 0}</strong></span>
                </div>
                {summary && summary.duplicates > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="text-label-sm text-amber-700">{t("import.duplicates")}: <strong>{summary.duplicates}</strong></span>
                  </div>
                )}
                {summary && summary.withErrors > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200">
                    <XCircle size={16} className="text-red-500" />
                    <span className="text-label-sm text-red-700">{t("import.errors")}: <strong>{summary.withErrors}</strong></span>
                  </div>
                )}
                {summary && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-label-sm text-green-700">{t("import.ready")}: <strong>{summary.toImport}</strong></span>
                  </div>
                )}
              </div>

              {/* Duplicate strategy */}
              {summary && summary.duplicates > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-label-md font-bold text-amber-800 mb-3">{t("import.duplicateStrategy")}</p>
                  <div className="flex flex-wrap gap-3">
                    {([
                      ["skip", t("import.strategySkip")],
                      ["replace", t("import.strategyReplace")],
                      ["import_anyway", t("import.strategyImport")],
                    ] as const).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="strategy"
                          checked={strategy === value}
                          onChange={() => setStrategy(value)}
                          className="accent-primary"
                        />
                        <span className="text-body-md text-on-surface">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={t("import.searchRows")}
                    className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm focus:ring-2 focus:ring-primary"
                  />
                  {searchFilter && (
                    <button onClick={() => setSearchFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                  className={`px-3 py-2 text-label-sm rounded-lg border transition-colors ${
                    showErrorsOnly
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  {t("import.errorsOnly")}
                </button>
                <span className="text-label-sm text-on-surface-variant ml-auto">
                  {filteredRows.length} / {validatedRows.length} {t("import.rows")}
                </span>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/30">
                      <th className="px-3 py-2 text-label-xs font-bold text-on-surface-variant uppercase">#</th>
                      <th className="px-3 py-2 text-label-xs font-bold text-on-surface-variant uppercase">{t("import.colQuestion")}</th>
                      <th className="px-3 py-2 text-label-xs font-bold text-on-surface-variant uppercase">{t("import.colCategory")}</th>
                      <th className="px-3 py-2 text-label-xs font-bold text-on-surface-variant uppercase">{t("import.colOptions")}</th>
                      <th className="px-3 py-2 text-label-xs font-bold text-on-surface-variant uppercase">{t("import.colCorrect")}</th>
                      <th className="px-3 py-2 text-label-xs font-bold text-on-surface-variant uppercase">{t("import.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={`border-b border-outline-variant/10 ${
                          row.errors.length > 0 ? "bg-red-50/50" : row.isDuplicate ? "bg-amber-50/50" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-label-sm text-on-surface-variant tabular-nums">{row.rowIndex}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface max-w-xs truncate">{row.question || <span className="text-red-400 italic">—</span>}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface-variant">{row.category || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-body-sm text-on-surface-variant">
                          {[row.optionA, row.optionB, row.optionC, row.optionD].filter(Boolean).join(" | ") || <span className="text-red-400">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-label-sm font-bold text-primary">{row.correct || <span className="text-red-400">—</span>}</span>
                        </td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.errors.map((e, i) => (
                                <p key={i} className="text-label-xs text-red-600 flex items-start gap-1">
                                  <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                                  {e}
                                </p>
                              ))}
                            </div>
                          ) : row.isDuplicate ? (
                            <span className="text-label-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{t("import.duplicate")}</span>
                          ) : (
                            <span className="text-label-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{t("import.ok")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-on-surface-variant">{t("import.noMatchingRows")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STAGE: Importing */}
          {stage === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <Loader2 size={48} className="text-primary animate-spin" />
              <p className="text-label-lg font-bold text-primary">{t("import.importing")}</p>
              <div className="w-full max-w-md">
                <div className="bg-surface-container rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-body-sm text-on-surface-variant text-center mt-2">
                  {importProgress.current} / {importProgress.total} {t("import.rowsProcessed")}
                </p>
              </div>
            </div>
          )}

          {/* STAGE: Done */}
          {stage === "done" && importResult && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <div className={`size-16 rounded-full mx-auto mb-4 flex items-center justify-center ${importResult.imported > 0 ? "bg-green-100" : "bg-amber-100"}`}>
                  {importResult.imported > 0 ? (
                    <CheckCircle2 size={32} className="text-green-600" />
                  ) : (
                    <AlertTriangle size={32} className="text-amber-500" />
                  )}
                </div>
                <h3 className="text-headline-md text-on-surface font-bold mb-1">
                  {importResult.imported > 0 ? t("import.successTitle") : t("import.nothingImported")}
                </h3>
                <p className="text-body-md text-on-surface-variant">{t("import.importSummary")}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-container-low rounded-xl p-4 text-center">
                  <p className="text-label-xs text-on-surface-variant">{t("import.total")}</p>
                  <p className="text-headline-sm font-bold text-on-surface">{importResult.totalRows}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-label-xs text-green-700">{t("import.imported")}</p>
                  <p className="text-headline-sm font-bold text-green-700">{importResult.imported}</p>
                </div>
                {importResult.skipped > 0 && (
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-label-xs text-amber-700">{t("import.skipped")}</p>
                    <p className="text-headline-sm font-bold text-amber-700">{importResult.skipped}</p>
                  </div>
                )}
                {importResult.failed > 0 && (
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-label-xs text-red-700">{t("import.failed")}</p>
                    <p className="text-headline-sm font-bold text-red-700">{importResult.failed}</p>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-label-md font-bold text-red-700">{t("import.errorDetails")}</h4>
                    <button
                      onClick={downloadErrorReport}
                      className="flex items-center gap-2 text-label-sm text-primary hover:underline"
                    >
                      <Download size={14} />
                      {t("import.downloadReport")}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-red-200 rounded-xl">
                    <table className="w-full text-left">
                      <thead className="bg-red-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-label-xs font-bold text-red-700 uppercase">Row</th>
                          <th className="px-3 py-2 text-label-xs font-bold text-red-700 uppercase">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.errors.map((e, i) => (
                          <tr key={i} className="border-b border-red-100">
                            <td className="px-3 py-1.5 text-label-sm text-on-surface tabular-nums">{e.row}</td>
                            <td className="px-3 py-1.5 text-body-sm text-red-600">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant/30">
          {stage === "upload" && (
            <>
              <button onClick={handleClose} className="px-5 py-2.5 text-label-md text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">
                {t("common.cancel")}
              </button>
            </>
          )}
          {stage === "preview" && (
            <>
              <button onClick={reset} className="px-5 py-2.5 text-label-md text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">
                {t("import.uploadNew")}
              </button>
              <button onClick={handleClose} className="px-5 py-2.5 text-label-md text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleImport}
                disabled={summary?.toImport === 0}
                className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <Upload size={16} />
                {t("import.startImport")} ({summary?.toImport ?? 0})
              </button>
            </>
          )}
          {stage === "done" && (
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:opacity-90 transition-all active:scale-95"
            >
              {t("common.close") ?? "Sluiten"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
