"use client"

import { useEffect, useState } from "react"
import { CheckCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  duration_days: number
  features: string[]
  is_active: boolean
}

export function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setPlans(data)
        setLoading(false)
      })
  }, [])

  return (
    <section className="py-24 bg-white" id="prijzen">
      <div className="max-w-container-max-width mx-auto px-margin-desktop">
        <div className="text-center mb-16">
          <h2 className="text-headline-lg text-primary mb-4">Transparante Prijzen</h2>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">Kies het plan dat past bij de omvang van jouw rijschool. Altijd inclusief updates.</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <p className="text-center text-on-surface-variant py-16">Nog geen abonnementen beschikbaar.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan, i) => (
              <div
                key={plan.id}
                className={`flex flex-col p-8 rounded-2xl bg-white relative overflow-hidden ${
                  i === Math.floor(plans.length / 2)
                    ? "border-2 border-secondary-container shadow-xl md:scale-105 z-10"
                    : "border border-surface-container shadow-sm"
                }`}
              >
                {i === Math.floor(plans.length / 2) && (
                  <div className="absolute top-0 right-0 bg-secondary-container text-on-secondary-container text-label-sm px-4 py-1 font-bold uppercase tracking-widest">
                    Meest Gekozen
                  </div>
                )}
                <h3 className="text-headline-md text-primary mb-2">{plan.name}</h3>
                <div className="text-primary mb-6">
                  <span className="text-4xl font-bold">&euro;{plan.price.toFixed(2)}</span>
                  <span className="text-on-surface-variant font-semibold text-label-md">
                    {plan.duration_days === 365
                      ? "/per jaar"
                      : plan.duration_days === 30
                        ? "/per maand"
                        : `/${plan.duration_days} dagen`}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-body-md text-on-surface-variant mb-4">{plan.description}</p>
                )}
                <ul className="space-y-4 mb-10 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-body-md text-on-surface-variant">
                      <CheckCircle className="text-secondary-container shrink-0" size={20} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full font-bold text-label-md text-primary py-4 rounded-xl transition-all ${
                    i === Math.floor(plans.length / 2)
                      ? "bg-secondary-container text-on-secondary-container hover:opacity-90 active:scale-95 shadow-md"
                      : "border-2 border-primary text-primary hover:bg-surface-container"
                  }`}
                >
                  Start {plan.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
