import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { secretKey } = await req.json()
    if (!secretKey || typeof secretKey !== "string") {
      return NextResponse.json({ valid: false, error: "Missing secret key" }, { status: 400 })
    }

    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    if (!res.ok) {
      return NextResponse.json({ valid: false, error: "Invalid key" })
    }

    const balance = await res.json()
    return NextResponse.json({ valid: true, balance })
  } catch {
    return NextResponse.json({ valid: false, error: "Verification failed" }, { status: 500 })
  }
}
