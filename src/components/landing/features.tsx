"use client"

import { ArrowRight, Image, ClipboardCheck, Lightbulb, LayoutDashboard, BarChart3, MonitorSmartphone } from "lucide-react"

const features = [
  {
    icon: Image,
    title: "Vragen met foto's",
    description: "Haarscherpe afbeeldingen en realistische verkeerssituaties die 1-op-1 aansluiten bij de CBR-examens.",
    color: "#3b6cf5",
  },
  {
    icon: ClipboardCheck,
    title: "Meerdere antwoorden",
    description: "Ondersteuning voor complexe vraagtypes zoals slepen, hotspots en meerkeuze antwoorden.",
    color: "#8b5cf6",
  },
  {
    icon: Lightbulb,
    title: "Uitleg bij elk antwoord",
    description: "Direct inzicht in waarom een antwoord goed of fout is, inclusief verwijzingen naar de verkeersregels.",
    color: "#22c55e",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard rijschool",
    description: "Beheer studenten, bekijk statistieken en verstuur berichten vanuit één centraal controlepaneel.",
    color: "#f59e0b",
  },
  {
    icon: BarChart3,
    title: "Voortgang bijhouden",
    description: "Gedetailleerde overzichten per onderwerp. Zie in één oogopslag waar een student nog extra hulp nodig heeft.",
    color: "#ec4899",
  },
  {
    icon: MonitorSmartphone,
    title: "Werkt op alles",
    description: "Naadloze ervaring op desktop, tablet en mobiel. Oefen overal: in de trein, thuis of in de rijschool.",
    color: "#14b8a6",
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
            <div
              key={feature.title}
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
                <h3 className="text-headline-md text-primary mb-3">{feature.title}</h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
