"use client"

import { ArrowRight, Image, ClipboardCheck, Lightbulb, LayoutDashboard, BarChart3, MonitorSmartphone } from "lucide-react"

const features = [
  {
    icon: Image,
    title: "Vragen met foto's",
    description: "Haarscherpe afbeeldingen en realistische verkeerssituaties die 1-op-1 aansluiten bij de CBR-examens.",
  },
  {
    icon: ClipboardCheck,
    title: "Meerdere antwoorden",
    description: "Ondersteuning voor complexe vraagtypes zoals slepen, hotspots en meerkeuze antwoorden.",
  },
  {
    icon: Lightbulb,
    title: "Uitleg bij elk antwoord",
    description: "Direct inzicht in waarom een antwoord goed of fout is, inclusief verwijzingen naar de verkeersregels.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard rijschool",
    description: "Beheer studenten, bekijk statistieken en verstuur berichten vanuit één centraal controlepaneel.",
  },
  {
    icon: BarChart3,
    title: "Voortgang bijhouden",
    description: "Gedetailleerde overzichten per onderwerp. Zie in één oogopslag waar een student nog extra hulp nodig heeft.",
  },
  {
    icon: MonitorSmartphone,
    title: "Werkt op alles",
    description: "Naadloze ervaring op desktop, tablet en mobiel. Oefen overal: in de trein, thuis of in de rijschool.",
  },
]

export function Features() {
  return (
    <section className="py-24 bg-surface" id="functies">
      <div className="max-w-container-max-width mx-auto px-margin-desktop">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h2 className="text-headline-lg text-primary mb-4">Alles wat je nodig hebt</h2>
            <p className="text-body-lg text-on-surface-variant max-w-xl">Een complete suite aan tools om theorie-onderwijs naar de 21e eeuw te brengen.</p>
          </div>
          <button className="text-primary font-bold text-label-md flex items-center gap-2 hover:gap-4 transition-all">
            Bekijk alle functies <ArrowRight size={20} />
          </button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="bento-card bg-white p-8 rounded-2xl border border-surface-container-highest shadow-sm">
              <div className="size-14 bg-surface-container rounded-xl flex items-center justify-center mb-6">
                <feature.icon className="text-primary" size={30} />
              </div>
              <h3 className="text-headline-md text-primary mb-3">{feature.title}</h3>
              <p className="text-body-md text-on-surface-variant leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
