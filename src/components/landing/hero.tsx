"use client"

import { ArrowRight, PlayCircle, BadgeCheck, Camera, Zap, Timer, Check, Info } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "@/lib/i18n/translations"

const HERO_PICS = ["/hero/hero-1.png", "/hero/hero-2.png", "/hero/hero-3.png"]

const HERO_SLIDES = [
  {
    question: "Je nadert dit kruispunt. Wie heeft hier voorrang?",
    options: ["De rode auto", "De blauwe auto", "Jij"],
    correct: 1,
    explanation: "Je verleent voorrang aan verkeer van rechts op gelijkwaardige kruispunten.",
  },
  {
    question: "Mag je hier inhalen?",
    options: ["Ja", "Nee", "Alleen als het rustig is"],
    correct: 0,
    explanation: "Bij een doorgetrokken streep mag je niet inhalen.",
  },
  {
    question: "Wat is de maximumsnelheid binnen de bebouwde kom?",
    options: ["30 km/u", "50 km/u", "70 km/u"],
    correct: 1,
    explanation: "Binnen de bebouwde kom geldt tenzij anders aangegeven 50 km/u.",
  },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Hero() {
  const { t } = useTranslation()
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const [options, setOptions] = useState<number[]>(shuffle([0, 1, 2]))

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % HERO_SLIDES.length)
      setOptions(shuffle([0, 1, 2]))
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const active = HERO_SLIDES[slide]
  const letter = ["A", "B", "C"]
  return (
    <section className="relative pt-16 pb-24 overflow-hidden">
      <div className="max-w-container-max-width mx-auto px-margin-desktop grid md:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-block py-1 px-3 bg-primary-fixed text-on-primary-fixed font-semibold text-label-md rounded-full mb-6 uppercase tracking-wider">{t("hero.badge")}</span>
          <h1 className="text-display-lg text-primary mb-6 leading-tight">
            {t("hero.title")}<br /><span className="text-secondary-container">{t("hero.titleAccent")}</span>{t("hero.titleSuffix")}
          </h1>
          <p className="text-body-lg text-on-surface-variant mb-10 max-w-lg">{t("hero.subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button onClick={() => router.push("/login")} className="bg-secondary-container text-on-secondary-container font-bold text-label-md px-8 py-4 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2">
              {t("landing.freeStart")} <ArrowRight size={20} />
            </button>
            <button className="border-2 border-primary text-primary font-bold text-label-md px-8 py-4 rounded-xl hover:bg-primary-container hover:text-on-primary transition-all flex items-center justify-center gap-2">
              {t("hero.demo")} <PlayCircle size={20} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-on-surface-variant opacity-80 border-t border-outline-variant pt-8">
            <div className="flex items-center gap-2 font-semibold text-label-md">
              <BadgeCheck className="text-primary" size={20} /> {t("hero.feature1")}
            </div>
            <div className="flex items-center gap-2 font-semibold text-label-md">
              <Camera className="text-primary" size={20} /> {t("hero.feature2")}
            </div>
            <div className="flex items-center gap-2 font-semibold text-label-md">
              <Zap className="text-primary" size={20} /> {t("hero.feature3")}
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="bg-white rounded-3xl p-6 hero-mockup-shadow border border-surface-container-highest relative z-10">
            <div className="flex justify-between items-center mb-6 border-b border-surface-container pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary-container flex items-center justify-center text-white">
                  <Timer size={16} />
                </div>
                <div>
                  <div className="font-semibold text-label-md text-on-surface">{t("hero.questionCount")}</div>
                  <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden mt-1">
                    <div className="bg-secondary-container h-full w-[18%]" />
                  </div>
                </div>
              </div>
              <span className="text-headline-md text-primary">28:45</span>
            </div>
            <div className="rounded-2xl overflow-hidden mb-6 aspect-video bg-surface-container relative">
              <img
                key={HERO_PICS[slide]}
                className="w-full h-full object-cover transition-opacity duration-500"
                alt={t("hero.imageAlt")}
                src={HERO_PICS[slide]}
              />
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-primary text-white font-medium text-label-sm rounded-lg opacity-90">{t("hero.imageLabel")}</div>
              <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/50 text-white font-medium text-label-sm rounded-lg">{slide + 1}/{HERO_SLIDES.length}</div>
            </div>
            <p key={`q-${slide}`} className="text-headline-md text-on-surface mb-6 fade-in">{active.question}</p>
            <div className="space-y-3 mb-6">
              {options.map((optIdx, i) => {
                const isCorrect = optIdx === active.correct
                return (
                  <div key={`${slide}-${optIdx}`} className={`p-4 rounded-xl flex items-center gap-3 ${
                    isCorrect
                      ? "border-2 border-secondary-container bg-surface-container-highest cursor-pointer"
                      : "border border-outline-variant cursor-pointer hover:border-primary transition-all group"
                  }`}>
                    <div className={`size-6 rounded-full flex items-center justify-center ${
                      isCorrect
                        ? "bg-secondary-container text-white text-xs"
                        : "border-2 border-outline-variant group-hover:border-primary"
                    }`}>
                      {isCorrect ? <Check size={16} className="text-white" /> : letter[i]}
                    </div>
                    <span className={`text-body-md ${isCorrect ? "font-semibold text-secondary" : "text-on-surface-variant"}`}>{active.options[optIdx]}</span>
                  </div>
                )
              })}
            </div>
            <div key={`e-${slide}`} className="p-4 bg-surface-container-low border-l-4 border-secondary-container rounded-r-xl fade-in">
              <div className="flex items-center gap-2 mb-1 text-secondary font-bold text-label-md">
                <Info size={16} /> {t("exam.explanation")}
              </div>
              <p className="font-semibold text-label-md text-on-surface-variant">{active.explanation}</p>
            </div>
          </div>
          <div className="relative z-10 flex justify-center gap-2 mt-5">
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => { setSlide(i); setOptions(shuffle([0, 1, 2])) }}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === slide ? "w-6 bg-secondary-container" : "w-2 bg-outline-variant hover:bg-outline"
                }`}
              />
            ))}
          </div>
          <div className="absolute -top-10 -right-10 size-32 bg-secondary-container opacity-10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 size-48 bg-primary-container opacity-10 rounded-full blur-3xl" />
        </div>
      </div>
    </section>
  )
}
