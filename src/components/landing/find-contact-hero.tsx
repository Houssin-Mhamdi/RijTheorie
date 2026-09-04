"use client"

import { useState } from "react"
import type { ReactNode, FormEvent } from "react"
import { Mail, Phone, Copy, Check, Star } from "lucide-react"
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
    name: "Richard Jefferson",
    title: "VP of Engineering at",
    company: "Pedalton",
    image:
      "https://image.qwenlm.ai/public_source/a92f22b4-8f4b-4626-8c02-a8c51b8bf13f/171e6dcc7-f6ae-40e4-8a95-7c5005351fda.png",
    email: "richard.j@pedalton.com",
    phone: "(678) 367-2035",
    companyColor: "#2ecc71",
    companyIcon: "circle",
  },
  {
    name: "Ashley Stapleton",
    title: "Director of Tech at",
    company: "Dealsforce",
    image:
      "https://image.qwenlm.ai/public_source/a92f22b4-8f4b-4626-8c02-a8c51b8bf13f/1dbc96c8a-94d0-493b-b022-76eb13aa7ad1.png",
    email: "ashley@dealsforce.com",
    phone: "(323) 463-4001",
    companyColor: "#3b6cf5",
    companyIcon: "circle",
  },
  {
    name: "Joseph Graham",
    title: "Sr. Manager at",
    company: "Fakebook",
    image:
      "https://image.qwenlm.ai/public_source/a92f22b4-8f4b-4626-8c02-a8c51b8bf13f/199691a6e-67d3-417c-a587-f31c204dc38f.png",
    email: "josephg@fakebook.com",
    phone: "(296) 562-7775",
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
            <Mail size={14} className={styles.cardInfoIcon} />
            <span>{person.email}</span>
          </div>
          <CopyButton text={person.email} onCopy={onCopy} personName={person.name} />
        </div>
      )}
      {person.phone && (
        <div className={styles.cardInfoRow}>
          <div className={styles.cardInfoLeft}>
            <Phone size={14} className={styles.cardInfoIcon} />
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
  title = "Find contact info for anyone",
  subtitle = "Real-time research and validation on over 1.3 billion+ business contacts and 121 million+ companies.",
  placeholder = "Business Email",
  cta = "Sign up for free",
  ratingScore = "4.4/5",
  ratingCount = "5,000+ REVIEWS",
  terms = "By submitting this form, you agree to our Terms of Use, Privacy Policy, and consent to receiving marketing communications from us.",
  people = DEFAULT_PEOPLE,
  noteText = (
    <>
      build lists of<br />
      dream prospects<br />
      with <span className={styles.badge}>Seamless.AI</span>
    </>
  ),
  logoText = (
    <>
      <strong>Over 1,000,000+ salespeople</strong> find leads, book appointments, and close more sales
      with Seamless.AI
    </>
  ),
  logos,
}: FindContactHeroProps) {
  const [email, setEmail] = useState("")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // Extendable: connect to your signup / onboarding flow here.
    console.log("Signup email:", email)
  }

  return (
    <>
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroSubtitle}>{subtitle}</p>

          <form className={styles.signupForm} onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder={placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className={styles.formIcon}>
              <Mail size={20} />
            </div>
            <button type="submit" className={styles.signupButton}>
              {cta}
            </button>
          </form>

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
    </>
  )
}
