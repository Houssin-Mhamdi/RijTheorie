import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

export async function GET() {
  try {
    if (!platformSecretKey) {
      return NextResponse.json({ connected: false, reason: "no_platform_key" })
    }

    const sb = createClient(supabaseUrl, supabaseKey)
    const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
    const paymentSettings = (settings?.payment_settings as Record<string, unknown>) ?? {}
    const accountId = paymentSettings.stripe_account_id as string | undefined

    if (!accountId) {
      return NextResponse.json({ connected: false, reason: "no_account" })
    }

    const stripe = new Stripe(platformSecretKey)
    const account = await stripe.accounts.retrieve(accountId)

    const isReady = account.charges_enabled && account.payouts_enabled

    return NextResponse.json({
      connected: isReady,
      account_id: accountId,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    })
  } catch (e) {
    console.error("Stripe status error:", e)
    return NextResponse.json({ connected: false, reason: "error" })
  }
}
