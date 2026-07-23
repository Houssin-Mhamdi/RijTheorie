import { z } from "zod"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_ROWS = 10_000
const MAX_QUESTION_LENGTH = 500
const MAX_OPTION_LENGTH = 200
const MAX_EXPLANATION_LENGTH = 1000

const VALID_CATEGORIES = [
  "Hazard Perception",
  "Right of Way",
  "Choose Images",
  "Traffic",
  "Lighting",
] as const

export type ValidCategory = (typeof VALID_CATEGORIES)[number]

export const CSV_COLUMNS = {
  required: ["question", "category", "option_a", "option_b", "correct"],
  optional: ["option_c", "option_d", "explanation"],
} as const

export const ACCEPTED_CORRECT_VALUES = ["A", "B", "C", "D", "a", "b", "c", "d"]

export type ImportDuplicateStrategy = "skip" | "replace" | "import_anyway"

export type ParsedRow = {
  rowIndex: number
  question: string
  category: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correct: string
  explanation: string
}

export type ValidatedRow = ParsedRow & {
  errors: string[]
  isDuplicate: boolean
  existingQuestionId?: string
}

export type ImportResult = {
  totalRows: number
  imported: number
  skipped: number
  failed: number
  errors: Array<{ row: number; error: string }>
}

export function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const errors: string[] = []

  if (lines.length === 0) {
    return { rows: [], errors: ["File is empty"] }
  }

  if (lines.length - 1 > MAX_ROWS) {
    errors.push(`Too many rows: ${lines.length - 1}. Maximum is ${MAX_ROWS}`)
    return { rows: [], errors }
  }

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())

  const requiredCols = [...CSV_COLUMNS.required]
  const missingCols = requiredCols.filter((c) => !header.includes(c))
  if (missingCols.length > 0) {
    errors.push(`Missing required columns: ${missingCols.join(", ")}`)
    return { rows: [], errors }
  }

  const colIndex = (name: string) => header.indexOf(name)

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    const row: ParsedRow = {
      rowIndex: i + 1,
      question: cells[colIndex("question")]?.trim() ?? "",
      category: cells[colIndex("category")]?.trim() ?? "",
      optionA: cells[colIndex("option_a")]?.trim() ?? "",
      optionB: cells[colIndex("option_b")]?.trim() ?? "",
      optionC: cells[colIndex("option_c")]?.trim() ?? "",
      optionD: cells[colIndex("option_d")]?.trim() ?? "",
      correct: cells[colIndex("correct")]?.trim() ?? "",
      explanation: cells[colIndex("explanation")]?.trim() ?? "",
    }
    rows.push(row)
  }

  return { rows, errors }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        result.push(current)
        current = ""
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

export function validateRows(rows: ParsedRow[], existingQuestions: Map<string, string>): ValidatedRow[] {
  return rows.map((row) => {
    const errors: string[] = []

    if (!row.question) {
      errors.push("Question text is empty")
    } else if (row.question.length > MAX_QUESTION_LENGTH) {
      errors.push(`Question exceeds ${MAX_QUESTION_LENGTH} characters`)
    }

    if (!row.category) {
      errors.push("Category is empty")
    }

    if (!row.optionA) errors.push("Option A is empty")
    else if (row.optionA.length > MAX_OPTION_LENGTH) errors.push(`Option A exceeds ${MAX_OPTION_LENGTH} characters`)

    if (!row.optionB) errors.push("Option B is empty")
    else if (row.optionB.length > MAX_OPTION_LENGTH) errors.push(`Option B exceeds ${MAX_OPTION_LENGTH} characters`)

    if (row.optionC && row.optionC.length > MAX_OPTION_LENGTH) errors.push(`Option C exceeds ${MAX_OPTION_LENGTH} characters`)
    if (row.optionD && row.optionD.length > MAX_OPTION_LENGTH) errors.push(`Option D exceeds ${MAX_OPTION_LENGTH} characters`)

    if (!row.correct) {
      errors.push("Correct answer is empty")
    } else if (!ACCEPTED_CORRECT_VALUES.includes(row.correct)) {
      errors.push(`Correct answer must be A, B, C, or D (got "${row.correct}")`)
    }

    if (row.explanation && row.explanation.length > MAX_EXPLANATION_LENGTH) {
      errors.push(`Explanation exceeds ${MAX_EXPLANATION_LENGTH} characters`)
    }

    const correctIdx = ACCEPTED_CORRECT_VALUES.indexOf(row.correct.toLowerCase())
    const options = [row.optionA, row.optionB, row.optionC, row.optionD].filter(Boolean)
    if (row.correct && correctIdx >= 0 && correctIdx >= options.length) {
      errors.push(`Correct answer is ${row.correct.toUpperCase()} but only ${options.length} options provided`)
    }

    const questionKey = row.question.toLowerCase().trim()
    const isDuplicate = existingQuestions.has(questionKey)
    const existingQuestionId = isDuplicate ? existingQuestions.get(questionKey) : undefined

    return { ...row, errors, isDuplicate, existingQuestionId }
  })
}

export function getImportSummary(rows: ValidatedRow[], strategy: ImportDuplicateStrategy) {
  const withErrors = rows.filter((r) => r.errors.length > 0)
  const duplicates = rows.filter((r) => r.isDuplicate)
  const clean = rows.filter((r) => r.errors.length === 0 && !r.isDuplicate)

  let toImport: ValidatedRow[]
  let skipped = 0

  if (strategy === "skip") {
    toImport = clean
    skipped = duplicates.length
  } else if (strategy === "replace") {
    toImport = rows.filter((r) => r.errors.length === 0)
  } else {
    toImport = rows.filter((r) => r.errors.length === 0)
    skipped = 0
  }

  return {
    total: rows.length,
    toImport: toImport.length,
    withErrors: withErrors.length,
    duplicates: duplicates.length,
    skipped,
    allErrors: rows.flatMap((r) =>
      r.errors.map((e) => ({ row: r.rowIndex, error: e }))
    ),
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export { MAX_FILE_SIZE, MAX_ROWS, VALID_CATEGORIES }
