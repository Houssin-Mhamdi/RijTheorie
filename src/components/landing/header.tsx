"use client"

import { useRouter } from "next/navigation"
import { useHeaderScroll } from "@/hooks/use-scroll-animation"
import { useTranslation } from "@/lib/i18n/translations"


export function Header() {
  const router = useRouter()
  const isScrolled = useHeaderScroll()
  const { t } = useTranslation()

  return (
    <header
      className={`bg-surface dark:bg-primary-container border-b border-outline-variant dark:border-primary shadow-sm w-full top-0 sticky z-50 transition-all duration-300 ${
        isScrolled ? "shadow-md" : ""
      }`}
    >
      <div className="flex justify-between items-center w-full px-margin-desktop h-20 max-w-container-max-width mx-auto">
        <div className="text-headline-md text-primary dark:text-on-primary-container flex items-center gap-2">
          <img src="/screen.png" alt="RijTheorie Pro" className="h-8 w-auto" />
        </div>
        <nav className="hidden md:flex gap-8 items-center">
          <a className="text-on-surface-variant dark:text-on-tertiary-container font-medium text-label-md hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-200" href="#functies">{t("landing.features")}</a>
          <a className="text-on-surface-variant dark:text-on-tertiary-container font-medium text-label-md hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-200" href="#prijzen">{t("landing.pricing")}</a>
          <a className="text-on-surface-variant dark:text-on-tertiary-container font-medium text-label-md hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-200" href="#contact">{t("landing.contact")}</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => router.push("/login")} className="hidden sm:block text-on-surface-variant dark:text-on-tertiary-container font-medium text-label-md px-3 sm:px-4 py-2 hover:bg-surface-container-low rounded-lg transition-all">{t("auth.login")}</button>
          <button onClick={() => router.push("/signup")} className="bg-secondary-container text-on-secondary-container font-bold text-label-md px-4 sm:px-6 py-2 sm:py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md whitespace-nowrap">{t("landing.freeStart")}</button>
        </div>
      </div>
    </header>
  )
}
