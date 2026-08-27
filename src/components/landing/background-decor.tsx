export function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* large soft rectangles */}
      <div className="absolute -top-24 -left-24 size-[480px] border border-secondary-container/20 rounded-[3rem] rotate-12" />
      <div className="absolute -top-24 -left-20 size-[300px] border border-primary-container/10 rounded-[3rem] rotate-12" />
      <div className="absolute top-1/3 -right-32 size-[520px] border border-primary-container/15 rounded-[3rem] -rotate-12" />
      <div className="absolute top-1/3 -right-28 size-[360px] border border-secondary-container/15 rounded-[3rem] -rotate-12" />
      <div className="absolute bottom-1/4 -left-24 size-[440px] border border-secondary-container/15 rounded-[3rem] rotate-12" />

      {/* vertical lines */}
      <div className="absolute top-0 left-[18%] h-full w-px bg-gradient-to-b from-transparent via-primary-container/10 to-transparent" />
      <div className="absolute top-0 left-[42%] h-full w-px bg-gradient-to-b from-transparent via-secondary-container/10 to-transparent" />
      <div className="absolute top-0 right-[28%] h-full w-px bg-gradient-to-b from-transparent via-primary-container/10 to-transparent" />
      <div className="absolute top-0 right-[12%] h-full w-px bg-gradient-to-b from-transparent via-secondary-container/10 to-transparent" />

      {/* horizontal lines */}
      <div className="absolute left-0 top-[30%] h-px w-full bg-gradient-to-r from-transparent via-primary-container/10 to-transparent" />
      <div className="absolute left-0 top-[68%] h-px w-full bg-gradient-to-r from-transparent via-secondary-container/10 to-transparent" />
    </div>
  )
}
