"use client"

import { useEffect, useMemo, useState } from "react"
import { useSupabaseQuery } from "@/lib/supabase-queries"
import { supabase } from "@/lib/supabase"
import { Loader2, Ticket, Plus, Trash2, Pencil, X, Tag } from "lucide-react"
import type { CouponCode } from "@/types/database"

type Plan = { id: string; name: string; price: number; duration_days: number }

const emptyForm = {
  code: "",
  discount_percent: 20,
  max_uses: "",
  expires_at: "",
  plan_ids: [] as string[],
  is_active: true,
}

export default function CouponsPage() {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [slideOpen, setSlideOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: coupons, isLoading, refetch } = useSupabaseQuery<CouponCode[]>(
    ["coupon_codes"],
    async () => supabase.from("coupon_codes").select("*").order("created_at", { ascending: false }),
  )

  const { data: plans } = useSupabaseQuery<Plan[]>(
    ["subscription_plans", "admin"],
    async () =>
      supabase.from("subscription_plans").select("id, name, price, duration_days").order("duration_days"),
  )

  useEffect(() => {
    if (!slideOpen) {
      setForm(emptyForm)
      setEditingId(null)
      setFormError("")
    }
  }, [slideOpen])

  const discount = Number(form.discount_percent)

  // Validation mirrors the server rules exactly
  const validation = useMemo(() => {
    if (!form.code.trim()) return "Code is required"
    if (form.code.trim().length < 3) return "Code must be at least 3 characters"
    if (Number.isNaN(discount) || !Number.isInteger(discount)) return "Discount must be a whole number"
    if (discount < 1 || discount > 99) return "Discount must be between 1 and 99"
    if (form.max_uses && (Number(form.max_uses) < 1 || !Number.isInteger(Number(form.max_uses)))) return "Max uses must be a positive whole number"
    if (form.plan_ids.length === 0) return "Select at least one bundle"
    return ""
  }, [form.code, form.max_uses, form.plan_ids.length, discount])

  const handleSave = async () => {
    if (validation) {
      setFormError(validation)
      return
    }
    setSaving(true)
    setFormError("")

    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_percent: discount,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      plan_ids: form.plan_ids,
      is_active: form.is_active,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from("coupon_codes").update(payload).eq("id", editingId))
    } else {
      ;({ error } = await supabase.from("coupon_codes").insert({ ...payload, used_count: 0 }))
    }

    setSaving(false)
    if (error) {
      if (error.message.includes("duplicate key")) {
        setFormError("This code already exists")
      } else if (error.message.includes("check constraint")) {
        setFormError("Discount must be between 1 and 99")
      } else {
        setFormError(error.message)
      }
      return
    }

    setSlideOpen(false)
    refetch()
  }

  const handleEdit = (c: CouponCode) => {
    setEditingId(c.id)
    setForm({
      code: c.code,
      discount_percent: c.discount_percent,
      max_uses: c.max_uses?.toString() ?? "",
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "",
      plan_ids: c.plan_ids ?? [],
      is_active: c.is_active,
    })
    setSlideOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await supabase.from("coupon_codes").delete().eq("id", deleteId)
    setDeleteId(null)
    refetch()
  }

  const togglePlan = (planId: string) => {
    setForm((f) => ({
      ...f,
      plan_ids: f.plan_ids.includes(planId)
        ? f.plan_ids.filter((p) => p !== planId)
        : [...f.plan_ids, planId],
    }))
  }

  const planName = (id: string) => plans?.find((p) => p.id === id)?.name ?? "?"
  const discounted = (price: number) => Math.round(price * (100 - discount)) / 100

  return (
    <div className="flex-grow space-y-6">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-primary">Coupon Codes</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Create discount codes for specific bundles. Each user can use a code once.
          </p>
        </div>
        <button
          onClick={() => setSlideOpen(true)}
          className="bg-primary text-white px-5 py-3 rounded-xl font-bold text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <Plus size={18} /> New Coupon
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : (
        <section className="bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Bundles</th>
                  <th className="px-6 py-4">Used</th>
                  <th className="px-6 py-4">Expires</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {coupons && coupons.length > 0 ? (
                  coupons.map((c) => {
                    const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false
                    const limitReached = c.max_uses != null && c.used_count >= c.max_uses
                    const dead = expired || limitReached || !c.is_active
                    return (
                      <tr key={c.id} className="hover:bg-surface-bright transition-colors">
                        <td className="px-6 py-5">
                          <span className="font-mono font-bold text-body-md bg-surface-container-low px-3 py-1.5 rounded-lg">{c.code}</span>
                        </td>
                        <td className="px-6 py-5 text-body-md font-bold text-green-700">-{c.discount_percent}%</td>
                        <td className="px-6 py-5 text-body-md max-w-[220px]">
                          {(c.plan_ids ?? []).map((id) => planName(id)).join(", ") || "—"}
                        </td>
                        <td className="px-6 py-5 text-body-md">{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</td>
                        <td className="px-6 py-5 text-body-md">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString("nl-NL") : "Never"}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-label-sm px-3 py-1 rounded-full font-bold ${
                            dead ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          }`}>
                            {expired ? "EXPIRED" : limitReached ? "LIMIT REACHED" : c.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => handleEdit(c)} className="p-2 rounded-lg hover:bg-surface-container transition-colors" title="Edit">
                              <Pencil size={16} className="text-on-surface-variant" />
                            </button>
                            <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                              <Trash2 size={16} className="text-error" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-8 py-12 text-center">
                      <Ticket size={36} className="text-outline-variant mx-auto mb-3" />
                      <p className="text-body-md text-on-surface-variant">No coupons yet. Click &quot;New Coupon&quot; to create one.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Slide-over form */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setSlideOpen(false)} />
          <div className="relative h-full w-full max-w-md bg-surface shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-surface px-6 py-5 border-b border-outline-variant/30 flex items-center justify-between z-10">
              <h2 className="text-headline-md text-primary font-bold">{editingId ? "Edit Coupon" : "New Coupon"}</h2>
              <button onClick={() => setSlideOpen(false)} className="p-2 rounded-lg hover:bg-surface-container"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-label-md font-bold text-on-surface-variant block">CODE *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. START20"
                  maxLength={24}
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary font-mono font-bold uppercase tracking-wider outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-label-md font-bold text-on-surface-variant block">DISCOUNT % * <span className="font-normal">(1–99)</span></label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={form.discount_percent}
                  onChange={(e) => setForm((f) => ({ ...f, discount_percent: Number(e.target.value) }))}
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-label-md font-bold text-on-surface-variant block">MAX USES</label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_uses}
                    onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label-md font-bold text-on-surface-variant block">EXPIRY DATE</label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-label-md font-bold text-on-surface-variant block">VALID FOR BUNDLES *</label>
                {plans && plans.length > 0 ? (
                  <div className="space-y-2">
                    {plans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlan(p.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.99] ${
                          form.plan_ids.includes(p.id)
                            ? "border-primary bg-primary-container/10"
                            : "border-outline-variant hover:bg-surface-container-low"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`size-5 rounded-md border-2 flex items-center justify-center ${
                            form.plan_ids.includes(p.id) ? "bg-primary border-primary" : "border-outline-variant"
                          }`}>
                            {form.plan_ids.includes(p.id) && <Tag size={12} className="text-on-primary" />}
                          </span>
                          <span className="text-body-md font-semibold text-on-surface">{p.name}</span>
                        </span>
                        {/* LIVE PRICE PREVIEW */}
                        <span className="text-right">
                          {form.plan_ids.includes(p.id) && discount >= 1 && discount <= 99 ? (
                            <>
                              <span className="text-label-sm text-on-surface-variant line-through mr-2">&euro;{p.price.toFixed(2)}</span>
                              <span className="text-body-md font-bold text-green-700">&euro;{discounted(p.price).toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="text-body-md text-on-surface-variant">&euro;{p.price.toFixed(2)}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Loader2 size={18} className="animate-spin text-on-surface-variant" />
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="size-5 accent-primary"
                />
                <span className="text-body-md font-medium text-on-surface">Active</span>
              </label>

              {formError && (
                <p className="text-label-md text-error font-medium bg-red-50 p-3 rounded-xl border border-red-200">{formError}</p>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-label-md hover:bg-primary-container transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : editingId ? "Save Changes" : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-headline-md text-primary mb-2">Delete coupon?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">
              Students will no longer be able to use this code.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-5 py-2.5 rounded-xl bg-error text-white text-label-md font-bold hover:opacity-90">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
