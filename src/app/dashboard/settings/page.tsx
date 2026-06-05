"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, useProfile } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Loader2, User, Key, Globe, Camera, Save, CheckCircle2, AlertCircle } from "lucide-react"

export default function SettingsPage() {
  const { data: session, isLoading: sessionLoading } = useSession()
  const { data: profile, refetch: refetchProfile } = useProfile()
  const router = useRouter()

  const [name, setName] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [siteName, setSiteName] = useState("")
  const [savingSite, setSavingSite] = useState(false)
  const [siteMessage, setSiteMessage] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name || "")
      setSiteName("RijTheorie Pro")
    }
  }, [profile])

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login")
    }
  }, [session, sessionLoading, router])

  useEffect(() => {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile)
      setAvatarPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [avatarFile])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAvatarFile(file)
  }

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !session?.user?.id) return null
    const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const filePath = `avatars/${session.user.id}.${ext}`
    const { error } = await supabase.storage.from("avatars").upload(filePath, avatarFile, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath)
    return urlData.publicUrl
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    setProfileMessage(null)
    setProfileError(null)
    try {
      let avatarUrl = profile?.avatar_url ?? null
      if (avatarFile) {
        avatarUrl = await uploadAvatar()
      }
      const { error } = await supabase
        .from("profiles")
        .update({ name, avatar_url: avatarUrl })
        .eq("id", session!.user!.id)
      if (error) throw error
      if (name !== session?.user?.user_metadata?.name) {
        await supabase.auth.updateUser({ data: { name } })
      }
      setProfileMessage("Profiel opgeslagen!")
      refetchProfile()
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Fout bij opslaan")
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    setChangingPassword(true)
    setPasswordMessage(null)
    setPasswordError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session!.user!.email!,
        password: currentPassword,
      })
      if (signInError) throw new Error("Huidig wachtwoord is onjuist")
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordMessage("Wachtwoord gewijzigd!")
      setCurrentPassword("")
      setNewPassword("")
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Fout bij wijzigen wachtwoord")
    } finally {
      setChangingPassword(false)
    }
  }

  const saveSiteName = async () => {
    setSavingSite(true)
    setSiteMessage(null)
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ id: 1, site_name: siteName, updated_at: new Date().toISOString() })
      if (error) throw error
      setSiteMessage("Site naam opgeslagen!")
    } catch (e) {
      setSiteMessage("Fout bij opslaan")
    } finally {
      setSavingSite(false)
    }
  }

  if (sessionLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) return null

  const email = session.user?.email ?? ""
  const currentAvatar = avatarPreview || profile?.avatar_url

  return (
    <div className="px-4 md:px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-headline-lg text-primary mb-2">Instellingen</h1>
      <p className="text-body-md text-on-surface-variant mb-8">Beheer je profiel en site-instellingen</p>

      {/* Profile Section */}
      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
            <User size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-headline-md font-bold text-primary">Profiel</h2>
            <p className="text-label-sm text-on-surface-variant">Je persoonlijke gegevens</p>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="size-20 rounded-full bg-primary flex items-center justify-center text-white text-headline-md font-bold overflow-hidden">
              {currentAvatar ? (
                <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                email.split("@")[0].slice(0, 2).toUpperCase()
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity shadow-sm">
              <Camera size={14} />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <p className="text-label-md font-bold text-primary">{name || email}</p>
            <p className="text-label-sm text-on-surface-variant">{email}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Je naam"
            />
          </div>
        </div>

        {profileError && (
          <div className="flex items-center gap-2 text-label-sm text-error bg-red-50 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={16} />
            {profileError}
          </div>
        )}
        {profileMessage && (
          <div className="flex items-center gap-2 text-label-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={16} />
            {profileMessage}
          </div>
        )}

        <Button onClick={saveProfile} disabled={savingProfile} className="w-full sm:w-auto">
          {savingProfile ? "Bezig..." : "Profiel opslaan"}
          <Save size={16} />
        </Button>
      </div>

      {/* Password Section */}
      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
            <Key size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-headline-md font-bold text-primary">Wachtwoord</h2>
            <p className="text-label-sm text-on-surface-variant">Wijzig je wachtwoord</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">Huidig wachtwoord</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Vul huidig wachtwoord in"
            />
          </div>
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">Nieuw wachtwoord</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Vul nieuw wachtwoord in"
            />
          </div>
        </div>

        {passwordError && (
          <div className="flex items-center gap-2 text-label-sm text-error bg-red-50 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={16} />
            {passwordError}
          </div>
        )}
        {passwordMessage && (
          <div className="flex items-center gap-2 text-label-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={16} />
            {passwordMessage}
          </div>
        )}

        <Button onClick={changePassword} disabled={changingPassword || !currentPassword || !newPassword} className="w-full sm:w-auto">
          {changingPassword ? "Bezig..." : "Wachtwoord wijzigen"}
          <Key size={16} />
        </Button>
      </div>

      {/* Site Settings Section */}
      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
            <Globe size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-headline-md font-bold text-primary">Site Instellingen</h2>
            <p className="text-label-sm text-on-surface-variant">Wijzig de naam van je platform</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">Site naam</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="RijTheorie Pro"
            />
          </div>
        </div>

        {siteMessage && (
          <div className="flex items-center gap-2 text-label-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={16} />
            {siteMessage}
          </div>
        )}

        <Button onClick={saveSiteName} disabled={savingSite || !siteName} className="w-full sm:w-auto">
          {savingSite ? "Bezig..." : "Site naam opslaan"}
          <Save size={16} />
        </Button>
      </div>
    </div>
  )
}