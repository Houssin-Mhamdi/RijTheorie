"use client"

import { Building2, GraduationCap, TrendingUp, ArrowDownRight } from "lucide-react"
import { useTranslation } from "@/lib/i18n/translations"

export function HowItWorks() {
  const { t } = useTranslation()
  return (
    <section className="py-24 bg-white">
      <div className="max-w-container-max-width mx-auto px-margin-desktop text-center mb-16">
        <h2 className="text-headline-lg text-primary mb-4">{t("howItWorks.title")}</h2>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">{t("howItWorks.subtitle")}</p>
      </div>
      <div className="max-w-container-max-width mx-auto px-margin-desktop grid md:grid-cols-3 gap-12 relative">
        <div className="hidden md:block absolute left-[10%] right-[10%] top-4 h-28 z-0 pointer-events-none" aria-hidden>
          <svg className="w-full h-full" viewBox="0 0 1000 120" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M120 55 C 220 55, 220 105, 320 105 C 420 105, 420 35, 500 35 C 600 35, 600 105, 680 105 C 780 105, 780 45, 880 45"
              stroke="var(--color-outline-variant)"
              strokeWidth="2.5"
              strokeDasharray="8 8"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <ArrowDownRight size={26} className="absolute left-[88%] top-[34px] -translate-x-1/2 text-primary" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="size-24 rounded-full bg-primary-container flex items-center justify-center text-on-primary mb-8 shadow-xl">
            <Building2 size={36} />
          </div>
          <h3 className="text-headline-md text-primary mb-4">{t("howItWorks.step1.title")}</h3>
          <p className="text-body-md text-on-surface-variant">{t("howItWorks.step1.description")}</p>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="size-24 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary mb-8 shadow-xl">
            <GraduationCap size={36} />
          </div>
          <h3 className="text-headline-md text-primary mb-4">{t("howItWorks.step2.title")}</h3>
          <p className="text-body-md text-on-surface-variant">{t("howItWorks.step2.description")}</p>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="size-24 rounded-full bg-primary flex items-center justify-center text-on-primary mb-8 shadow-xl">
            <TrendingUp size={36} />
          </div>
          <h3 className="text-headline-md text-primary mb-4">{t("howItWorks.step3.title")}</h3>
          <p className="text-body-md text-on-surface-variant">{t("howItWorks.step3.description")}</p>
        </div>
      </div>
    </section>
  )
}
