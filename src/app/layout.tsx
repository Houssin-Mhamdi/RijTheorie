import type { Metadata } from "next"
import { Inter, Caveat } from "next/font/google"
import Providers from "@/components/providers"
import { ClarityAnalytics } from "@/components/analytics/clarity-analytics"
import { CookieConsent } from "@/components/cookie-consent"
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, absoluteUrl } from "@/lib/site"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s | RijTheorie Pro",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "rijbewijs theorie",
    "theorie examen oefenen",
    "rijtheorie oefenexamens",
    "CBR theorie",
    "autorijbewijs theorie",
    "theorie leren",
    "theorie-examen oefenen",
  ],
  authors: [{ name: "RijTheorie Pro" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "RijTheorie Pro",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "nl_NL",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
  },
  other: {
    "format-detection": "telephone=no, address=no, email=no",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" dir="ltr" translate="no" className={`${inter.variable} ${caveat.variable} light`} suppressHydrationWarning>
      <body className="bg-background font-sans text-on-surface antialiased" translate="no">
        <Providers>{children}</Providers>
        <ClarityAnalytics />
        <CookieConsent />
      </body>
    </html>
  )
}
