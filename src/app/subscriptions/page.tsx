"use client"

import { useState } from "react"
import { Plus, Save, Trash2, Loader2, CreditCard, Pencil, CheckCircle2, AlertCircle } from "lucide-react"
import DashboardShell from "@/components/dashboard/dashboard-shell"
import SlideOver from "@/components/ui/slide-over"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useSupabaseQuery, useSupabaseMutation } from "@/lib/supabase-queries"
import { toast } from "sonner"

interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price: number
  duration_days: number
  features: string[]
  is_active: boolean
  created_at: string
}

interface PlanForm {
  name: string
  description: string
  price: number
  duration_days: number
  features: string
  is_active: boolean
}

const emptyForm: PlanForm = {
  name: "",
  description: "",
  price: 0,
  duration_days: 30,
  features: "",
  is_active: true,
}

export default function SubscriptionsPage() {
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState<PlanForm>(emptyForm)

  const { data: plans, isLoading } = useSupabaseQuery<SubscriptionPlan[]>(
    ["subscription_plans"],
    async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("created_at", { ascending: false })
      return { data, error }
    },
  )

  const createMutation = useSupabaseMutation<PlanForm, SubscriptionPlan>(
    async (values) => {
      const features = values.features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
      const { data, error } = await supabase
        .from("subscription_plans")
        .insert({
          name: values.name,
          description: values.description || null,
          price: values.price,
          duration_days: values.duration_days,
          features,
          is_active: values.is_active,
        })
        .select()
        .single()
      return { data, error }
    },
  )

  const updateMutation = useSupabaseMutation<{ id: string; values: PlanForm }, SubscriptionPlan>(
    async ({ id, values }) => {
      const features = values.features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
      const { data, error } = await supabase
        .from("subscription_plans")
        .update({
          name: values.name,
          description: values.description || null,
          price: values.price,
          duration_days: values.duration_days,
          features,
          is_active: values.is_active,
        })
        .eq("id", id)
        .select()
        .single()
      return { data, error }
    },
  )

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setSlideOverOpen(true)
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditId(plan.id)
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      price: plan.price,
      duration_days: plan.duration_days,
      features: plan.features?.join(", ") ?? "",
      is_active: plan.is_active,
    })
    setSlideOverOpen(true)
  }

  async function handleSubmit() {
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, values: form })
        toast.success("Abonnement bijgewerkt")
      } else {
        await createMutation.mutateAsync(form)
        toast.success("Abonnement aangemaakt")
      }
      setSlideOverOpen(false)
      setEditId(null)
      setForm(emptyForm)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij opslaan")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", deleteTarget.id)
      if (error) throw error
      toast.success("Abonnement verwijderd")
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij verwijderen")
    }
  }

  const allPlans = plans ?? []
  const activeCount = allPlans.filter((p) => p.is_active).length

  return (
    <DashboardShell>
      <section className="px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-headline-lg text-primary">Abonnementen</h2>
            <p className="text-body-md text-on-surface-variant">Beheer abonnementen en prijzen voor studenten.</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-6 py-3 rounded-xl font-label-md hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            <Plus size={20} />
            <span>Abonnement toevoegen</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
                <CreditCard size={22} className="text-primary" />
              </div>
              <span className="text-label-md text-on-surface-variant">Totaal</span>
            </div>
            <p className="text-headline-lg text-primary font-bold">{allPlans.length}</p>
          </div>
          <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <span className="text-label-md text-on-surface-variant">Actief</span>
            </div>
            <p className="text-headline-lg text-primary font-bold">{activeCount}</p>
          </div>
          <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle size={22} className="text-amber-600" />
              </div>
              <span className="text-label-md text-on-surface-variant">Inactief</span>
            </div>
            <p className="text-headline-lg text-primary font-bold">{allPlans.length - activeCount}</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_20px_rgba(26,60,110,0.05)] border border-surface-container overflow-hidden">
          <div className="p-6 border-b border-surface-container flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-label-md text-primary">Abonnementen</h3>
              <span className="px-2 py-0.5 bg-surface-container text-primary text-[11px] font-bold rounded-full">
                {allPlans.length}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : allPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant">
              <CreditCard size={40} className="mb-3 opacity-30" />
              <p className="text-body-md">Nog geen abonnementen aangemaakt.</p>
              <button onClick={openCreate} className="mt-2 text-label-md text-primary hover:underline">
                Abonnement toevoegen
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-surface-container">
                    <th className="px-6 py-3 text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">Naam</th>
                    <th className="px-6 py-3 text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">Prijs</th>
                    <th className="px-6 py-3 text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">Duur</th>
                    <th className="px-6 py-3 text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">Features</th>
                    <th className="px-6 py-3 text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-label-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {allPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-surface-container/50 last:border-0 hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-body-md font-medium text-primary">{plan.name}</p>
                          {plan.description && (
                            <p className="text-label-sm text-on-surface-variant truncate max-w-[250px]">{plan.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-body-md text-primary font-medium">
                        &euro;{plan.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-body-md text-on-surface-variant">
                        {plan.duration_days} dagen
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-surface-container text-primary text-[11px] font-bold rounded-full">
                          {plan.features?.length ?? 0} features
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {plan.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-medium bg-green-50 text-green-700">
                            <CheckCircle2 size={14} />
                            Actief
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-medium bg-gray-100 text-gray-500">
                            Inactief
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(plan)}
                            className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(plan)}
                            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-on-surface-variant hover:text-destructive"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <SlideOver
        open={slideOverOpen}
        onClose={() => { setSlideOverOpen(false); setEditId(null); setForm(emptyForm) }}
        title={editId ? "Abonnement bewerken" : "Abonnement toevoegen"}
        description={editId ? "Wijzig de abonnementsgegevens" : "Maak een nieuw abonnement aan"}
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => { setSlideOverOpen(false); setEditId(null); setForm(emptyForm) }}
              className="flex-1 px-6 py-3 border border-outline rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-all"
            >
              Annuleren
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !form.name}
              className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary-container transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={20} />
              {createMutation.isPending || updateMutation.isPending ? "Bezig..." : "Opslaan"}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">Naam</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Bijv. Basis, Premium"
            />
          </div>
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">Beschrijving</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              placeholder="Optionele beschrijving"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm font-bold text-primary mb-1.5">Prijs (&euro;)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-label-sm font-bold text-primary mb-1.5">Duur (dagen)</label>
              <input
                type="number"
                min={1}
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) || 30 })}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">Features (komma-gescheiden)</label>
            <textarea
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              placeholder="Bijv. Onbeperkte examens, Prioriteitsondersteuning"
            />
          </div>
          <div className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
            <div>
              <p className="text-body-md font-medium text-primary">Actief</p>
              <p className="text-label-sm text-on-surface-variant">Zichtbaar voor studenten</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 ${
                form.is_active ? "bg-primary" : "bg-outline-variant"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out translate-y-0.5 ${
                  form.is_active ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </SlideOver>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonnement verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je &ldquo;{deleteTarget?.name}&rdquo; wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Annuleren</Button>} />
            <Button variant="destructive" onClick={handleDelete} className="flex items-center gap-2">
              <Trash2 size={16} />
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
