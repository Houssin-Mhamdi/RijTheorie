import type { Metadata } from "next"
import { SITE_URL, SITE_NAME, absoluteUrl } from "@/lib/site"
import { supabase } from "@/lib/supabase"

export const metadata: Metadata = {
  title: {
    default: "Blog",
    template: "%s",
  },
  description:
    "Artikelen, theorie-uitleg en studietips om in één keer te slagen voor je theorie-examen bij RijTheorie Pro.",
  alternates: {
    canonical: absoluteUrl("/blog"),
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/blog"),
    title: "Blog",
    siteName: SITE_NAME,
    description:
      "Artikelen, theorie-uitleg en studietips om in één keer te slagen voor je theorie-examen bij RijTheorie Pro.",
  },
  twitter: {
    card: "summary",
    title: "Blog",
    description:
      "Artikelen, theorie-uitleg en studietips om in één keer te slagen voor je theorie-examen bij RijTheorie Pro.",
  },
}

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  let itemList: unknown[] = []

  try {
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, title, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(60)

    itemList = (data ?? []).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title ?? p.slug,
      url: absoluteUrl(`/blog/${p.slug}`),
    }))
  } catch {
    // SEO non-blocking
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Blog",
    url: absoluteUrl("/blog"),
    itemListElement: itemList,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
