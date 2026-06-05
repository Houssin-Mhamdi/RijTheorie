"use client"

import { ArrowRight, PlayCircle, BadgeCheck, Camera, Zap, Timer, Check, Info } from "lucide-react"

export function Hero() {
  return (
    <section className="relative pt-16 pb-24 overflow-hidden">
      <div className="max-w-container-max-width mx-auto px-margin-desktop grid md:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-block py-1 px-3 bg-primary-fixed text-on-primary-fixed font-semibold text-label-md rounded-full mb-6 uppercase tracking-wider">#1 Rijtheorie Platform</span>
          <h1 className="text-display-lg text-primary mb-6 leading-tight">
            Slaag voor je <br /><span className="text-secondary-container">theorie-examen.</span> Gegarandeerd.
          </h1>
          <p className="text-body-lg text-on-surface-variant mb-10 max-w-lg">De meest complete en moderne theorie-ervaring voor rijscholen en studenten. Gebaseerd op de nieuwste CBR-richtlijnen van 2024.</p>
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button className="bg-secondary-container text-on-secondary-container font-bold text-label-md px-8 py-4 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2">
              Gratis starten <ArrowRight size={20} />
            </button>
            <button className="border-2 border-primary text-primary font-bold text-label-md px-8 py-4 rounded-xl hover:bg-primary-container hover:text-on-primary transition-all flex items-center justify-center gap-2">
              Bekijk demo <PlayCircle size={20} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-on-surface-variant opacity-80 border-t border-outline-variant pt-8">
            <div className="flex items-center gap-2 font-semibold text-label-md">
              <BadgeCheck className="text-primary" size={20} /> CBR-examenstof
            </div>
            <div className="flex items-center gap-2 font-semibold text-label-md">
              <Camera className="text-primary" size={20} /> Foto- en videovragen
            </div>
            <div className="flex items-center gap-2 font-semibold text-label-md">
              <Zap className="text-primary" size={20} /> Direct feedback
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
                  <div className="font-semibold text-label-md text-on-surface">Vraag 12 van 65</div>
                  <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden mt-1">
                    <div className="bg-secondary-container h-full w-[18%]" />
                  </div>
                </div>
              </div>
              <span className="text-headline-md text-primary">28:45</span>
            </div>
            <div className="rounded-2xl overflow-hidden mb-6 aspect-video bg-surface-container relative">
              <img
                className="w-full h-full object-cover"
                alt="Kruispunt Situatie"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2vTZbHxz6HTscXgyWe0e38DZiTu9Jwf0qgMA2Wdto8YwDh2TthQdi6ixpU-_mWCzPZky9BhrCEwDT8ZiHdXz99aKoDXodt1AbJqiX2dKlRXnUEN2mAouEj45Wgdx5f9SRe35n8I7ehVRJi-Orp4AAc6awXZQLVOXd3ky2Kvjl1Y4qu08IBu6kw587OsIXJpXIu0rVw36YXFDVwg-J9bC70-dh1N6JprnxiSgufmo-owMqoHRYUQsTvvjLGX3sKs2xuFie-eb3A7aQ"
              />
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-primary text-white font-medium text-label-sm rounded-lg opacity-90">Kruispunt Situatie</div>
            </div>
            <p className="text-headline-md text-on-surface mb-6">Je nadert dit kruispunt. Wie heeft hier voorrang?</p>
            <div className="space-y-3 mb-6">
              <div className="p-4 border border-outline-variant rounded-xl flex items-center gap-3 cursor-pointer hover:border-primary transition-all group">
                <div className="size-6 rounded-full border-2 border-outline-variant flex items-center justify-center group-hover:border-primary">A</div>
                <span className="text-body-md text-on-surface-variant">De auto van rechts</span>
              </div>
              <div className="p-4 border-2 border-secondary-container bg-surface-container-highest rounded-xl flex items-center gap-3 cursor-pointer">
                <div className="size-6 rounded-full bg-secondary-container text-white flex items-center justify-center text-xs">
                  <Check size={16} className="text-white" />
                </div>
                <span className="text-body-md font-semibold text-secondary">Jijzelf, omdat je op een voorrangsweg rijdt</span>
              </div>
              <div className="p-4 border border-outline-variant rounded-xl flex items-center gap-3 cursor-pointer hover:border-primary transition-all group">
                <div className="size-6 rounded-full border-2 border-outline-variant flex items-center justify-center group-hover:border-primary">C</div>
                <span className="text-body-md text-on-surface-variant">Iedereen die van links komt</span>
              </div>
            </div>
            <div className="p-4 bg-surface-container-low border-l-4 border-secondary-container rounded-r-xl">
              <div className="flex items-center gap-2 mb-1 text-secondary font-bold text-label-md">
                <Info size={16} /> Uitleg
              </div>
              <p className="font-semibold text-label-md text-on-surface-variant">Kijk naar verkeersbord B1. Dit geeft aan dat bestuurders op deze weg voorrang hebben bij het naderende kruispunt.</p>
            </div>
          </div>
          <div className="absolute -top-10 -right-10 size-32 bg-secondary-container opacity-10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 size-48 bg-primary-container opacity-10 rounded-full blur-3xl" />
        </div>
      </div>
    </section>
  )
}
