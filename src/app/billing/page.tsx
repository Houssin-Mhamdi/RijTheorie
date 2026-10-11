"use client"

import { useEffect, useState } from "react"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import { supabase } from "@/lib/supabase"
import { DollarSign, TrendingUp, Users, Banknote, CreditCard, CheckCircle } from "lucide-react"
import type { SiteSettings, Payout } from "@/types/database"

export default function BillingPage() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [bankHolder, setBankHolder] = useState("")
  const [bankNumber, setBankNumber] = useState("")
  const [bankName, setBankName] = useState("")

  const { data: settingsData } = useSupabaseQuery<SiteSettings[]>(
    ["site_settings"],
    async () => supabase.from("site_settings").select("*").eq("id", 1),
  )

  const { data: payouts } = useSupabaseQuery<Payout[]>(
    ["payouts"],
    async () =>
      supabase.from("payouts").select("*").order("created_at", { ascending: false }),
  )

  const { data: revenueStats } = useSupabaseQuery<{ total: number; count: number }>(
    ["revenue_stats"],
    async () => {
      const { data: subs, error: subsErr } = await supabase
        .from("user_subscriptions")
        .select("plan_id")
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString())
      if (subsErr) return { data: null, error: subsErr }
      if (!subs || subs.length === 0) return { data: { total: 0, count: 0 }, error: null }

      const planIds = [...new Set(subs.map((s: { plan_id: string }) => s.plan_id).filter((p): p is string => !!p))]
      if (planIds.length === 0) return { data: { total: 0, count: 0 }, error: null }
      const { data: plans, error: plansErr } = await supabase
        .from("subscription_plans")
        .select("id, price")
        .in("id", planIds)
      if (plansErr) return { data: null, error: plansErr }

      let total = 0
      if (plans) {
        const priceMap = Object.fromEntries(plans.map((p: { id: string; price: number }) => [p.id, p.price]))
        subs.forEach((s: { plan_id: string }) => {
          total += priceMap[s.plan_id] ?? 0
        })
      }
      return { data: { total, count: subs.length }, error: null }
    },
  )

  useEffect(() => {
    if (!settingsData?.[0]?.payment_settings) return
    const ps = settingsData[0].payment_settings
    setBankHolder(ps.bank_account_holder ?? "")
    setBankNumber(ps.bank_account_number ?? "")
    setBankName(ps.bank_name ?? "")
  }, [settingsData])

  const handleSaveBank = async () => {
    setSaving(true)
    const trimmed = (s: string) => s.trim()
    await supabase.from("site_settings").update({
      payment_settings: {
        ...(settingsData?.[0]?.payment_settings ?? {}),
        bank_account_holder: trimmed(bankHolder),
        bank_account_number: trimmed(bankNumber),
        bank_name: trimmed(bankName),
      },
    }).eq("id", 1)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex-grow space-y-6 px-4 md:px-6 py-8">
      <header className="mb-8">
        <h1 className="text-headline-lg text-primary">Billing &amp; Payouts</h1>
        <p className="text-body-md text-on-surface-variant">
          Payments are collected directly on your own Stripe account. You receive 100% of every payment.
        </p>
      </header>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-surface-container-highest shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
              <DollarSign size={20} className="text-primary" />
            </div>
          </div>
          <p className="text-label-sm text-on-surface-variant">Total Monthly Revenue</p>
          <p className="text-headline-lg text-primary font-bold">
            &euro;{(revenueStats?.total ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-surface-container-highest shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
          </div>
          <p className="text-label-sm text-on-surface-variant">Pending Payouts</p>
          <p className="text-headline-lg text-primary font-bold">
            &euro;{(payouts?.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0) ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-surface-container-highest shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
              <Users size={20} className="text-primary" />
            </div>
          </div>
          <p className="text-label-sm text-on-surface-variant">Active Subscribers</p>
          <p className="text-headline-lg text-primary font-bold">{revenueStats?.count ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stripe Payments */}
        <section className="bg-white p-8 rounded-2xl border border-surface-container-highest shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-label-sm px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold">
                ACTIVE
              </span>
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <h2 className="text-headline-md text-primary mb-2">Stripe Payments</h2>
            <p className="text-body-md text-on-surface-variant mb-6">
              All subscription payments go 100% directly to your own Stripe account. No connected accounts, no revenue split, no extra onboarding.
            </p>

            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-2">
              <div className="flex items-center gap-3">
                <CreditCard size={18} className="text-green-600" />
                <span className="text-body-md font-medium text-on-surface">
                  Payments enabled
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant ml-7">
                Money lands in the Stripe balance of the key configured in <code>STRIPE_SECRET_KEY</code>.
              </p>
            </div>

            <div className="mt-4 bg-green-50 p-4 rounded-xl border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-label-md font-bold text-green-700">Revenue</span>
              </div>
              <div className="flex justify-between text-body-md">
                <span className="text-on-surface-variant">Platform share</span>
                <span className="font-bold text-green-700">100% to you</span>
              </div>
            </div>
          </div>
        </section>

        {/* Payout Account Status */}
        <section className="bg-white p-8 rounded-2xl border border-surface-container-higher shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-label-sm text-outline mb-4 uppercase tracking-wider font-bold">Payout Account</h3>
            <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
              <div className="size-12 bg-white rounded flex items-center justify-center shadow-sm shrink-0">
                <Banknote size={22} className="text-primary" />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-on-surface font-bold text-body-md">
                  {bankHolder || "—"}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  {bankNumber ? `${bankName || "Bank"} · ${bankNumber}` : "No bank account set"}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
              <span>Next scheduled payout</span>
              <span className="font-semibold text-on-surface">—</span>
            </div>
            <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
              <span>Minimum payout threshold</span>
              <span className="font-semibold text-on-surface">&euro;25.00</span>
            </div>
          </div>
        </section>
      </div>

      {/* Bank Account */}
      <section className="bg-white p-8 rounded-2xl border border-surface-container-highest shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-headline-md text-primary">Bank Account (Payouts)</h2>
          {saved && <span className="text-label-sm text-green-600 font-bold">Saved successfully</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-label-md text-on-surface-variant block font-medium">Account Holder</label>
            <input
              className="w-full h-12 px-4 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary text-body-md outline-none"
              type="text"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
              placeholder="e.g. Your Name or Company"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label-md text-on-surface-variant block font-medium">IBAN / Account Number</label>
            <input
              className="w-full h-12 px-4 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary text-body-md outline-none"
              type="text"
              value={bankNumber}
              onChange={(e) => setBankNumber(e.target.value)}
              placeholder="NL00 BANK 0123 4567 89"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label-md text-on-surface-variant block font-medium">Bank Name</label>
            <input
              className="w-full h-12 px-4 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary text-body-md outline-none"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. ABN AMRO"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSaveBank}
            disabled={saving}
            className="bg-primary text-white px-8 py-3 rounded-lg font-bold text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Bank Details"}
          </button>
        </div>
      </section>

      {/* Payout History */}
      <section className="bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden">
        <div className="p-8 border-b border-outline-variant/40 flex items-center justify-between">
          <h2 className="text-headline-md text-primary">Payout History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">
              <tr>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Description</th>
                <th className="px-8 py-4">Amount</th>
                <th className="px-8 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {payouts && payouts.length > 0 ? (
                payouts.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-bright transition-colors">
                    <td className="px-8 py-5 text-body-md">
                      {new Date(row.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-8 py-5 text-body-md font-medium">{row.description ?? "—"}</td>
                    <td className="px-8 py-5 text-body-md font-bold">&euro;{Number(row.amount).toFixed(2)}</td>
                    <td className="px-8 py-5">
                      <span className={`text-label-sm px-3 py-1 rounded-full font-medium ${
                        row.status === "paid" ? "bg-green-100 text-green-700" :
                        row.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-surface-container-low text-on-surface-variant"
                      }`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center">
                    <p className="text-body-md text-on-surface-variant">No payouts yet. Start accepting subscriptions to receive revenue.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
