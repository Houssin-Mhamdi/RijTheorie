"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession, useLogout } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Search, Bell, HelpCircle, Settings, LogOut, User, FileText, BookOpen, GraduationCap, ClipboardList, Loader2, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/translations"
import { LanguageSwitcher } from "@/components/language-switcher"

interface SearchResult {
  id: string
  label: string
  description?: string
  href: string
  category: string
  icon: typeof FileText
}

interface TopBarProps {
  searchPlaceholder?: string
}

export default function TopBar({ searchPlaceholder }: TopBarProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const logout = useLogout()
  const router = useRouter()
  const placeholder = searchPlaceholder ?? t("topbar.search")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const email = session?.user?.email ?? ""
  const name = session?.user?.user_metadata?.name ?? ""
  const initials = email
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowResults(false)
        setDropdownOpen(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const q = `%${term}%`
      const [
        { data: students },
        { data: questions },
        { data: lessons },
        { data: courses },
        { data: exams },
        { data: subscriptions },
      ] = await Promise.all([
        supabase.from("profiles").select("id, name, email").ilike("name", q).limit(5),
        supabase.from("questions").select("id, question_text, category").ilike("question_text", q).limit(5),
        supabase.from("lessons").select("id, title").ilike("title", q).limit(5),
        supabase.from("courses").select("id, title").ilike("title", q).limit(5),
        supabase.from("exams").select("id, title, description").ilike("title", q).limit(5),
        supabase.from("subscription_plans").select("id, name, description").ilike("name", q).limit(5),
      ])

      const items: SearchResult[] = []

      if (students && students.length > 0) {
        students.forEach((s) => {
          items.push({ id: s.id, label: s.name ?? s.email, description: s.email, href: `/students/${s.id}`, category: "Studenten", icon: User })
        })
      }

      if (questions && questions.length > 0) {
        questions.forEach((q) => {
          items.push({ id: q.id, label: q.question_text.slice(0, 80), description: q.category, href: `/questions`, category: "Vragen", icon: ClipboardList })
        })
      }

      if (lessons && lessons.length > 0) {
        lessons.forEach((l) => {
          items.push({ id: l.id, label: l.title, href: `/learn/${l.id}`, category: "Lessen", icon: BookOpen })
        })
      }

      if (courses && courses.length > 0) {
        courses.forEach((c) => {
          items.push({ id: c.id, label: c.title, href: `/lessons/${c.id}`, category: "Cursussen", icon: GraduationCap })
        })
      }

      if (exams && exams.length > 0) {
        exams.forEach((e) => {
          items.push({ id: e.id, label: e.title, description: e.description ?? undefined, href: `/exams/${e.id}`, category: "Examens", icon: FileText })
        })
      }

      if (subscriptions && subscriptions.length > 0) {
        subscriptions.forEach((s) => {
          items.push({ id: s.id, label: s.name, description: s.description ?? undefined, href: `/subscriptions`, category: "Abonnementen", icon: FileText })
        })
      }

      setResults(items)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (search.length >= 2) {
      setShowResults(true)
      debounceRef.current = setTimeout(() => doSearch(search), 300)
    } else {
      setResults([])
      setShowResults(false)
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, doSearch])

  const navigate = (href: string) => {
    setShowResults(false)
    setSearch("")
    inputRef.current?.blur()
    router.push(href)
  }

  return (
    <>
    <header className="w-full h-16 sticky top-0 z-40 bg-surface shadow-[0px_4px_20px_rgba(26,60,110,0.05)]">
      <div className="flex justify-between items-center px-4 md:px-6 h-full">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative w-full" ref={searchRef}>
            <div className="flex items-center bg-surface-container-low rounded-full px-4 py-1.5 gap-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
              <Search size={18} className="text-on-surface-variant shrink-0" />
              <input
                ref={inputRef}
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-body-md w-full placeholder:text-on-surface-variant"
                placeholder={placeholder}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => { if (results.length > 0 || searching) setShowResults(true) }}
              />
              {searching && <Loader2 size={16} className="animate-spin text-on-surface-variant shrink-0" />}
            </div>

            {showResults && (
              <div className="absolute top-12 left-0 right-0 bg-surface shadow-lg rounded-2xl border border-outline-variant/30 overflow-hidden z-50 max-h-96 overflow-y-auto">
                {results.length === 0 && !searching && (
                  <div className="px-4 py-6 text-center text-label-sm text-on-surface-variant">
                    {t("topbar.noResults")} &ldquo;{search}&rdquo;
                  </div>
                )}
                {results.length > 0 && (
                  <div className="py-2">
                    {(() => {
                      const grouped: Record<string, SearchResult[]> = {}
                      results.forEach((r) => {
                        if (!grouped[r.category]) grouped[r.category] = []
                        grouped[r.category].push(r)
                      })
                      return Object.entries(grouped).map(([cat, items]) => (
                        <div key={cat}>
                          <div className="px-4 py-1.5 text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">{cat}</div>
                          {items.map((item) => (
                            <button
                              key={`${cat}-${item.id}`}
                              onClick={() => navigate(item.href)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-label-md text-on-surface hover:bg-surface-container transition-colors"
                            >
                              <item.icon size={18} className="text-on-surface-variant shrink-0" />
                              <div className="min-w-0 text-left">
                                <p className="truncate">{item.label}</p>
                                {item.description && (
                                  <p className="text-label-xs text-on-surface-variant truncate">{item.description}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                )}
                <div className="border-t border-outline-variant/20 px-4 py-2 text-label-xs text-on-surface-variant flex items-center justify-between">
                  <span>{t("topbar.resultsCount", { n: results.length })}</span>
                  <span>{t("topbar.escToClose")}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-2 sm:ml-4">
          <button className="hidden sm:block hover:bg-surface-container rounded-full p-2 transition-all text-on-surface-variant">
            <Bell size={20} />
          </button>
          <button className="hidden sm:block hover:bg-surface-container rounded-full p-2 transition-all text-on-surface-variant">
            <HelpCircle size={20} />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="size-9 rounded-full bg-primary flex items-center justify-center text-on-primary text-label-sm font-bold hover:opacity-90 transition-all active:scale-95 shrink-0"
            >
              {initials || "?"}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-64 bg-surface shadow-lg rounded-2xl border border-outline-variant/30 overflow-hidden z-50">
                <div className="px-4 py-4 border-b border-outline-variant/20">
                  <p className="text-label-md font-bold text-primary truncate">{name || email}</p>
                  <p className="text-label-xs text-on-surface-variant truncate mt-0.5">{email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { router.push("/dashboard/settings"); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <User size={18} className="text-on-surface-variant" />
                    {t("topbar.profile")}
                  </button>
                  <button
                    onClick={() => { router.push("/dashboard/settings"); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <Settings size={18} className="text-on-surface-variant" />
                    {t("topbar.settings")}
                  </button>
                </div>
                <div className="border-t border-outline-variant/20 py-1">
                  <button
                    onClick={() => { setLogoutOpen(true); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-label-md text-error hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    {t("topbar.logout")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
      {logoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setLogoutOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <button onClick={() => setLogoutOpen(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <X size={20} />
            </button>
            <h3 className="text-headline-md text-primary mb-2">{t("topbar.logout")}</h3>
            <p className="text-body-md text-on-surface-variant mb-6">{t("topbar.logoutConfirm")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLogoutOpen(false)} className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-all">
                {t("common.cancel")}
              </button>
              <button onClick={() => { logout.mutate() }} className="px-5 py-2.5 rounded-xl bg-error text-on-error text-label-md font-bold hover:opacity-90 transition-all flex items-center gap-2">
                <LogOut size={16} />
                {t("topbar.logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}