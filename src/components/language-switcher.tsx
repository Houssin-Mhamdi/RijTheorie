"use client"

import { Languages } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation, type LangCode } from "@/lib/i18n/translations"

const PREFERRED: LangCode[] = ["nl", "en", "ar"]

export function LanguageSwitcher() {
  const { lang, setLang, availableLangs, langLabels } = useTranslation()

  const available =
    availableLangs && availableLangs.length > 0 ? availableLangs : PREFERRED
  const langs = PREFERRED.filter((code) => available.includes(code))

  return (
    <Select value={lang} onValueChange={(value) => setLang(value as LangCode)}>
      <SelectTrigger
        size="sm"
        className="gap-1.5 text-on-surface-variant dark:text-on-tertiary-container [&_svg]:text-current"
        aria-label="Taal / Language"
      >
        <Languages className="size-4 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {langs.map((code) => (
          <SelectItem key={code} value={code}>
            {langLabels[code] ?? code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}