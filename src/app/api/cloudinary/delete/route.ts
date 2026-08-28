import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import crypto from "crypto"

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ""
const API_KEY = process.env.CLOUDINARY_API_KEY || ""
const API_SECRET = process.env.CLOUDINARY_API_SECRET || ""

export async function DELETE(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (!isAdmin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ ok: false, error: "Cloudinary is not configured" }, { status: 500 })
  }

  const { public_id } = await req.json().catch(() => ({}))
  if (!public_id || typeof public_id !== "string") {
    return NextResponse.json({ ok: false, error: "public_id is required" }, { status: 400 })
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const toSign = `public_id=${public_id}&timestamp=${timestamp}${API_SECRET}`
  const signature = crypto.createHash("sha1").update(toSign).digest("hex")

  const body = new URLSearchParams({
    public_id,
    timestamp,
    api_key: API_KEY,
    signature,
  })

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
      { method: "POST", body },
    )
    const data = await res.json().catch(() => null)
    return NextResponse.json({ ok: res.ok, result: data?.result ?? null, error: data?.error?.message ?? null })
  } catch (e) {
    console.error("Cloudinary delete error", e)
    return NextResponse.json({ ok: false, error: "Failed to delete from Cloudinary" }, { status: 500 })
  }
}
