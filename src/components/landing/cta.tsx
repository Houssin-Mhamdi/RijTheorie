"use client"

export function Cta() {
  return (
    <section className="py-24 px-margin-desktop">
      <div className="max-w-container-max-width mx-auto bg-primary rounded-3xl p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect fill="url(#grid)" height="100%" width="100%" />
          </svg>
        </div>
        <div className="relative z-10">
          <h2 className="text-display-lg text-on-primary mb-6">Klaar om je rijschool te moderniseren?</h2>
          <p className="text-body-lg text-on-primary opacity-80 mb-10 max-w-2xl mx-auto">Sluit je aan bij meer dan 250 Nederlandse rijscholen die al gebruik maken van ons platform. Geen opstartkosten, direct live.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-secondary-container text-on-secondary-container font-bold text-label-md px-10 py-5 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-xl">Gratis beginnen</button>
            <button className="bg-primary-container text-white border border-outline-variant font-bold text-label-md px-10 py-5 rounded-xl hover:bg-white hover:text-primary transition-all">Praat met sales</button>
          </div>
        </div>
      </div>
    </section>
  )
}
