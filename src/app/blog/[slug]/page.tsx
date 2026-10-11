import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { absoluteUrl } from "@/lib/site"
import type { BlogPost } from "@/types/database"
import BlogDetail from "@/components/blog/blog-detail"

export const revalidate = 3600

const langs = ["nl", "en", "ar"]

export async function generateStaticParams() {
  const { data } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("published", true)
  return (data ?? []).map((p) => ({ slug: p.slug }))
}

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle()
    return (data as BlogPost) ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) {
    return {
      title: "Blog",
      alternates: { canonical: absoluteUrl(`/blog/${slug}`) },
    }
  }

  const nl = post.translations?.nl
  const title = nl?.meta_title || nl?.title || "Blog"
  const description = nl?.meta_description || nl?.description || ""
  const url = absoluteUrl(`/blog/${slug}`)

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      publishedTime: post.published_at ?? undefined,
      images: post.cover_url ? [{ url: post.cover_url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.cover_url ? [post.cover_url] : undefined,
    },
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const lang = (translations: BlogPost["translations"], fallback = "nl") => {
    return translations?.[fallback] ?? Object.values(translations ?? {})[0] ?? null
  }
  const nl = lang(post.translations)
  const title = nl?.title || "Blog"

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: nl?.meta_title || nl?.title || "",
    description: nl?.meta_description || nl?.description || "",
    image: post.cover_url || undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? undefined,
    author: post.author ? { "@type": "Person", name: post.author } : undefined,
    mainEntityOfPage: absoluteUrl(`/blog/${slug}`),
    inLanguage: "nl",
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...jsonLd, "@type": "BlogPosting", inLanguage: "nl" }) }}
      />
      <BlogDetail post={post} initialTitle={title} />
    </>
  )
}
