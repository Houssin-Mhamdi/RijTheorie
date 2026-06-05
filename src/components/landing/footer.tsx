"use client"



export function Footer() {
  return (
    <footer className="bg-tertiary dark:bg-on-tertiary-fixed py-12 transition-all duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center px-margin-desktop w-full max-w-container-max-width mx-auto gap-gutter">
        <div className="flex flex-col gap-4 items-center md:items-start">
          <div className="text-headline-md text-on-tertiary flex items-center gap-2">
            <img src="/screen.png" alt="RijTheorie Pro" className="h-8 w-auto" />
          </div>
          <p className="text-tertiary-fixed-dim opacity-80 text-body-md max-w-xs text-center md:text-left">
            Het meest geavanceerde theorieplatform van Nederland.
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-6 md:gap-12">
          <a className="text-tertiary-fixed-dim opacity-80 font-medium text-label-sm hover:text-secondary-container dark:hover:text-secondary-fixed transition-colors" href="#">Over ons</a>
          <a className="text-tertiary-fixed-dim opacity-80 font-medium text-label-sm hover:text-secondary-container dark:hover:text-secondary-fixed transition-colors" href="#">Privacy Policy</a>
          <a className="text-tertiary-fixed-dim opacity-80 font-medium text-label-sm hover:text-secondary-container dark:hover:text-secondary-fixed transition-colors" href="#">Algemene Voorwaarden</a>
          <a className="text-tertiary-fixed-dim opacity-80 font-medium text-label-sm hover:text-secondary-container dark:hover:text-secondary-fixed transition-colors" href="#">Support</a>
        </nav>
        <div className="flex flex-col items-center md:items-end gap-2">
          <div className="flex items-center gap-2 text-on-tertiary font-bold text-label-sm">
            Gemaakt in Nederland{" "}
            <img className="w-5 h-auto rounded-sm" alt="NL Flag" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChlDSqkn-xzjpHHDU8FEnzjnJuEAsq3hkYOiPeYpBYO-ECeifQUYMBPuz30ktCTr5kOnZ6eOxvtrJV6gCwTfH4L210e7Ti1IDiKwrS-ux4scwI6Q8bv6myHK7Iroo3Z4uzl4xCukAW5LRmgolXIvK0izvpLGMW6gDhSkRI8szGMuYZlDkXO_-qXnqoCNt3CyZtYt_61o06Aa8ExL0noDCSOBxh9O_cL72FTerTYR29JlPwJCZdyAq-uQ3mimQWNrQZ-I-ecLX4Uf3O" />
          </div>
          <div className="text-tertiary-fixed-dim opacity-80 font-medium text-label-sm">
            &copy; 2024 RijTheorie Pro.
          </div>
        </div>
      </div>
    </footer>
  )
}
