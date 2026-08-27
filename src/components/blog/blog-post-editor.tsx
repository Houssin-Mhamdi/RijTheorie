"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { supabase } from "@/lib/supabase"
import { analyzeSeo } from "@/lib/seo"
import type { BlogPost, BlogTranslation } from "@/types/database"
import { Loader2, Image as ImageIcon, X, CheckCircle2, XCircle, ChevronRight, Globe } from "lucide-react"

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="border border-outline-variant rounded-xl overflow-hidden bg-white p-4 text-body-md text-on-surface-variant">
      Loading editor...
    </div>
  ),
})

interface BlogPostEditorProps {
  initialData?: BlogPost | null
  onClose: () => void
  onSaved: () => void
}

const langLabels: Record<string, string> = {
  nl: "Nederlands", en: "English", ar: "العربية", fr: "Français",
  de: "Deutsch", tr: "Türkçe", pl: "Polski", es: "Español", it: "Italiano",
}

const emptyTranslation: BlogTranslation = {
  title: "",
  subtitle: "",
  description: "",
  meta_title: "",
  meta_description: "",
  body: "",
  cover_alt: "",
}

function slugify(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")    // remove special chars (incl. Arabic, colons)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export default function BlogPostEditor({ initialData, onClose, onSaved }: BlogPostEditorProps) {
  const isEdit = !!initialData
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(["nl"])
  const [activeLang, setActiveLang] = useState<string>("nl")

  const [slug, setSlug] = useState(initialData?.slug ?? "")
  const [coverUrl, setCoverUrl] = useState(initialData?.cover_url ?? "")
  const [author, setAuthor] = useState(initialData?.author ?? "")
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [featured, setFeatured] = useState(initialData?.featured ?? false)
  const [published, setPublished] = useState(initialData?.published ?? false)
  const [translations, setTranslations] = useState<Record<string, BlogTranslation>>(() => {
    const base: Record<string, BlogTranslation> = {}
    const langs = supportedLanguages.length ? supportedLanguages : ["nl"]
    langs.forEach((l) => {
      base[l] = initialData?.translations?.[l] ?? { ...emptyTranslation }
    })
    return base
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from("site_settings").select("languages").eq("id", 1).single().then(({ data }) => {
      const langs = (data?.languages as string[]) || ["nl"]
      setSupportedLanguages(langs)
      if (!langs.includes(activeLang)) setActiveLang(langs[0])
      setTranslations((prev) => {
        const next = { ...prev }
        langs.forEach((l) => {
          if (!next[l]) next[l] = { ...emptyTranslation }
          if (!next[l].cover_alt) next[l] = { ...next[l], cover_alt: next[l].cover_alt ?? "" }
        })
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = translations[activeLang] ?? emptyTranslation
  const setTranslation = (field: keyof BlogTranslation, value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [activeLang]: { ...(prev[activeLang] ?? emptyTranslation), [field]: value },
    }))
  }

  const seo = useMemo(
    () =>
      analyzeSeo({
        title: current.title ?? "",
        metaTitle: current.meta_title ?? "",
        metaDescription: current.meta_description ?? "",
        body: current.body ?? "",
        slug,
        coverUrl,
        language: activeLang,
        tags,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current.title, current.meta_title, current.meta_description, current.body, slug, coverUrl, tags, activeLang],
  )

  const uploadCover = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUploading(true)
    const ext = file.name.split(".").pop() || "jpg"
    const filePath = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from("question-media").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })
    if (!error) {
      const { data: urlData } = supabase.storage.from("question-media").getPublicUrl(filePath)
      setCoverUrl(urlData.publicUrl)
    } else {
      setError("Upload failed: " + error.message)
    }
    setUploading(false)
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags((p) => [...p, t])
    setTagInput("")
  }

  const autoSlug = () => {
    if (slug) return
    // Derive from the NL title (or first non-Arabic title) so the slug stays URL-safe
    const source =
      translations.nl?.title ||
      Object.values(translations).find((t) => /[a-zA-Z0-9]/.test(t?.title ?? ""))?.title ||
      ""
    setSlug(slugify(source))
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    const safeSlug = slugify(slug)
    if (!safeSlug || !current.title || !current.body) {
      setError("Please fill in a slug, a title and a body (in the active language). The slug should not contain special characters.")
      setSaving(false)
      return
    }

    const payload = {
      slug: safeSlug,
      cover_url: coverUrl || null,
      author: author.trim() || null,
      tags,
      featured,
      published,
      translations,
      published_at: published ? initialData?.published_at ?? new Date().toISOString() : null,
    }

    let err
    if (isEdit) {
      ;({ error: err } = await supabase.from("blog_posts").update(payload).eq("id", initialData.id))
    } else {
      ;({ error: err } = await supabase.from("blog_posts").insert(payload))
    }
    setSaving(false)
    if (err) {
      if (err.message.includes("duplicate key")) setError("A post with this slug already exists.")
      else setError(err.message)
      return
    }
    onSaved()
  }

  const ai = (pass: boolean) =>
    pass ? <CheckCircle2 size={16} className="text-green-600 shrink-0" /> : <XCircle size={16} className="text-red-500 shrink-0" />

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container -ml-2">
            <X size={20} />
          </button>
          <h1 className="text-headline-md text-primary font-bold">
            {isEdit ? "Edit Blog Post" : "New Blog Post"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-label-md font-semibold text-on-surface-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="size-4 accent-primary"
            />
            Published
          </label>
          <label className="flex items-center gap-2 text-label-md font-semibold text-on-surface-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="size-4 accent-primary"
            />
            Featured
          </label>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-label-md font-bold hover:bg-primary-container disabled:opacity-50 transition-all active:scale-[0.98] flex items-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Post"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="text-label-md text-error font-medium bg-red-50 p-3 rounded-xl border border-red-200">{error}</div>
          )}

          {/* Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-md font-bold text-on-surface-variant block">SLUG (URL) *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="hoe-haal-je-je-rijbewijs"
                className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none font-mono"
              />
              <p className="text-label-sm text-on-surface-variant">URL will be /blog/{slug || "..."}</p>
            </div>
            <div className="space-y-2">
              <label className="text-label-md font-bold text-on-surface-variant block">AUTHOR</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name / driving school"
                className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Cover */}
          <div className="space-y-2">
            <label className="text-label-md font-bold text-on-surface-variant block">COVER IMAGE</label>
            <div className="flex items-start gap-4">
              {coverUrl ? (
                <div className="relative w-56 rounded-xl overflow-hidden border border-outline-variant group">
                  <img src={coverUrl} alt="Cover" className="w-full h-32 object-cover" />
                  <button
                    onClick={() => setCoverUrl("")}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-56 h-32 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center gap-2 text-on-surface-variant"
                >
                  <ImageIcon size={24} />
                  <span className="text-label-md">Upload cover</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
              />
              <div className="space-y-2 flex-1">
                <label className="text-label-md font-bold text-on-surface-variant block">OR paste image URL</label>
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
                />
                {uploading && <span className="text-label-sm text-primary flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Uploading...</span>}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-label-md font-bold text-on-surface-variant block">TAGS</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                placeholder="type a tag and press Enter"
                className="flex-1 h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
              />
              <button onClick={addTag} className="px-4 h-12 rounded-xl border border-outline-variant text-label-md font-bold hover:bg-surface-container">
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full text-label-sm font-semibold">
                    {t}
                    <button onClick={() => setTags((p) => p.filter((x) => x !== t))}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-outline-variant/30" />

          {/* Language tabs */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Globe size={16} className="text-on-surface-variant" />
              <span className="text-label-md font-bold text-on-surface-variant">Content language:</span>
              <div className="flex flex-wrap gap-2">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    className={`px-4 py-2 rounded-xl text-label-md font-bold transition-all border ${
                      activeLang === lang
                        ? "bg-primary text-white border-primary"
                        : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {langLabels[lang] || lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-language fields */}
            <div className="space-y-4">
              {(["title", "subtitle", "description", "meta_title", "meta_description"] as const).map((field) => (
                <div key={field} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-label-md font-bold text-on-surface-variant block uppercase">{field.replace(/_/g, " ")}{field === "title" ? " *" : ""}</label>
                    {field === "title" && (
                      <button onClick={autoSlug} className="text-label-sm font-semibold text-primary hover:underline">auto-generate slug</button>
                    )}
                  </div>
                  {field === "description" || field === "meta_description" ? (
                    <textarea
                      value={current[field] ?? ""}
                      onChange={(e) => setTranslation(field, e.target.value)}
                      rows={field === "description" ? 2 : 3}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={current[field] ?? ""}
                      onChange={(e) => setTranslation(field, e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
                    />
                  )}
                </div>
              ))}

              <div className="space-y-2">
                <label className="text-label-md font-bold text-on-surface-variant block uppercase">Body * (WYSIWYG)</label>
                <RichTextEditor
                  value={current.body ?? ""}
                  onChange={(html) => setTranslation("body", html)}
                  placeholder={`Write your ${langLabels[activeLang] || activeLang} article here...`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: SEO panel */}
        <div className="w-80 border-l border-outline-variant/30 flex flex-col bg-white">
          <div className="px-5 py-4 border-b border-outline-variant/30">
            <h3 className="text-headline-sm text-primary font-bold flex items-center gap-2">
              SEO Score
              <span className="text-label-sm font-bold text-on-surface-variant">({langLabels[activeLang] || activeLang})</span>
            </h3>
          </div>
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Score ring */}
            <div className="flex items-center gap-4">
              <div className="relative size-24">
                <svg className="size-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-outline-variant" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(seo.score / 100) * 264} 264`}
                    className={`${seo.score >= 80 ? "stroke-green-500" : seo.score >= 50 ? "stroke-amber-500" : "stroke-red-500"}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-headline-md font-bold ${seo.score >= 80 ? "text-green-600" : seo.score >= 50 ? "text-amber-600" : "text-red-600"}`}>{seo.score}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-label-md font-bold">
                  {seo.score >= 80 ? "Great!" : seo.score >= 50 ? "Getting there" : "Needs work"}
                </p>
                <p className="text-label-sm text-on-surface-variant">Optimize for Google first page.</p>
              </div>
            </div>

            {/* Checks */}
            <div className="space-y-1.5">
              {seo.checks.map((c) => (
                <div key={c.id} className="flex items-start gap-2 py-1">
                  {ai(c.passed)}
                  <div className="flex-1">
                    <p className={`text-label-sm font-medium ${c.passed ? "text-on-surface" : "text-on-surface"}`}>{c.label}</p>
                    {c.detail && <p className="text-label-xs text-on-surface-variant">{c.detail}</p>}
                  </div>
                  {c.passed ? <ChevronRight size={14} className="text-green-600" /> : <ChevronRight size={14} className="text-outline-variant" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
