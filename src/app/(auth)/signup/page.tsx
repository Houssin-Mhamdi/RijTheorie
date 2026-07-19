"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signupSchema, type SignupInput } from "@/lib/auth-schemas"
import { useSignup } from "@/hooks/use-auth"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, ArrowRight, HelpCircle, Shield, User, Lock, Eye, EyeOff, Loader2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n/translations"

export default function SignupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const signupMutation = useSignup()

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  async function onSubmit(data: SignupInput) {
    signupMutation.mutate(
      { name: data.name, email: data.email, password: data.password },
      {
        onSuccess: () => {
          router.push("/login?registered=true")
        },
        onError: (err) => {
          form.setError("email", { message: err.message })
        },
      },
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="md:hidden flex items-center gap-2 mb-8">
        <img src="/screen.png" alt="RijTheorie Pro" className="h-8 w-auto" />
        <span className="text-headline-md text-primary">RijTheorie Pro</span>
      </div>
      <h1 className="text-headline-md text-primary mb-2">{t("auth.signupTitle")}</h1>
      <p className="text-body-md text-on-surface-variant mb-8">{t("auth.signupSubtitle")}</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-label-md text-on-surface-variant ml-1">{t("auth.nameLabel")}</FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                      <User size={20} />
                    </div>
                    <Input
                      placeholder={t("auth.namePlaceholder")}
                      className="w-full h-[56px] pl-12 pr-4 bg-surface-container-low border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-outline"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-label-md text-on-surface-variant ml-1">{t("auth.emailLabel")}</FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                      <Mail size={20} />
                    </div>
                    <Input
                      placeholder={t("auth.emailPlaceholder")}
                      className="w-full h-[56px] pl-12 pr-4 bg-surface-container-low border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-outline"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-label-md text-on-surface-variant ml-1">{t("auth.passwordLabel")}</FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                      <Lock size={20} />
                    </div>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.minChars")}
                      className="w-full h-[56px] pl-12 pr-12 bg-surface-container-low border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-outline"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-label-md text-on-surface-variant ml-1">{t("auth.confirmPassword")}</FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                      <Lock size={20} />
                    </div>
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder={t("auth.confirmPasswordPlaceholder")}
                      className="w-full h-[56px] pl-12 pr-12 bg-surface-container-low border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-outline"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={signupMutation.isPending}
            className="w-full h-[56px] bg-primary-container text-on-primary-container text-body-md rounded-xl shadow-sm hover:bg-primary hover:text-on-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-60"
          >
            {signupMutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            )}
            <span>{signupMutation.isPending ? t("common.loading") : t("auth.register")}</span>
          </Button>
        </form>
      </Form>
      <div className="mt-10 pt-8 border-t border-outline-variant/30 text-center">
        <p className="text-label-md text-on-surface-variant mb-4">{t("auth.hasAccount")}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className="text-label-md text-primary hover:underline flex items-center gap-1">
            <HelpCircle size={18} />
            {t("auth.login")}
          </Link>
          <span className="hidden sm:block text-outline-variant">|</span>
            <Link href="/privacy" className="text-label-md text-primary hover:underline flex items-center gap-1">
              <Shield size={18} />
              {t("common.privacy")}
            </Link>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-center gap-4 opacity-40">
        <div className="h-px w-12 bg-outline-variant" />
        <p className="text-label-sm text-on-surface-variant tracking-widest uppercase">{t("landing.authority")}</p>
        <div className="h-px w-12 bg-outline-variant" />
      </div>
    </div>
  )
}
