"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Copy, Check, Star, ArrowDown, ArrowRight, FileQuestion, PlayCircle, X, Loader2, GraduationCap } from "lucide-react"
import { supabase } from "@/lib/supabase"
import styles from "./find-contact-hero.module.css"
import { useTranslation } from "@/lib/i18n/translations"

export interface ContactPerson {
  name: string
  title: string
  company: string
  image: string
  email?: string
  phone?: string
  companyColor?: string
  companyIcon?: "circle" | "square"
}

interface FindContactHeroProps {
  title?: string
  subtitle?: string
  placeholder?: string
  cta?: string
  ratingScore?: string
  ratingCount?: string
  terms?: ReactNode
  people?: ContactPerson[]
  noteText?: ReactNode
}

const STAR_PATH =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"

function CompanyBadge({ color, icon }: { color: string; icon: "circle" | "square" }) {
  return (
    <span
      className={styles.cardCompanyIcon}
      style={
        icon === "square"
          ? { background: color, borderRadius: 4, transform: "scale(0.8)" }
          : undefined
      }
      aria-hidden
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: icon === "circle" ? "50%" : 3,
          background: icon === "circle" ? color : "#fff",
        }}
      />
    </span>
  )
}

function MiniAvatarStack({ people }: { people: ContactPerson[] }) {
  return (
    <div className={styles.miniAvatars}>
      {people.slice(0, 3).map((p) => (
        <div key={p.name} className={styles.miniAvatar}>
          <img src={p.image} alt={p.name} />
        </div>
      ))}
    </div>
  )
}

function ProfileCard({
  person,
  position,
  onCopy,
}: {
  person: ContactPerson
  position: "left" | "middle" | "right"
  onCopy: (text: string, personName: string) => void
}) {
  const positionClass =
    position === "left" ? styles.cardLeft : position === "right" ? styles.cardRight : styles.cardMiddle

  return (
    <div className={`${styles.profileCard} ${positionClass}`}>
      <div className={styles.cardImageWrapper}>
        <img src={person.image} alt={person.name} />
        <CompanyBadge color={person.companyColor ?? "#3b6cf5"} icon={person.companyIcon ?? "circle"} />
      </div>
      <div className={styles.cardName}>{person.name}</div>
      <div className={styles.cardTitle}>
        {person.title} <span className={styles.company}>{person.company}</span>
      </div>
      {person.email && (
        <div className={styles.cardInfoRow}>
          <div className={styles.cardInfoLeft}>
            <FileQuestion size={14} className={styles.cardInfoIcon} />
            <span>{person.email}</span>
          </div>
          <CopyButton text={person.email} onCopy={onCopy} personName={person.name} />
        </div>
      )}
      {person.phone && (
        <div className={styles.cardInfoRow}>
          <div className={styles.cardInfoLeft}>
            <PlayCircle size={14} className={styles.cardInfoIcon} />
            <span>{person.phone}</span>
          </div>
          <CopyButton text={person.phone} onCopy={onCopy} personName={person.name} />
        </div>
      )}
    </div>
  )
}

function CopyButton({
  text,
  onCopy,
  personName,
}: {
  text: string
  onCopy: (text: string, personName: string) => void
  personName: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    onCopy(text, personName)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className={styles.copyBtn}
      onClick={handleCopy}
      aria-label={`Copy ${text}`}
    >
      {copied ? <Check size={16} color="#2ecc71" /> : <Copy size={16} />}
    </button>
  )
}

export function FindContactHero({
  title,
  subtitle,
  cta,
  ratingScore = "4.9/5",
  ratingCount,
  terms,
  people,
  noteText,
}: FindContactHeroProps) {
  const { t } = useTranslation()
  const resolvedPeople =
    people ??
    [
      {
        name: t("hero2.card1.name"),
        title: t("hero2.card1.practice"),
        company: t("hero2.card1.company"),
        image: "/hero/hero-1.png",
        email: t("hero2.card1.count"),
        phone: t("hero2.card1.extra"),
        companyColor: "#2ecc71",
        companyIcon: "circle" as const,
      },
      {
        name: t("hero2.card2.name"),
        title: t("hero2.card2.practice"),
        company: t("hero2.card2.company"),
        image: "/hero/hero-2.png",
        email: t("hero2.card2.count"),
        phone: t("hero2.card2.extra"),
        companyColor: "#3b6cf5",
        companyIcon: "circle" as const,
      },
      {
        name: t("hero2.card3.name"),
        title: t("hero2.card3.practice"),
        company: t("hero2.card3.company"),
        image: "/hero/hero-3.png",
        email: t("hero2.card3.count"),
        phone: t("hero2.card3.extra"),
        companyColor: "#e74c3c",
        companyIcon: "square" as const,
      },
    ]
  const resolvedTitle = title ?? t("hero2.title")
  const resolvedSubtitle = subtitle ?? t("hero2.subtitle")
  const resolvedCta = cta ?? t("hero2.cta")
  const resolvedRatingCount = ratingCount ?? t("hero2.ratingCount")
  const resolvedTerms = terms ?? t("hero2.terms")
  const resolvedNote =
    noteText ?? (
      <>
        {t("hero2.noteLine1")}
        <br />
        {t("hero2.noteLine2")}
        <br />
        {t("hero2.noteWord")} <span className={styles.badge}>RijTheorie Pro</span>
      </>
    )
  const [freeExams, setFreeExams] = useState<{ id: string; title: string; description?: string | null }[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const handleStart = async () => {
    setModalOpen(true)
    setModalLoading(true)
    setModalError(null)
    try {
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, description")
        .eq("is_free", true)
        .order("created_at", { ascending: true })
        .limit(20)
      if (error) throw error
      setFreeExams((data as { id: string; title: string; description?: string | null }[]) ?? [])
      if (!data || data.length === 0) {
        setModalError(t("hero2.modalErrorEmpty"))
      }
    } catch {
      setModalError(t("hero2.modalErrorLoad"))
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <>
      <section className={styles.heroSection}>
        <div className={styles.heroBottomFade} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{resolvedTitle}</h1>
          <p className={styles.heroSubtitle}>{resolvedSubtitle}</p>

          <div className={styles.ctaWrap}>
            <div className={styles.pointer}>
              <ArrowDown size={26} className={styles.pointerIcon} />
              <span className={styles.pointerLabel}>{t("hero2.pointerLabel")}</span>
            </div>
            <div className={styles.btnGroup}>
              <button type="button" onClick={handleStart} className={styles.signupButton}>
                <span className={styles.btnGradient} />
                <span className={styles.btnInner}>
                  <span className={styles.btnText}>{resolvedCta}</span>
                  <ArrowRight size={24} className={styles.btnArrow} />
                </span>
              </button>
            </div>
          </div>

          <p className={styles.termsText}>{resolvedTerms}</p>

          <div className={styles.ratingSection}>
            <div className={styles.g2Logo}>G</div>
            <div className={styles.stars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={18} fill="#3b6cf5" color="#3b6cf5" />
              ))}
            </div>
            <span className={styles.ratingText}>
              <strong>{ratingScore}</strong> | {resolvedRatingCount}
            </span>
          </div>
        </div>

        <div className={styles.cardsWithAnnotation}>
          <ProfileCard person={resolvedPeople[0]} position="left" onCopy={() => {}} />
          <ProfileCard person={resolvedPeople[1]} position="middle" onCopy={() => {}} />

          <div className={styles.annotationContainer}>
            <ProfileCard person={resolvedPeople[2]} position="right" onCopy={() => {}} />
            <div className={styles.handwrittenNote}>{resolvedNote}</div>
            <div className={styles.noteArrow}>
              <svg viewBox="0 0 140 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 10 C 40 10, 70 20, 100 50"
                  stroke="#2a2a4a"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  fill="none"
                />
                <path d="M95 45 L102 52 L92 52 Z" fill="#2a2a4a" />
              </svg>
            </div>
            <MiniAvatarStack people={resolvedPeople} />
          </div>
        </div>
      </section>

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>{t("hero2.modalTitle")}</h3>
                <p className={styles.modalSubtitle}>{t("hero2.modalSubtitle")}</p>
              </div>
              <button className={styles.modalClose} onClick={() => setModalOpen(false)} aria-label={t("hero2.modalClose")}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {modalLoading ? (
                <div className={styles.modalLoading}>
                  <Loader2 size={28} className={styles.modalSpinner} />
                  <span>{t("hero2.modalLoading")}</span>
                </div>
              ) : modalError ? (
                <p className={styles.modalError}>{modalError}</p>
              ) : (
                <div className={styles.modalList}>
                  {freeExams.map((ex) => (
                    <button
                      key={ex.id}
                      className={styles.modalItem}
                      onClick={() => {
                        window.location.href = `/gratis-examen/${ex.id}`
                      }}
                    >
                      <span className={styles.modalItemIcon}>
                        <GraduationCap size={20} />
                      </span>
                      <span className={styles.modalItemText}>
                        <span className={styles.modalItemTitle}>{ex.title}</span>
                        {ex.description && <span className={styles.modalItemDesc}>{ex.description}</span>}
                        <span className={styles.modalItemBadge}>{t("hero2.freeBadge")}</span>
                      </span>
                      <ArrowRight size={18} className={styles.modalItemArrow} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
