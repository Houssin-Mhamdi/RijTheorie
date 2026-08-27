"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslation } from "@/lib/i18n/translations"
import { supabase } from "@/lib/supabase"
import type { BlogPost } from "@/types/database"
import { Loader2, Search, Calendar, User, BookOpen } from "lucide-react"
import { Header, Footer } from "@/components/landing"

const langs = ["nl", "en", "ar"]

export default function BlogListPage() {
  const { t, lang, langLabels } = useTranslation()
  const [posts, setPosts] = useState<BlogPost[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data as BlogPost[]) || [])
        setLoading(false)
      })
  }, [])

  const currentLang = (langs.includes(lang) ? lang : "nl")
  const titleFor = (p: BlogPost) => p.translations?.[currentLang]?.title
    || p.translations?.nl?.title
    || Object.values(p.translations ?? {})[0]?.title
    || "Untitled"

  const bodyToText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

  const excerptFor = (p: BlogPost) =>
    p.translations?.[currentLang]?.description
    || (p.translations?.[currentLang]?.body ? bodyToText(p.translations[currentLang].body).slice(0, 160) : "")
    || ""

  const dateFor = (p: BlogPost) => p.published_at
    ? new Date(p.published_at).toLocaleDateString(currentLang === "ar" ? "ar" : currentLang, { year: "numeric", month: "long", day: "numeric" })
    : ""

  const allTags = Array.from(new Set((posts ?? []).flatMap((p) => p.tags ?? [])))
  const filtered = posts?.filter((p) => {
    if (activeTag && !(p.tags ?? []).includes(activeTag)) return false
    if (query) {
      const q = query.toLowerCase()
      const text = (titleFor(p) + " " + bodyToText(p.translations?.[currentLang]?.body ?? "")).toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })

  const featured = (posts ?? []).find((p) => p.featured)

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface">
      <Header />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto w-full px-margin-desktop py-12">
          <div className="text-center mb-10">
            <h1 className="text-headline-xl text-primary font-bold mb-2">{t("blog.title")}</h1>
            <p className="text-body-lg text-on-surface-variant max-w-xl mx-auto">{t("blog.subtitle")}</p>
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("blog.search")}
                className="w-full h-12 pl-11 pr-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white"
              />
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              <button
                onClick={() => setActiveTag(null)}
                className={`px-4 py-2 rounded-full text-label-md font-semibold transition-all ${
                  activeTag === null ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {t("blog.all")}
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`px-4 py-2 rounded-full text-label-md font-semibold transition-all ${
                    activeTag === tag ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Featured hero */}
          {!loading && featured && !query && !activeTag && (
            <Link
              href={`/blog/${featured.slug}`}
              className="block group mb-10 rounded-3xl overflow-hidden border border-outline-variant bg-white shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                {featured.cover_url && (
                  <div className="relative h-56 md:h-auto overflow-hidden">
                    <img src={featured.cover_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <span className="absolute top-4 left-4 bg-secondary text-on-secondary px-3 py-1 rounded-full text-label-sm font-bold">
                      {t("blog.featured")}
                    </span>
                  </div>
                )}
                <div className="p-8 flex flex-col justify-center">
                  <h2 className="text-headline-lg text-primary font-bold mb-3 group-hover:text-secondary transition-colors">{titleFor(featured)}</h2>
                  <p className="text-body-md text-on-surface-variant mb-4 line-clamp-3">{excerptFor(featured)}</p>
                  <div className="flex items-center gap-4 text-label-sm text-on-surface-variant">
                    {featured.author && <span className="flex items-center gap-1.5"><User size={14} />{featured.author}</span>}
                    {dateFor(featured) && <span className="flex items-center gap-1.5"><Calendar size={14} />{dateFor(featured)}</span>}
                  </div>
                </div>
              </div>
            </Link>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>
          ) : filtered && filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <div className="relative h-44 overflow-hidden bg-surface-container-low">
                    {p.cover_url ? (
                      <img src={p.cover_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><BookOpen size={40} className="text-outline-variant" /></div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(p.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag} className="bg-surface-container-low px-2 py-0.5 rounded-full text-label-xs font-semibold text-on-surface-variant">{tag}</span>
                      ))}
                    </div>
                    <h3 className="text-headline-sm font-bold text-on-surface mb-2 group-hover:text-primary transition-colors line-clamp-2">{titleFor(p)}</h3>
                    <p className="text-body-md text-on-surface-variant mb-4 line-clamp-2 flex-1">{excerptFor(p)}</p>
                    <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {dateFor(p) || t("blog.new")}
                      </span>
                      <span className="text-primary font-semibold">{t("blog.readMore")} →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <BookOpen size={40} className="text-outline-variant mx-auto mb-3" />
              <p className="text-body-md text-on-surface-variant">{t("blog.empty")}</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
