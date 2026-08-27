import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

export async function POST(req: Request) {
  try {
    if (!platformSecretKey) {
      return NextResponse.json({ error: "Platform Stripe not configured" }, { status: 500 })
    }

    const sb = createClient(supabaseUrl, supabaseKey)
    const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
    const paymentSettings = (settings?.payment_settings as Record<string, unknown>) ?? {}
    const existingAccountId = paymentSettings.stripe_account_id as string | undefined

    const stripe = new Stripe(platformSecretKey)

    let accountId = existingAccountId

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

    return NextResponse.json({ url: accountLink.url, account_id: accountId })
  } catch (e) {
    console.error("Stripe Connect error:", e)
    return NextResponse.json({ error: "Failed to create Connect link" }, { status: 500 })
  }
}
