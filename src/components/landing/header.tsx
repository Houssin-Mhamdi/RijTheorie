"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import { useHeaderScroll } from "@/hooks/use-scroll-animation"
import { useTranslation } from "@/lib/i18n/translations"
import Drawer from "@/components/ui/drawer"
import { LanguageSwitcher } from "@/components/language-switcher"


export function Header() {
  const router = useRouter()
  const isScrolled = useHeaderScroll(120)
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)

  const navItems = [
    { label: t("landing.home"), href: "/" },
    { label: t("landing.features"), href: "#functies" },
    { label: t("landing.pricing"), href: "#prijzen" },
    { label: t("landing.blog"), href: "/blog" },
    { label: t("landing.contact"), href: "#contact" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full transition-all duration-300">
      <div
        className={`flex justify-between items-center w-full transition-all duration-300 ${
          isScrolled
            ? "max-w-container-max-width h-16 mt-3 px-margin-desktop mx-auto rounded-2xl bg-surface/85 dark:bg-primary-container/90 backdrop-blur-lg border border-outline-variant/50 shadow-lg"
            : "max-w-container-max-width h-20 px-margin-desktop mx-auto bg-surface dark:bg-primary-container"
        }`}
      >
        <button onClick={() => router.push("/")} aria-label="Home" className="text-headline-md text-primary dark:text-on-primary-container flex items-center gap-2 transition-transform active:scale-95">
          <img src="/screen.png" alt="RijTheorie Pro" className="h-8 w-auto" />
        </button>
        <nav className="hidden md:flex gap-8 items-center">
          {navItems.map((item) => (
            <a key={item.href} className="text-on-surface-variant dark:text-on-tertiary-container font-medium text-label-md hover:text-secondary dark:hover:text-secondary-fixed transition-colors duration-200" href={item.href}>{item.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher />
          <button onClick={() => router.push("/login")} className="hidden sm:block text-on-surface-variant dark:text-on-tertiary-container font-medium text-label-md px-3 sm:px-4 py-2 hover:bg-surface-container-low rounded-lg transition-all">{t("auth.login")}</button>
          <button onClick={() => router.push("/login")} className="bg-secondary-container text-on-secondary-container font-bold text-label-md px-4 sm:px-6 py-2 sm:py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md whitespace-nowrap">{t("landing.freeStart")}</button>
          <button onClick={() => setMenuOpen(true)} aria-label="Menu" className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-on-surface-variant dark:text-on-tertiary-container hover:bg-surface-container-low transition-all active:scale-95">
            <Menu size={24} />
          </button>
        </div>
      </div>

      <Drawer open={menuOpen} onClose={close}>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={close}
              className="px-4 py-4 rounded-xl text-body-lg font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-3">
          <LanguageSwitcher />
          <button
            onClick={() => { close(); router.push("/login") }}
            className="w-full px-4 py-4 rounded-xl border-2 border-outline-variant text-primary font-bold text-label-md hover:bg-surface-container-low transition-all active:scale-[0.98]"
          >
            {t("auth.login")}
          </button>
          <button
            onClick={() => { close(); router.push("/login") }}
            className="w-full px-4 py-4 rounded-xl bg-secondary-container text-on-secondary-container font-bold text-label-md hover:opacity-90 transition-all active:scale-[0.98] shadow-md"
          >
            {t("landing.freeStart")}
          </button>
        </div>
      </Drawer>
    </header>
  )
}
