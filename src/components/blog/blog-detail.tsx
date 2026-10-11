"use client"

import Link from "next/link"
import { useTranslation } from "@/lib/i18n/translations"
import type { BlogPost } from "@/types/database"
import { ArrowLeft, Calendar, User, Tag } from "lucide-react"
import { Header, Footer } from "@/components/landing"

const langs = ["nl", "en", "ar"]

/** Figure out the current language against the post's available translations. */
function pickLang(lang: string, post: BlogPost): string {
  const available = Object.keys(post.translations ?? {})
  if (langs.includes(lang) && available.includes(lang)) return lang
  if (available.includes("nl")) return "nl"
  return available[0] ?? "nl"
}

/** Determine layout direction for RTL (Arabic). */
function dirFor(lang: string): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr"
}

/** Convert YouTube links into responsive iframe embeds. */
function editBody(html: string): string {
  const expr =
    /<a[^>]*href="(?:https:\/\/www\.youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|https?:\/\/youtu\.be\/)([a-zA-Z0-9_-]{6,})"[^>]*>[\s\S]*?<\/a>/gi
  return html.replace(expr, (_m, videoId: string) => {
    return `<div class="aspect-video my-4"><iframe class="w-full h-full rounded-xl" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
  })
}

export default function BlogDetail({ post, initialTitle }: { post: BlogPost; initialTitle?: string }) {
  const { t, lang } = useTranslation()
  const currentLang = pickLang(lang, post)
  const dir = dirFor(currentLang)

  const content = post.translations?.[currentLang] ?? Object.values(post.translations ?? {})[0] ?? null
  const title = content?.title || initialTitle || "Untitled"

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString(currentLang === "ar" ? "ar" : currentLang, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : ""

  const plainBody = content?.body ? content.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : ""

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface">
      <Header />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto w-full px-margin-desktop py-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-label-md font-semibold text-on-surface-variant hover:text-primary mb-6"
          >
            <ArrowLeft size={16} /> {t("blog.backToBlog")}
          </Link>

          {(post.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(post.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-surface-container-low px-3 py-1 rounded-full text-label-sm font-semibold text-on-surface-variant"
                >
                  <Tag size={12} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-headline-xl text-primary font-bold mb-3">{title}</h1>

          {content?.subtitle && (
            <p className="text-headline-sm text-on-surface font-semibold mb-4">{content.subtitle}</p>
          )}

          <div className="flex items-center gap-5 text-label-sm text-on-surface-variant mb-8">
            {post.author && (
              <span className="flex items-center gap-1.5">
                <User size={14} />
                {post.author}
              </span>
            )}
            {date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {date}
              </span>
            )}
          </div>

          {post.cover_url && (
            <img
              src={post.cover_url}
              alt={content?.cover_alt || title}
              className="w-full rounded-2xl object-cover mb-8 border border-outline-variant"
            />
          )}

          {content?.description && (
            <p className="text-body-lg text-on-surface-variant mb-8 leading-relaxed">{content.description}</p>
          )}

          <div
            dir={dir}
            className="article-body text-body-md text-on-surface leading-relaxed space-y-4
              [&_h1]:text-headline-lg [&_h1]:font-bold [&_h1]:my-4
              [&_h2]:text-headline-md [&_h2]:font-bold [&_h2]:my-4
              [&_h3]:text-headline-sm [&_h3]:font-bold [&_h3]:my-3
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:my-3
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:my-3
              [&_a]:text-primary [&_a]:underline
              [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-on-surface-variant [&_blockquote]:my-4
              [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-4
              [&_pre]:bg-surface-container [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-4
              [&_code]:bg-surface-container [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
              [&_hr]:my-6 [&_hr]:border-outline-variant
              [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_table]:overflow-hidden [&_table]:rounded-lg
              [&_td]:border [&_td]:border-outline-variant [&_td]:px-3 [&_td]:py-2
              [&_th]:border [&_th]:border-outline-variant [&_th]:px-3 [&_th]:py-2 [&_th]:bg-surface-container-low [&_th]:font-bold"
            dangerouslySetInnerHTML={{ __html: editBody(content?.body ?? "") }}
          />
        </article>
      </main>
      <Footer />
    </div>
  )
}
