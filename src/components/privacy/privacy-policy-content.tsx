"use client"

import { Mail } from "lucide-react"

export function PrivacyPolicyContent() {
  return (
    <main className="max-w-container-max-width mx-auto px-margin-desktop py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <aside className="hidden lg:block lg:col-span-3 sticky top-32 h-fit">
          <nav className="border-l border-outline-variant py-2">
            <h3 className="text-primary font-bold text-[13px] uppercase tracking-widest mb-6 pl-4">
              Document Navigation
            </h3>
            <ul className="space-y-4">
              <li>
                <a
                  href="#introduction"
                  className="block text-sm text-on-surface-variant hover:text-secondary pl-4 border-l-2 border-transparent -ml-[1px] hover:border-secondary transition-all"
                >
                  1. Introduction
                </a>
              </li>
              <li>
                <a
                  href="#collection"
                  className="block text-sm text-on-surface-variant hover:text-secondary pl-4 border-l-2 border-transparent -ml-[1px] hover:border-secondary transition-all"
                >
                  2. Data Collection
                </a>
              </li>
              <li>
                <a
                  href="#purpose"
                  className="block text-sm text-on-surface-variant hover:text-secondary pl-4 border-l-2 border-transparent -ml-[1px] hover:border-secondary transition-all"
                >
                  3. Purposes
                </a>
              </li>
              <li>
                <a
                  href="#cookies"
                  className="block text-sm text-on-surface-variant hover:text-secondary pl-4 border-l-2 border-transparent -ml-[1px] hover:border-secondary transition-all"
                >
                  4. Cookies
                </a>
              </li>
              <li>
                <a
                  href="#sharing"
                  className="block text-sm text-on-surface-variant hover:text-secondary pl-4 border-l-2 border-transparent -ml-[1px] hover:border-secondary transition-all"
                >
                  5. Data Sharing
                </a>
              </li>
              <li>
                <a
                  href="#security"
                  className="block text-sm text-on-surface-variant hover:text-secondary pl-4 border-l-2 border-transparent -ml-[1px] hover:border-secondary transition-all"
                >
                  6. Security
                </a>
              </li>
              <li>
                <a
                  href="#rights"
                  className="block text-sm text-on-surface-variant hover:text-secondary pl-4 border-l-2 border-transparent -ml-[1px] hover:border-secondary transition-all"
                >
                  7. Your Rights
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        <article className="lg:col-span-9 max-w-3xl">
          <header className="mb-16 border-b border-outline-variant pb-8">
            <h1 className="text-display-lg text-primary mb-4">Privacy Policy</h1>
            <div className="flex items-center gap-2 text-on-surface-variant text-sm">
              <span className="font-semibold uppercase tracking-wide">Publication Date:</span>
              <span>May 24, 2024</span>
            </div>
          </header>

          <div className="space-y-16 text-lg leading-relaxed text-on-surface">
            <section className="scroll-mt-32" id="introduction">
              <h2 className="text-3xl font-bold text-primary mb-6">1. Introduction</h2>
              <div className="space-y-4">
                <p>
                  Welcome to RijTheorie Pro. We take the protection of your personal data very
                  seriously. In this privacy statement, we explain how we collect, use, and protect
                  your data when you use our platform for practicing traffic theory.
                </p>
                <p>
                  By using our services, you agree to the terms in this document. We strive for
                  transparency regarding our processing procedures, in accordance with the General
                  Data Protection Regulation (GDPR).
                </p>
              </div>
            </section>

            <section className="scroll-mt-32" id="collection">
              <h2 className="text-3xl font-bold text-primary mb-6">2. Data Collection</h2>
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-on-surface mb-3">2.1 Personal Data</h3>
                  <p>
                    We collect information that you provide directly to us. This includes, among
                    other things, your full name, email address, phone number, and billing
                    information necessary for creating and managing your account.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-on-surface mb-3">2.2 Usage Data</h3>
                  <p>
                    We automatically collect data about your interaction with our platform via
                    technical log files. This data includes your IP address, browser type, device
                    details, visited pages, and the results of practice exams taken.
                  </p>
                </div>
              </div>
            </section>

            <section className="scroll-mt-32" id="purpose">
              <h2 className="text-3xl font-bold text-primary mb-6">3. Purposes of Processing</h2>
              <p className="mb-6">
                The processing of your personal data occurs exclusively for the following purposes:
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>Offering a personalized learning experience and tracking your progress;</li>
                <li>Processing financial transactions and managing subscriptions;</li>
                <li>
                  Improving the quality of our question bank based on anonymized performance data;
                </li>
                <li>Providing technical support and communicating about essential updates.</li>
              </ul>
            </section>

            <section className="scroll-mt-32" id="cookies">
              <h2 className="text-3xl font-bold text-primary mb-6">4. Cookies</h2>
              <p className="mb-6">
                RijTheorie Pro uses cookies to ensure the functionality of the website. In the
                overview below, you will find the categories of cookies we use:
              </p>
              <div className="overflow-hidden border border-outline-variant">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-6 py-4 text-sm font-bold text-primary">Category</th>
                      <th className="px-6 py-4 text-sm font-bold text-primary">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-base">
                    <tr>
                      <td className="px-6 py-4 font-bold">Functional</td>
                      <td className="px-6 py-4">
                        Strictly necessary for the basic functions of the website, such as logging
                        in.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-bold">Analytical</td>
                      <td className="px-6 py-4">
                        Anonymized statistics to measure website usage.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-bold">Marketing</td>
                      <td className="px-6 py-4">
                        Cookies for showing relevant advertisements on external channels.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="scroll-mt-32" id="sharing">
              <h2 className="text-3xl font-bold text-primary mb-6">5. Data Sharing with Third Parties</h2>
              <p className="mb-6">
                We never sell your data to third parties. For our business operations, we
                exclusively use the services of the following categories of processors:
              </p>
              <ul className="list-decimal pl-6 space-y-4">
                <li>
                  <strong>Payment Processors:</strong> For the secure handling of payments (Mollie,
                  Stripe).
                </li>
                <li>
                  <strong>Infrastructure:</strong> For hosting our database and application (AWS,
                  Google Cloud).
                </li>
                <li>
                  <strong>Communication:</strong> For sending transactional emails (SendGrid).
                </li>
              </ul>
            </section>

            <section className="scroll-mt-32" id="security">
              <h2 className="text-3xl font-bold text-primary mb-6">6. Security</h2>
              <p>
                We take appropriate technical and organizational measures to protect your personal
                data against loss or any form of unlawful processing. This includes the use of
                modern encryption technologies (SSL), strict access control for our employees, and
                regular security audits of our systems.
              </p>
            </section>

            <section className="scroll-mt-32 pb-20" id="rights">
              <h2 className="text-3xl font-bold text-primary mb-6">7. Your Rights</h2>
              <p className="mb-8">
                In accordance with the GDPR, you have various rights regarding your personal data:
              </p>
              <div className="space-y-6">
                <div className="border-b border-outline-variant pb-6">
                  <h4 className="font-bold text-on-surface mb-2">
                    Right of Access and Rectification
                  </h4>
                  <p>
                    You have the right to request a copy of the data we process and to have
                    inaccuracies corrected.
                  </p>
                </div>
                <div className="border-b border-outline-variant pb-6">
                  <h4 className="font-bold text-on-surface mb-2">Right to Erasure</h4>
                  <p>
                    You can request at any time to have your account and all associated data
                    permanently deleted.
                  </p>
                </div>
                <div className="pb-6">
                  <h4 className="font-bold text-on-surface mb-2">Right to Restriction</h4>
                  <p>
                    In certain cases, you can request that the processing of your data be
                    temporarily suspended.
                  </p>
                </div>
              </div>

              <div className="mt-16 p-10 bg-surface-container border-l-4 border-primary">
                <h3 className="text-xl font-bold text-primary mb-4">
                  Contact about Privacy
                </h3>
                <p className="mb-6 text-base">
                  Do you have specific questions about this privacy statement or would you like to
                  exercise your rights? Our team is ready to answer your questions.
                </p>
                <a
                  href="mailto:privacy@rijtheoriepro.nl"
                  className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-lg font-bold text-sm hover:opacity-90 transition-all"
                >
                  <Mail size={16} />
                  Contact Privacy Team
                </a>
              </div>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}
