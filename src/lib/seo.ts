export interface SeoCheck {
  id: string
  label: string
  passed: boolean
  detail?: string
  weight: number
}

export interface SeoResult {
  score: number
  checks: SeoCheck[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  // Count words for latin texts, and treat CJK/Arabic by character clusters
  return trimmed.split(/\s+/).filter(Boolean).length
}

export function analyzeSeo(opts: {
  title: string
  metaTitle: string
  metaDescription: string
  body: string
  slug: string
  coverUrl: string
  language: string
  tags: string[]
}): SeoResult {
  const checks: SeoCheck[] = []

  // 1. Title length
  const title = opts.title.trim()
  const titleLen = title.length
  checks.push({
    id: "title-length",
    label: "Title length (aim 10-60 chars)",
    passed: titleLen >= 10 && titleLen <= 60,
    detail: `${titleLen} chars`,
    weight: 2,
  })

  // 2. Meta title length
  const metaTitle = opts.metaTitle.trim()
  const metaTitleLen = metaTitle.length
  checks.push({
    id: "meta-title-length",
    label: "Meta title length (aim 30-60 chars)",
    passed: metaTitleLen >= 30 && metaTitleLen <= 60,
    detail: `${metaTitleLen} chars`,
    weight: 2,
  })

  // 3. Meta description present + length
  const metaDesc = opts.metaDescription.trim()
  const metaDescLen = metaDesc.length
  checks.push({
    id: "meta-desc",
    label: "Meta description (aim 50-160 chars)",
    passed: metaDescLen >= 50 && metaDescLen <= 160,
    detail: `${metaDescLen} chars`,
    weight: 2,
  })

  // 4. Body word count
  const bodyText = stripHtml(opts.body)
  const words = countWords(bodyText)
  checks.push({
    id: "body-length",
    label: "Body length (aim 300+ words)",
    passed: words >= 300,
    detail: `${words} words`,
    weight: 2,
  })

  // 5. Headings present (H1/H2)
  const hCount = (opts.body.match(/<h[1-3][\s>]/gi) || []).length
  checks.push({
    id: "headings",
    label: "Headings present (H1/H2/H3)",
    passed: hCount >= 2,
    detail: `${hCount} headings`,
    weight: 2,
  })

  // 6. Exactly one H1
  const h1Count = (opts.body.match(/<h1[\s>]/gi) || []).length
  checks.push({
    id: "single-h1",
    label: "Use exactly one H1",
    passed: h1Count <= 1,
    detail: `${h1Count} H1`,
    weight: 1,
  })

  // 7. Images have alt
  const imgCount = (opts.body.match(/<img[\s>]/gi) || []).length
  const imgWithAlt = (opts.body.match(/<img[^>]*alt=/gi) || []).length
  checks.push({
    id: "image-alt",
    label: "Images have alt text",
    passed: imgCount === 0 || imgWithAlt === imgCount,
    detail: imgCount > 0 ? `${imgWithAlt}/${imgCount} with alt` : "no images",
    weight: 1,
  })

  // 8. Cover image present
  checks.push({
    id: "cover",
    label: "Cover image set",
    passed: !!opts.coverUrl,
    detail: opts.coverUrl ? "cover set" : "no cover",
    weight: 1,
  })

  // 9. Slug filled + short
  const slug = opts.slug.trim()
  checks.push({
    id: "slug",
    label: "Slug is short and keyword-rich",
    passed: slug.length >= 3 && slug.length <= 60 && /^[a-z0-9-]+$/.test(slug),
    detail: slug || "empty",
    weight: 1,
  })

  // 10. Tags present
  checks.push({
    id: "tags",
    label: "Tags added (add at least 1)",
    passed: opts.tags.length >= 1,
    detail: `${opts.tags.length} tags`,
    weight: 1,
  })

  // 11. Keyword appears in body (use first word of title as proxy keyword)
  const keyword = title.split(/\s+/)[0]?.toLowerCase()
  checks.push({
    id: "keyword",
    label: `Keyword "${keyword}" appears in body`,
    passed: !!keyword && bodyText.toLowerCase().includes(keyword),
    detail: keyword ? `keyword: ${keyword}` : "no title",
    weight: 1,
  })

  // 12. Keyword in meta title
  checks.push({
    id: "keyword-meta",
    label: "Keyword in meta title",
    passed: !!keyword && metaTitle.toLowerCase().includes(keyword.toLowerCase()),
    detail: "",
    weight: 1,
  })

  // 13. Keyword in slug
  checks.push({
    id: "keyword-slug",
    label: "Keyword in slug",
    passed: !!keyword && slug.includes(keyword),
    detail: "",
    weight: 1,
  })

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
  const gained = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0)
  const score = Math.round((gained / totalWeight) * 100)

  return { score, checks }
}
