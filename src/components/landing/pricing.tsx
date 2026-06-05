"use client"

import { CheckCircle } from "lucide-react"

const plans = [
  {
    name: "Starter",
    price: "€49",
    description: "/per maand",
    features: ["Tot 10 studenten", "Alle theorievragen", "Basis dashboard"],
    buttonText: "Start Starter",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "€99",
    description: "/per maand",
    features: ["Tot 50 studenten", "Uitgebreide statistieken", "Eigen huisstijl", "Prioriteit support"],
    buttonText: "Kies Pro Plan",
    highlighted: true,
    badge: "Meest Gekozen",
  },
  {
    name: "School+",
    price: "€199",
    description: "/per maand",
    features: ["Onbeperkt studenten", "Multi-vestiging beheer", "Account manager"],
    buttonText: "Start School+",
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section className="py-24 bg-white" id="prijzen">
      <div className="max-w-container-max-width mx-auto px-margin-desktop">
        <div className="text-center mb-16">
          <h2 className="text-headline-lg text-primary mb-4">Transparante Prijzen</h2>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">Kies het plan dat past bij de omvang van jouw rijschool. Altijd inclusief updates.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col p-8 rounded-2xl bg-white relative overflow-hidden ${
                plan.highlighted
                  ? "border-2 border-secondary-container shadow-xl scale-105 z-10"
                  : "border border-surface-container shadow-sm"
              }`}
            >
              {plan.badge && (
                <div className="absolute top-0 right-0 bg-secondary-container text-on-secondary-container text-label-sm px-4 py-1 font-bold uppercase tracking-widest">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-headline-md text-primary mb-2">{plan.name}</h3>
              <div className="text-primary mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-on-surface-variant font-semibold text-label-md">{plan.description}</span>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-body-md text-on-surface-variant">
                    <CheckCircle className="text-secondary-container" size={20} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full font-bold text-label-md text-primary py-4 rounded-xl transition-all ${
                  plan.highlighted
                    ? "bg-secondary-container text-on-secondary-container hover:opacity-90 active:scale-95 shadow-md"
                    : "border-2 border-primary text-primary hover:bg-surface-container"
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
