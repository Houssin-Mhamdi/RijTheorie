"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { loginSchema, type LoginInput } from "@/lib/auth-schemas"
import { useLogin } from "@/hooks/use-auth"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, ArrowRight, HelpCircle, Shield, Eye, EyeOff, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "password">("email")
  const [showPassword, setShowPassword] = useState(false)
  const loginMutation = useLogin()

  const form = useForm<LoginInput>({
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(data: LoginInput) {
    if (step === "email") {
      const result = loginSchema.shape.email.safeParse(data.email)
      if (!result.success) {
        form.setError("email", { message: result.error.issues[0].message })
        return
      }
      setStep("password")
      return
    }

    const parsed = loginSchema.safeParse(data)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        form.setError(issue.path[0] as keyof LoginInput, { message: issue.message })
      }
      return
    }

    loginMutation.mutate(parsed.data, {
      onError: (err) => {
        form.setError("password", { message: err.message })
      },
    })
  }

  return (
    <div className="w-full max-w-sm">
      <div className="md:hidden flex items-center gap-2 mb-8">
        <img src="/screen.png" alt="RijTheorie Pro" className="h-8 w-auto" />
        <span className="text-headline-md text-primary">RijTheorie Pro</span>
      </div>
      <h1 className="text-headline-md text-primary mb-2">Welkom bij RijTheorie</h1>
      <p className="text-body-md text-on-surface-variant mb-8">
        {step === "email" ? "Log in om direct te starten met je theorie." : "Voer je wachtwoord in om in te loggen."}
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === "email" && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-label-md text-on-surface-variant ml-1">E-mailadres</FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                        <Mail size={20} />
                      </div>
                      <Input
                        placeholder="je@voorbeeld.nl"
                        className="w-full h-[56px] pl-12 pr-4 bg-surface-container-low border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-outline"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {step === "password" && (
            <>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-label-md text-on-surface-variant ml-1">E-mailadres</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant">
                          <Mail size={20} />
                        </div>
                        <Input
                          readOnly
                          className="w-full h-[56px] pl-12 pr-4 bg-surface-container-low border-outline-variant rounded-xl text-body-md opacity-60 cursor-default"
                          tabIndex={-1}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setStep("email")}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-label-sm text-primary font-semibold hover:underline"
                        >
                          Wijzig
                        </button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-label-md text-on-surface-variant ml-1">Wachtwoord</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                          <Shield size={20} />
                        </div>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Je wachtwoord"
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
            </>
          )}
          <Button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full h-[56px] bg-primary-container text-on-primary-container text-body-md rounded-xl shadow-sm hover:bg-primary hover:text-on-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-60"
          >
            {loginMutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            )}
            <span>{loginMutation.isPending ? "Bezig met inloggen..." : "Inloggen"}</span>
          </Button>
        </form>
      </Form>
      <div className="mt-10 pt-8 border-t border-outline-variant/30 text-center">
        <p className="text-label-md text-on-surface-variant mb-4">Nog geen account?</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup" className="text-label-md text-primary hover:underline flex items-center gap-1">
            <HelpCircle size={18} />
            Account aanmaken
          </Link>
          <span className="hidden sm:block text-outline-variant">|</span>
          <Link href="#" className="text-label-md text-primary hover:underline flex items-center gap-1">
            <Shield size={18} />
            Privacy Policy
          </Link>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-center gap-4 opacity-40">
        <div className="h-px w-12 bg-outline-variant" />
        <p className="text-label-sm text-on-surface-variant tracking-widest uppercase">Autoriteit in Verkeer</p>
        <div className="h-px w-12 bg-outline-variant" />
      </div>
    </div>
  )
}
