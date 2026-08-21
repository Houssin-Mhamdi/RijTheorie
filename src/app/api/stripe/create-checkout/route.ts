import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

const APPLICATION_FEE_PERCENT = 50

export async function POST(req: Request) {
  try {
    const { planId, userId } = await req.json()
    if (!planId || !userId) {
      return NextResponse.json({ error: "Missing planId or userId" }, { status: 400 })
    }

    if (!platformSecretKey) {
      return NextResponse.json({ error: "Platform Stripe not configured." }, { status: 500 })
    }

    const sb = createClient(supabaseUrl, supabaseKey)

    const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
    const paymentSettings = (settings?.payment_settings as Record<string, unknown>) ?? {}
    const connectedAccountId = paymentSettings.stripe_account_id as string | undefined

    if (!connectedAccountId) {
      return NextResponse.json({ error: "Stripe Connect not set up. Please connect your Stripe account first." }, { status: 400 })
    }

    const { data: plan } = await sb.from("subscription_plans").select("*").eq("id", planId).single()
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const planData = plan as Record<string, unknown>
    const stripe = new Stripe(platformSecretKey)
    const amountInCents = Math.round(Number(planData.price) * 100)
    const durationDays = Number(planData.duration_days ?? 30)
    const applicationFeeCents = Math.round(amountInCents * APPLICATION_FEE_PERCENT / 100)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: planData.name as string,
              description: planData.description as string | undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      metadata: {
        plan_id: planId,
        duration_days: String(durationDays),
        connected_account: connectedAccountId,
      },
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: connectedAccountId,
      },
      success_url: `${req.headers.get("origin") || "http://localhost:3000"}/exams?subscription=success`,
      cancel_url: `${req.headers.get("origin") || "http://localhost:3000"}/exams?subscription=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("Create checkout error:", e)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
