import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

async function requireAdmin(): Promise<{ ok: boolean; error?: NextResponse }> {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      },
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }
    const { data: isAdminData } = await supabaseAuth.rpc("is_admin")
    if (!isAdminData) {
      return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
}

export async function POST(req: Request) {
  try {
    if (!platformSecretKey) {
      return NextResponse.json({ error: "Platform Stripe not configured" }, { status: 500 })
    }

    const auth = await requireAdmin()
    if (!auth.ok) return auth.error

    const sb = createClient(supabaseUrl, supabaseKey)
    const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
    const paymentSettings = (settings?.payment_settings as Record<string, unknown>) ?? {}
    const existingAccountId = paymentSettings.stripe_account_id as string | undefined

    const stripe = new Stripe(platformSecretKey)

    let accountId: string | null = existingAccountId ?? null

    // Verify any previously stored connected account still exists on the
    // CURRENT Stripe account/mode. This is what makes the test -> live switch
    // (or a replaced key) safe: if the stored ID is a test account but we're
    // now on a live key (or it was deleted), we discard it and create a fresh
    // connected account tied to the active key.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId)
      } catch {
        accountId = null
        await sb.from("site_settings").update({
          ...(paymentSettings ? { payment_settings: { ...paymentSettings, stripe_account_id: null } } : {}),
        }).eq("id", 1)
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "NL",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { supabase_url: supabaseUrl },
      })
      accountId = account.id

      await sb.from("site_settings").update({
        payment_settings: { ...paymentSettings, stripe_account_id: accountId },
      }).eq("id", 1)
    }

    const origin = req.headers.get("origin") || "http://localhost:3000"

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/billing`,
      return_url: `${origin}/billing?stripe=connected`,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url, account_id: accountId, connected_account_id: accountId })
  } catch (e) {
    console.error("Stripe Connect error:", e)
    return NextResponse.json({ error: "Failed to create Connect link" }, { status: 500 })
  }
}
