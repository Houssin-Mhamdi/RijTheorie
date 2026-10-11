export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rijtheorie.netlify.app").replace(/\/+$/, "")

export const SITE_NAME = "RijTheorie Pro"

export const SITE_DESCRIPTION =
  "Slaag in één keer voor je theorie-examen. Oefen met realistische examens, praktijkvragen en uitleg — 97% slagingspercentage."

/** Builds an absolute URL from a leading-slash path (or returns the URL unchanged if already absolute). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}
