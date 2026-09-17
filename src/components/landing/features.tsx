"use client"

import { ArrowRight, Image, ClipboardCheck, Lightbulb, LayoutDashboard, BarChart3, MonitorSmartphone } from "lucide-react"
import { useTranslation } from "@/lib/i18n/translations"

const features = [
  {
    icon: Image,
    titleKey: "features.photo.title",
    descriptionKey: "features.photo.description",
    color: "#3b6cf5",
  },
  {
    icon: ClipboardCheck,
    titleKey: "features.multi.title",
    descriptionKey: "features.multi.description",
    color: "#8b5cf6",
  },
  {
    icon: Lightbulb,
    titleKey: "features.explanation.title",
    descriptionKey: "features.explanation.description",
    color: "#22c55e",
  },
  {
    icon: LayoutDashboard,
    titleKey: "features.dashboard.title",
    descriptionKey: "features.dashboard.description",
    color: "#f59e0b",
  },
  {
    icon: BarChart3,
    titleKey: "features.progress.title",
    descriptionKey: "features.progress.description",
    color: "#ec4899",
  },
  {
    icon: MonitorSmartphone,
    titleKey: "features.devices.title",
    descriptionKey: "features.devices.description",
    color: "#14b8a6",
  },
]

export function Features() {
  const { t } = useTranslation()
  return (
    <section className="py-24 bg-surface" id="functies">
      <div className="max-w-container-max-width mx-auto px-margin-desktop">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h2 className="text-headline-lg text-primary mb-4">{t("features.title")}</h2>
            <p className="text-body-lg text-on-surface-variant max-w-xl">{t("features.subtitle")}</p>
          </div>
          <button className="text-primary font-bold text-label-md flex items-center gap-2 hover:gap-4 transition-all">
            {t("features.viewAll")} <ArrowRight size={20} />
          </button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.titleKey}
              className="relative overflow-hidden bento-card group bg-white p-8 rounded-2xl border border-surface-container-highest shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
            >
              <div
                className="absolute top-0 right-0 h-28 w-28 rounded-bl-[2.5rem] opacity-30 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: feature.color, transformOrigin: "top right" }}
              />
              <div className="relative z-10">
                <div
                  className="size-14 rounded-xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${feature.color}1a`, color: feature.color }}
                >
                  <feature.icon size={30} />
                </div>
                <h3 className="text-headline-md text-primary mb-3">{t(feature.titleKey)}</h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed">{t(feature.descriptionKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
