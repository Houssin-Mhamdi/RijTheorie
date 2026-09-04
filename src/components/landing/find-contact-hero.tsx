"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Copy, Check, Star, ArrowDown, ArrowRight, FileQuestion, PlayCircle, X, Loader2, GraduationCap } from "lucide-react"
import { supabase } from "@/lib/supabase"
import styles from "./find-contact-hero.module.css"

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
  logoText?: ReactNode
  logos?: ReactNode
}

const DEFAULT_PEOPLE: ContactPerson[] = [
  {
    name: "Voorrang",
    title: "Oefen het",
    company: "rechts voorrang",
    image: "/hero/hero-1.png",
    email: "50 examenvragen",
    phone: "met hotspots",
    companyColor: "#2ecc71",
    companyIcon: "circle",
  },
  {
    name: "Verkeersregels",
    title: "Oefen het",
    company: "borden & strepen",
    image: "/hero/hero-2.png",
    email: "60 examenvragen",
    phone: "incl. video",
    companyColor: "#3b6cf5",
    companyIcon: "circle",
  },
  {
    name: "Gevaarherkenning",
    title: "Oefen het",
    company: "25 situaties",
    image: "/hero/hero-3.png",
    email: "reactiesnelheid",
    phone: "examenmodules",
    companyColor: "#e74c3c",
    companyIcon: "square",
  },
]

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
  title = "Slaag voor je theorie-examen",
  subtitle = "Oefen met realistische verkeerssituaties, hotspots en honderden examenvragen. Klaar voor het echte CBR-examen?",
  cta = "Gratis examen",
  ratingScore = "4.9/5",
  ratingCount = "2.500+ REVIEWS",
  terms = "Begin direct met oefenen — geen creditcard nodig.",
  people = DEFAULT_PEOPLE,
  noteText = (
    <>
      oefen met<br />
      echte situaties<br />
      en <span className={styles.badge}>RijTheorie Pro</span>
    </>
  ),
  logoText = (
    <>
      <strong>Meer dan 50.000 cursisten</strong> slaagden al met RijTheorie Pro voor hun theorie-examen.
    </>
  ),
  logos,
}: FindContactHeroProps) {
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
        setModalError("Er zijn momenteel geen gratis examens beschikbaar.")
      }
    } catch {
      setModalError("Kon de gratis examens niet laden.")
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <>
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroSubtitle}>{subtitle}</p>

          <div className={styles.ctaWrap}>
            <div className={styles.pointer}>
              <ArrowDown size={26} className={styles.pointerIcon} />
              <span className={styles.pointerLabel}>Gratis proberen</span>
            </div>
            <div className={styles.btnGroup}>
              <button type="button" onClick={handleStart} className={styles.signupButton}>
                <span className={styles.btnGradient} />
                <span className={styles.btnInner}>
                  <span className={styles.btnText}>{cta}</span>
                  <ArrowRight size={24} className={styles.btnArrow} />
                </span>
              </button>
            </div>
          </div>

          <p className={styles.termsText}>{terms}</p>

          <div className={styles.ratingSection}>
            <div className={styles.g2Logo}>G</div>
            <div className={styles.stars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={18} fill="#3b6cf5" color="#3b6cf5" />
              ))}
            </div>
            <span className={styles.ratingText}>
              <strong>{ratingScore}</strong> | {ratingCount}
            </span>
          </div>
        </div>

        <div className={styles.cardsWithAnnotation}>
          <ProfileCard person={people[0]} position="left" onCopy={() => {}} />
          <ProfileCard person={people[1]} position="middle" onCopy={() => {}} />

          <div className={styles.annotationContainer}>
            <ProfileCard person={people[2]} position="right" onCopy={() => {}} />
            <div className={styles.handwrittenNote}>{noteText}</div>
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
            <MiniAvatarStack people={people} />
          </div>
        </div>
      </section>

      <div className={styles.heroBottomGradient} />

      <section className={styles.bottomSection}>
        <p className={styles.bottomText}>{logoText}</p>
        {logos ? (
          logos
        ) : (
          <div className={styles.companyLogos}>
            <div className={`${styles.companyLogo} ${styles.logoIheart}`}>
              <Star size={24} fill="#333" color="#333" />
              iHeart<span>MEDIA</span>
            </div>
            <div className={`${styles.companyLogo} ${styles.logoAdp}`}>ADP</div>
            <div className={`${styles.companyLogo} ${styles.logoOracle}`}>ORACLE</div>
            <div className={`${styles.companyLogo} ${styles.logoIntercom}`}>
              <span className={styles.icon} />
              INTERCOM
            </div>
            <div className={`${styles.companyLogo} ${styles.logoLogitech}`}>logitech</div>
            <div className={`${styles.companyLogo} ${styles.logoMongodb}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#333">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              MongoDB
            </div>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Kies een gratis examen</h3>
                <p className={styles.modalSubtitle}>Geen account nodig — niets wordt opgeslagen.</p>
              </div>
              <button className={styles.modalClose} onClick={() => setModalOpen(false)} aria-label="Sluiten">
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {modalLoading ? (
                <div className={styles.modalLoading}>
                  <Loader2 size={28} className={styles.modalSpinner} />
                  <span>Examen laden…</span>
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
                        <span className={styles.modalItemBadge}>Gratis</span>
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
