import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: Request) {
  try {
    const { planId, userId } = await req.json()
    if (!planId || !userId) {
      return NextResponse.json({ error: "Missing planId or userId" }, { status: 400 })
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey)
    const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
    const secretKey = (settings?.payment_settings as Record<string, unknown> | undefined)?.stripe_secret_key as string | undefined
    if (!secretKey) {
      return NextResponse.json({ error: "Stripe not configured." }, { status: 400 })
    }

    const { data: plan } = await sb.from("subscription_plans").select("*").eq("id", planId).single()
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const planData = plan as Record<string, unknown>
    const stripe = new Stripe(secretKey)
    const amountInCents = Math.round(Number(planData.price) * 100)
    const durationDays = Number(planData.duration_days ?? 30)

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
