"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, useProfile } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n/translations"
import { Loader2, User, Key, Globe, Camera, Save, CheckCircle2, AlertCircle, Plus, X, Languages } from "lucide-react"

export default function SettingsPage() {
  const { t } = useTranslation()
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

  const [siteLanguages, setSiteLanguages] = useState<string[]>(["nl"])
  const [newLang, setNewLang] = useState("")
  const [savingLangs, setSavingLangs] = useState(false)
  const [langMessage, setLangMessage] = useState<string | null>(null)

  const [studentLang, setStudentLang] = useState("nl")
  const [savingStudentLang, setSavingStudentLang] = useState(false)
  const [studentLangMessage, setStudentLangMessage] = useState<string | null>(null)

  const langOptions: Record<string, string> = {
    nl: "Nederlands", en: "English", ar: "العربية", fr: "Français",
    de: "Deutsch", tr: "Türkçe", pl: "Polski", es: "Español", it: "Italiano",
  }

  useEffect(() => {
    if (profile) {
      setName(profile.name || "")
      setStudentLang(profile.language || "nl")
      setSiteName("RijTheorie Pro")
    }
  }, [profile])

  useEffect(() => {
    supabase.from("site_settings").select("site_name, languages").eq("id", 1).single().then(({ data, error }) => {
      if (error && error.code === "PGRST205") return
      if (data) {
        setSiteName(data.site_name || "RijTheorie Pro")
        setSiteLanguages(data.languages as string[] || ["nl"])
      }
    })
  }, [])

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

  const saveStudentLang = async () => {
    setSavingStudentLang(true)
    setStudentLangMessage(null)
    try {
      const { error } = await supabase.from("profiles").update({ language: studentLang }).eq("id", session!.user!.id)
      if (error) throw error
      setStudentLangMessage("Taalvoorkeur opgeslagen!")
      refetchProfile()
    } catch (e) {
      setStudentLangMessage("Fout bij opslaan")
    } finally {
      setSavingStudentLang(false)
    }
  }

  const addLanguage = () => {
    const code = newLang.trim().toLowerCase()
    if (!code || siteLanguages.includes(code)) return
    setSiteLanguages([...siteLanguages, code])
    setNewLang("")
  }

  const removeLanguage = (code: string) => {
    if (code === "nl") return
    setSiteLanguages(siteLanguages.filter((l) => l !== code))
  }

  const saveLanguages = async () => {
    setSavingLangs(true)
    setLangMessage(null)
    try {
      const { error } = await supabase.from("site_settings").upsert({ id: 1, languages: siteLanguages, updated_at: new Date().toISOString() })
      if (error) throw error
      setLangMessage("Talen opgeslagen!")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fout bij opslaan"
      if (msg.includes("site_settings") || msg.includes("PGRST205")) {
        setLangMessage("Tabel 'site_settings' bestaat niet. Voer het SQL script uit in de Supabase SQL Editor.")
      } else {
        setLangMessage(msg)
      }
    } finally {
      setSavingLangs(false)
    }
  }

  const runMigration = async () => {
    setLangMessage(null)
    setSavingLangs(true)
    try {
      const res = await fetch("/api/migrate", { method: "POST" })
      const body = await res.json()
      if (res.ok) {
        setLangMessage("Tabel succesvol aangemaakt! Herlaad de pagina.")
      } else {
        setLangMessage(body.error || "Migratie mislukt. Voer SQL handmatig uit in Supabase dashboard.")
      }
    } catch {
      setLangMessage("Netwerkfout. Voer SQL handmatig uit in Supabase dashboard.")
    } finally {
      setSavingLangs(false)
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
      <h1 className="text-headline-lg text-primary mb-2">{t("settings.title")}</h1>
      <p className="text-body-md text-on-surface-variant mb-8">{t("settings.subtitle")}</p>

      {/* Profile Section */}
      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
            <User size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-headline-md font-bold text-primary">{t("settings.profile")}</h2>
            <p className="text-label-sm text-on-surface-variant">{t("settings.profileDesc")}</p>
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
            <label className="block text-label-sm font-bold text-primary mb-1.5">{t("settings.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder={t("settings.namePlaceholder")}
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
          {savingProfile ? t("common.loading") : t("settings.saveProfile")}
          <Save size={16} />
        </Button>
      </div>

      {/* Language Section */}
      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
            <Languages size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-headline-md font-bold text-primary">{t("settings.language")}</h2>
            <p className="text-label-sm text-on-surface-variant">{t("settings.languageDesc")}</p>
          </div>
        </div>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">{t("settings.studyLang")}</label>
            <select
              value={studentLang}
              onChange={(e) => setStudentLang(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              {Object.entries(langOptions).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        {studentLangMessage && (
          <div className="flex items-center gap-2 text-label-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={16} />
            {studentLangMessage}
          </div>
        )}
        <Button onClick={saveStudentLang} disabled={savingStudentLang} className="w-full sm:w-auto">
          {savingStudentLang ? t("common.loading") : t("settings.saveLang")}
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
            <h2 className="text-headline-md font-bold text-primary">{t("settings.password")}</h2>
            <p className="text-label-sm text-on-surface-variant">{t("settings.passwordDesc")}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">{t("settings.currentPassword")}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder={t("settings.currentPasswordPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">{t("settings.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder={t("settings.newPasswordPlaceholder")}
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
          {changingPassword ? t("common.loading") : t("settings.changePassword")}
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
            <h2 className="text-headline-md font-bold text-primary">{t("settings.siteSettings")}</h2>
            <p className="text-label-sm text-on-surface-variant">{t("settings.subtitle")}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-label-sm font-bold text-primary mb-1.5">{t("settings.siteName")}</label>
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
          {savingSite ? t("common.loading") : t("settings.saveSiteName")}
          <Save size={16} />
        </Button>
      </div>

      {profile?.role === "admin" && (
        <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
              <Globe size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-headline-md font-bold text-primary">{t("settings.platformLangs")}</h2>
              <p className="text-label-sm text-on-surface-variant">{t("settings.platformLangsDesc")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {siteLanguages.map((code) => (
              <div key={code} className="flex items-center gap-1.5 bg-primary-container/30 text-on-primary-container px-3 py-1.5 rounded-full text-label-sm font-medium">
                <span>{langOptions[code] || code.toUpperCase()}</span>
                {code !== "nl" && (
                  <button type="button" onClick={() => removeLanguage(code)} className="hover:text-destructive transition-colors">
                    <X size={14} />
                  </button>
                )}
                {code === "nl" && <span className="text-[10px] text-outline">{t("settings.default")}</span>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mb-4">
            <select
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border border-outline-variant/50 bg-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="">{t("settings.selectLang")}</option>
              {Object.entries(langOptions)
                .filter(([code]) => !siteLanguages.includes(code))
                .map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
            </select>
            <button
              type="button"
              onClick={addLanguage}
              disabled={!newLang}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-label-sm hover:opacity-90 transition-all disabled:opacity-30 flex items-center gap-1"
            >
              <Plus size={16} />
              {t("settings.add")}
            </button>
          </div>
          {langMessage && (
            <div className={`flex items-center gap-2 text-label-sm rounded-xl px-4 py-3 mb-4 ${langMessage.includes("SQL") ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-700"}`}>
              {langMessage.includes("SQL") ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{langMessage}</span>
              {langMessage.includes("bestaat niet") && (
                <button type="button" onClick={runMigration} disabled={savingLangs} className="ml-auto text-label-sm font-bold text-primary hover:underline shrink-0">
                  {savingLangs ? t("common.loading") : t("settings.tryCreate")}
                </button>
              )}
            </div>
          )}
          <Button onClick={saveLanguages} disabled={savingLangs} className="w-full sm:w-auto">
            {savingLangs ? t("common.loading") : t("settings.saveLangs")}
            <Save size={16} />
          </Button>
        </div>
      )}
    </div>
  )
}