"use client"

import { useEffect } from "react"

export default function ExamError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Exam page crashed:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-8 text-center">
        <p className="text-label-md font-bold text-red-600 mb-2">Er is iets misgegaan</p>
        <h1 className="text-headline-lg text-primary mb-2">Deze pagina kon niet laden</h1>
        <p className="text-body-md text-on-surface-variant mb-4">Sluit het examen en probeer het opnieuw.</p>
        <pre className="text-left bg-surface-container rounded-xl p-4 overflow-auto text-label-xs text-red-700 whitespace-pre-wrap">
          {error.message}
        </pre>
        {error.stack && (
          <pre className="text-left bg-surface-container rounded-xl p-4 overflow-auto text-label-xs text-on-surface-variant whitespace-pre-wrap mt-2 max-h-64">
            {error.stack}
          </pre>
        )}
        <button
          onClick={reset}
          className="mt-4 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-label-md hover:opacity-90 active:scale-95"
        >
          Probeer opnieuw
        </button>
      </div>
    </div>
  )
}
