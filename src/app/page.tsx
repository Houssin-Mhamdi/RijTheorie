import { Header, FindContactHero, Hero, HowItWorks, Features, Pricing, Testimonials, Cta, Footer, BackgroundDecor } from "@/components/landing"

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <BackgroundDecor />
      <Header />
      <main className="flex-1">
        <FindContactHero />
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
