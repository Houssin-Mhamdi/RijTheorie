const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ""

/**
 * Upload a file (image/video/audio) to Cloudinary using an unsigned upload preset.
 * Returns the secure URL, or null on failure.
 */
export async function uploadToCloudinary(file: File, folder: string): Promise<string | null> {
  if (!CLOUD_NAME || !process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
    console.error("Cloudinary is not configured")
    return null
  }

  const form = new FormData()
  form.append("file", file)
  form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
  if (folder) form.append("folder", folder)
  // Unique public_id to avoid collisions (preset uses overwrite:false, unique filename:false)
  const base = (file.name || "file").replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40) || "asset"
  const slug = crypto.randomUUID?.() ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  form.append("public_id", `${base}-${slug}`)

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      console.error("Cloudinary upload failed", err)
      return null
    }
    const data = await res.json()
    return data.secure_url ?? null
  } catch (e) {
    console.error("Cloudinary upload error", e)
    return null
  }
}

/**
 * Delete a Cloudinary asset by URL. Returns true if the cloud said it's deleted
 * (or not present). Fire-and-forget friendly; never throws.
 */
export async function deleteCloudinaryAsset(url: string): Promise<void> {
  const publicId = cloudinaryPublicIdFromUrl(url)
  if (!publicId || !url.includes("cloudinary.com")) return
  try {
    await fetch("/api/cloudinary/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id: publicId }),
    })
  } catch (e) {
    console.error("Cloudinary delete request failed", e)
  }
}

/**
 * Extract the Cloudinary public_id from a secure_url so we can delete it.
 * e.g. https://res.cloudinary.com/co263ppa/image/upload/v123/questions/abc.png
 *   -> questions/abc
 */
export function cloudinaryPublicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname
    if (!host.endsWith("cloudinary.com") && !host.includes("res.cloudinary")) return null
    const parts = u.pathname.split("/")
    // .../upload/<version>/<public_id_without_extension>
    const uploadIdx = parts.indexOf("upload")
    if (uploadIdx === -1) return null
    const afterUpload = parts.slice(uploadIdx + 2) // skip "upload" and the version segment
    const last = afterUpload.pop()
    if (!last) return null
    const publicId = afterUpload.length ? afterUpload.join("/") + "/" + last : last
    return publicId.replace(/\.[^/.]+$/, "")
  } catch {
    return null
  }
}
