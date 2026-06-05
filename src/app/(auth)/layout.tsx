export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <div className="hidden md:flex w-1/2 bg-primary relative items-center justify-center p-12 overflow-hidden">
        <img
          src="/screen.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 text-center max-w-md">
          <img src="/screen.png" alt="RijTheorie Pro" className="h-12 w-auto mx-auto mb-6" />
          <h1 className="text-display-lg text-on-primary mb-4">RijTheorie Pro</h1>
          <p className="text-body-lg text-on-primary opacity-80">
            Het meest geavanceerde theorieplatform voor rijscholen en studenten.
          </p>
        </div>
      </div>
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-12">
        {children}
      </div>
    </div>
  )
}
