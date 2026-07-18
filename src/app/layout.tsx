import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Providers from "@/components/providers"
import { ClarityAnalytics } from "@/components/analytics/clarity-analytics"
import { CookieConsent } from "@/components/cookie-consent"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "RijTheorie Pro",
  description: "RijTheorie Pro",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${inter.variable} light scroll-smooth`} data-scroll-behavior="smooth" suppressHydrationWarning>

      <body className="font-sans bg-background text-on-surface antialiased">
        <Providers>{children}</Providers>
        <ClarityAnalytics />
        <CookieConsent />
      </body>
    </html>
  )
}
