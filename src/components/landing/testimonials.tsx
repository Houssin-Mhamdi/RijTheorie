"use client"

import { Star } from "lucide-react"

const testimonials = [
  {
    quote: "Sinds we overgestapt zijn op RijTheorie Pro is het slagingspercentage van onze leerlingen met 15% gestegen. Het dashboard geeft ons perfect inzicht.",
    name: "Mark de Vries",
    role: "Rijschool De Toekomst",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBpeBynfe-AzcXco1zq36BdNfOxD2xkcxXuWj9bwLQVoSNgUZyz_4pSZpslow3hTzsLQtF1IttGPBxeh3xnPiRXsXnWZV39LJed89nMArZI_8CTpSuApOtcKyDU-oSO5o1IFP6sZaW3J-uKudxnEwu4aRb4C1RZjUg_ApRev81NFnnOC_p4Mp-KJ9zpyViqcx7xFSTzsI_stoNngqyBpduom2HaccV1Vvfm0oAUS8CQzI86__a9B8kzMIhGbVwSNBADsznfGeWdsf_s",
  },
  {
    quote: "Eindelijk een modern platform dat ook echt goed werkt op de telefoons van onze leerlingen. Geen gedoe meer met verouderde boeken of CD-roms.",
    name: "Sanne Bakker",
    role: "SB Rijopleidingen",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD1LAkKHxKv_4rTHF2ZSxVXC57_V1w9fBHWhGi_BBFDGLjjIUw3yzE7gaUlsh7QwZqaDj1L6SjFc8ObB7vrAl0NPCXQ69txd3R-J2BOqj9V2A94WBoPqXwUnFRovNRC8Q_wRAku5C9vpND5dm9928zNU6LY2OCTHU2JYh48aS6iUS9RR7rzjmYa9XLN1yrKGue2HW8OB7RXG_qEIUspqZW0u2rWOaHPW8yCCAoM9qVYVuw480dOxEdqS4S3H7vRgD8-71f7XHv5GS6n",
  },
  {
    quote: "De klantenservice is top en de interface is zo intuïtief dat ik nooit uitleg hoef te geven aan nieuwe studenten. Een absolute aanrader voor elke rijschool.",
    name: "Johan van Dam",
    role: "Van Dam Verkeer",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDl6MwVBiFT4lm9H9cV2gcf8FkBnWVTQbHaYsMSLmqNEeLD9H9OYo8BYv58W4h9BmMS2OVQWTvZRJnnDVs65gnTlAQw4K-0GUGHaieECvolkxQJAIWKPczi2QtF3tOU9puXjZubdA0dgBMqcznaJkBLuXDkXSRwBqZGp6wwCXfk893k6w-WFpCA2f56IP833N5ApAuNFF6Wi-jQMwJ7vaOekuphvbgGnB06uh9yxKH5xgUWqH-P9qcSt7dx4jzJVdgkR3JISIpI2vTw",
  },
]

export function Testimonials() {
  return (
    <section className="py-24 bg-surface">
      <div className="max-w-container-max-width mx-auto px-margin-desktop">
        <h2 className="text-headline-lg text-primary mb-16 text-center">
          Wat rijscholen zeggen
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-white p-8 rounded-2xl shadow-sm border border-surface-container-highest">
              <div className="flex items-center gap-2 mb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="text-secondary-container fill-current" size={20} />
                ))}
              </div>
              <p className="italic text-body-md text-on-surface-variant mb-8">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-4">
                <img className="size-12 rounded-full border-2 border-secondary-container" src={t.avatar} alt={t.name} />
                <div>
                  <div className="font-semibold text-label-md text-primary">{t.name}</div>
                  <div className="font-medium text-label-sm text-on-surface-variant">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
