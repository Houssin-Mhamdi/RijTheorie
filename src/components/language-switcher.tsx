"use client"

import { useTranslation, type LangCode } from "@/lib/i18n/translations"

export function LanguageSwitcher() {
  const { lang, setLang, availableLangs, langLabels } = useTranslation()

  if (availableLangs.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {availableLangs.map((code) => (
        <button
          key={code}
          onClick={() => setLang(code as LangCode)}
          className={`px-2.5 py-1 rounded-full text-label-sm font-bold transition-all active:scale-95 ${
            lang === code
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          {langLabels[code] || code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
