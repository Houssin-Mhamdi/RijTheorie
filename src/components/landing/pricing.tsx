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
          <div className="grid md:grid-cols-3 gap-8 items-stretch pt-6">
            {plans.map((plan, i) => {
              const featured = i === Math.floor(plans.length / 2)
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1 ${
                    featured
                      ? "bg-gradient-to-br from-[#3b6cf5] via-[#2450d8] to-[#0f2f7a] text-white shadow-2xl md:scale-105 z-10 border-0"
                      : "bg-white border border-outline-variant/40 shadow-sm hover:shadow-xl"
                  }`}
                >
                  {featured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary-container text-on-secondary-container text-label-sm px-5 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-md whitespace-nowrap z-20">
                      Meest Gekozen
                    </div>
                  )}
                  <h3 className={`text-headline-md font-bold mb-1 ${featured ? "text-white" : "text-primary"}`}>{plan.name}</h3>
                  {plan.description && (
                    <p className={`text-body-md mb-6 ${featured ? "text-white/80" : "text-on-surface-variant"}`}>{plan.description}</p>
                  )}
                  <div className={`mb-8 ${featured ? "text-white" : "text-primary"}`}>
                    <div className="flex items-end gap-1">
                      <span className="text-5xl font-extrabold tracking-tight">&euro;{plan.price.toFixed(2)}</span>
                    </div>
                    <span className={`text-label-md font-medium ${featured ? "text-white/70" : "text-on-surface-variant"}`}>
                      {plan.duration_days === 365
                        ? "per jaar"
                        : plan.duration_days === 30
                          ? "per maand"
                          : `${plan.duration_days} dagen`}
                    </span>
                  </div>
                  <ul className="space-y-4 mb-10 flex-grow">
                    {plan.features.map((feature) => (
                      <li key={feature} className={`flex items-center gap-3 text-body-md ${featured ? "text-white/90" : "text-on-surface-variant"}`}>
                        <span className={`flex-shrink-0 size-5 rounded-full flex items-center justify-center ${featured ? "bg-white/20" : "bg-secondary-container/30"}`}>
                          <CheckCircle className={featured ? "text-white" : "text-secondary-container"} size={14} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full font-bold text-label-md py-4 rounded-xl transition-all active:scale-[0.98] ${
                      featured
                        ? "bg-white text-primary shadow-lg hover:shadow-xl hover:opacity-95"
                        : "bg-primary text-on-primary hover:opacity-90 shadow-md"
                    }`}
                  >
                    Start {plan.name}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
