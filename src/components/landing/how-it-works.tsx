"use client"

import { Building2, GraduationCap, TrendingUp } from "lucide-react"

export function HowItWorks() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-container-max-width mx-auto px-margin-desktop text-center mb-16">
        <h2 className="text-headline-lg text-primary mb-4">Hoe werkt het?</h2>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">In drie simpele stappen naar een hoger slagingspercentage voor jouw rijschool.</p>
      </div>
      <div className="max-w-container-max-width mx-auto px-margin-desktop grid md:grid-cols-3 gap-12 relative">
        <div className="hidden md:block absolute top-12 left-1/3 right-1/4 h-0.5 border-t-2 border-dashed border-outline-variant z-0" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="size-24 rounded-full bg-primary-container flex items-center justify-center text-on-primary mb-8 shadow-xl">
            <Building2 size={36} />
          </div>
          <h3 className="text-headline-md text-primary mb-4">1. Rijschool maakt account</h3>
          <p className="text-body-md text-on-surface-variant">Binnen 2 minuten is je platform ingericht. Voeg je logo toe en nodig studenten uit via e-mail of link.</p>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="size-24 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary mb-8 shadow-xl">
            <GraduationCap size={36} />
          </div>
          <h3 className="text-headline-md text-primary mb-4">2. Studenten oefenen</h3>
          <p className="text-body-md text-on-surface-variant">Studenten krijgen toegang tot duizenden vragen, inclusief video-situaties en gevaarherkenning op elk device.</p>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="size-24 rounded-full bg-primary flex items-center justify-center text-on-primary mb-8 shadow-xl">
            <TrendingUp size={36} />
          </div>
          <h3 className="text-headline-md text-primary mb-4">3. Slaagpercentage stijgt</h3>
          <p className="text-body-md text-on-surface-variant">Houd de voortgang nauwkeurig bij via het dashboard. Je ziet direct wie klaar is voor het echte CBR-examen.</p>
        </div>
      </div>
    </section>
  )
}
