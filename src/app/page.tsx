import { Header, Hero, HowItWorks, Features, Pricing, Testimonials, Cta, Footer } from "@/components/landing"

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <Testimonials />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
