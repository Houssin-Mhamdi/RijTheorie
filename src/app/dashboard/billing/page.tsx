"use client"

import { useEffect, useState } from "react"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import { supabase } from "@/lib/supabase"
import { Eye, EyeOff, Link2, Unlink, DollarSign, TrendingUp, Users, Banknote, CreditCard, Loader2 } from "lucide-react"
import type { SiteSettings, Payout } from "@/types/database"

export default function BillingPage() {
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [stripePubKey, setStripePubKey] = useState("")
  const [stripeSecKey, setStripeSecKey] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")

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

      const planIds = [...new Set(subs.map((s: { plan_id: string }) => s.plan_id))]
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
    setStripePubKey(ps.stripe_publishable_key ?? "")
    setStripeSecKey(ps.stripe_secret_key ?? "")
    setWebhookSecret(ps.webhook_secret ?? "")
      setBankHolder(ps.bank_account_holder ?? "")
    setBankNumber(ps.bank_account_number ?? "")
    setBankName(ps.bank_name ?? "")
  }, [settingsData])

  const [verifyError, setVerifyError] = useState("")

  const handleSaveKeys = async () => {
    setSaving(true)
    setVerifyError("")

    // Verify secret key with Stripe
    if (stripeSecKey) {
      const verifyRes = await fetch("/api/stripe/verify", {
        method: "POST",
        body: JSON.stringify({ secretKey: stripeSecKey }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyData.valid) {
        setVerifyError("Secret key is invalid. Check your Stripe dashboard.")
        setSaving(false)
        return
      }
    }

    const trimmed = (s: string) => s.trim()

    await supabase.from("site_settings").update({
      payment_settings: {
        stripe_publishable_key: trimmed(stripePubKey),
        stripe_secret_key: trimmed(stripeSecKey),
        webhook_secret: trimmed(webhookSecret),
        bank_account_holder: trimmed(bankHolder),
        bank_account_number: trimmed(bankNumber),
        bank_name: trimmed(bankName),
      },
    }).eq("id", 1)

    setStripePubKey(trimmed(stripePubKey))
    setStripeSecKey(trimmed(stripeSecKey))
    setWebhookSecret(trimmed(webhookSecret))
    setBankHolder(trimmed(bankHolder))
    setBankNumber(trimmed(bankNumber))
    setBankName(trimmed(bankName))

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex-grow space-y-6">
      <header className="mb-8">
        <h1 className="text-headline-lg text-primary">Billing &amp; Payouts</h1>
        <p className="text-body-md text-on-surface-variant">
          Configure payment processing to collect subscription revenue and manage payouts.
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
        {/* Stripe Status */}
        <section className="bg-white p-8 rounded-2xl border border-surface-container-highest shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-label-sm px-3 py-1 rounded-full font-bold ${stripePubKey && stripeSecKey ? "bg-green-100 text-green-700" : "bg-surface-container-low text-on-surface-variant"}`}>
                {stripePubKey && stripeSecKey ? "CONNECTED" : "NOT CONNECTED"}
              </span>
              {stripePubKey && stripeSecKey ? (
                <Link2 size={20} className="text-green-600" />
              ) : (
                <Unlink size={20} className="text-on-surface-variant" />
              )}
            </div>
            <h2 className="text-headline-md text-primary mb-2">Stripe</h2>
            <p className="text-body-md text-on-surface-variant mb-6">
              Enter your Stripe API keys below and click <strong>Save Settings</strong> to connect.
            </p>

            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-2">
              <div className="flex items-center gap-3">
                <CreditCard size={18} className={stripePubKey && stripeSecKey ? "text-green-600" : "text-on-surface-variant"} />
                <span className="text-body-md font-medium text-on-surface">
                  {stripePubKey && stripeSecKey ? "Stripe connected" : "No API keys saved yet"}
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant ml-7">
                {stripePubKey && stripeSecKey
                  ? `Key: ${stripePubKey.slice(0, 12)}****`
                  : "Fill in Publishable & Secret Key, then Save Settings"}
              </p>
            </div>
          </div>
          {stripePubKey && stripeSecKey && (
            <button
              onClick={async () => {
                setStripePubKey("")
                setStripeSecKey("")
                setWebhookSecret("")
                setBankHolder("")
                setBankNumber("")
                setBankName("")
                await supabase.from("site_settings").update({
                  payment_settings: {},
                }).eq("id", 1)
              }}
              className="mt-6 text-error font-bold text-label-md hover:underline flex items-center gap-2"
            >
              <Unlink size={16} />
              Disconnect Stripe
            </button>
          )}
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

      {/* Stripe API Keys + Bank Account */}
      <section className="bg-white p-8 rounded-2xl border border-surface-container-highest shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-headline-md text-primary">Payment Settings</h2>
          {saved && <span className="text-label-sm text-green-600 font-bold">Saved successfully</span>}
        </div>

        <div className="mb-8">
          <h3 className="text-label-md text-on-surface-variant font-bold mb-4 uppercase tracking-wider">Stripe API Keys</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-label-md text-on-surface-variant block font-medium">Publishable Key</label>
              <input
                className="w-full h-12 px-4 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary text-body-md outline-none"
                type="text"
                value={stripePubKey}
                onChange={(e) => setStripePubKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-label-md text-on-surface-variant block font-medium">Secret Key</label>
              <div className="relative">
                <input
                  className="w-full h-12 px-4 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary text-body-md outline-none pr-10"
                  type={showSecret ? "text" : "password"}
                  value={stripeSecKey}
                  onChange={(e) => setStripeSecKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-label-md text-on-surface-variant block font-medium">Webhook Secret</label>
              <input
                className="w-full h-12 px-4 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary text-body-md outline-none"
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="whsec_..."
              />
            </div>
          </div>
        </div>

        <div className="border-t border-outline-variant/30 pt-8">
          <h3 className="text-label-md text-on-surface-variant font-bold mb-4 uppercase tracking-wider">Bank Account (Payouts)</h3>
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
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div>
            {verifyError && (
              <p className="text-label-sm text-error font-medium">{verifyError}</p>
            )}
            <p className="text-label-sm text-on-surface-variant">
              ⚠ Never share your secret key.
            </p>
          </div>
          <button
            onClick={handleSaveKeys}
            disabled={saving}
            className="bg-primary text-white px-8 py-3 rounded-lg font-bold text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Verifying...</span>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </section>

      {/* Payout History */}
      <section className="bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden">
        <div className="p-8 border-b border-outline-variant/40 flex items-center justify-between">
          <h2 className="text-headline-md text-primary">Payout History</h2>
          <button className="text-primary font-bold text-label-md hover:underline">View all</button>
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
