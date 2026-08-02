"use client"

import { useState, useRef, useEffect } from "react"
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react"

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isBetween(d: Date, start: Date, end: Date) {
  const t = d.getTime(), s = start.getTime(), e = end.getTime()
  return t > s && t < e
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatDisplay(d: Date | null) {
  if (!d) return ""
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
}

const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]
const MONTHS_NL = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"]

function CalendarMonth({ month, startDate, endDate, hoverDate, onDayClick, onDayHover, maxDate }: {
  month: Date
  startDate: Date | null
  endDate: Date | null
  hoverDate: Date | null
  onDayClick: (d: Date) => void
  onDayHover: (d: Date) => void
  maxDate: Date
}) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = startOfMonth(month).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, m + 1, 0).getDate()

  const days: (Date | null)[] = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, m, d))

  const previewEnd = startDate && !endDate && hoverDate && hoverDate > startDate ? hoverDate : null
  const previewStart = startDate && !endDate && hoverDate && hoverDate < startDate ? hoverDate : null
  const effectiveStart = previewStart || startDate
  const effectiveEnd = previewEnd || endDate

  return (
    <div className="w-[280px] sm:w-[300px]">
      <p className="text-center text-title-md font-bold text-on-surface mb-5">
        {MONTHS_NL[m]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-label-sm font-semibold text-on-surface-variant/60 pb-3">{wd}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          if (day > maxDate) return <div key={`future-${i}`} />

          const isStart = effectiveStart && isSameDay(day, effectiveStart)
          const isEnd = effectiveEnd && isSameDay(day, effectiveEnd)
          const isSelected = isStart || isEnd
          const inRange = effectiveStart && effectiveEnd && isBetween(day, effectiveStart, effectiveEnd)

          let bgClass = ""
          if (isSelected) bgClass = "bg-primary text-on-primary font-bold shadow-md"
          else if (inRange) bgClass = "bg-primary/15 text-primary font-medium"

          return (
            <div key={i} className="relative flex items-center justify-center">
              {inRange && !isSelected && (
                <div className="absolute inset-x-[-2px] inset-y-[-2px] bg-primary/10" />
              )}
              {isStart && !isEnd && effectiveEnd && (
                <div className="absolute right-0 top-[-2px] bottom-[-2px] w-1/2 bg-primary/10" />
              )}
              {isEnd && !isStart && effectiveStart && (
                <div className="absolute left-0 top-[-2px] bottom-[-2px] w-1/2 bg-primary/10" />
              )}
              <button
                type="button"
                onClick={() => onDayClick(day)}
                onMouseEnter={() => onDayHover(day)}
                className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full text-body-sm transition-all duration-100 ${bgClass} hover:bg-primary/20 hover:scale-110 active:scale-95`}
              >
                {day.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AirbnbDateRange({ dateFrom, dateTo, onFromChange, onToChange }: {
  dateFrom: string
  dateTo: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"start" | "end">("start")
  const [tempStart, setTempStart] = useState<Date | null>(dateFrom ? new Date(dateFrom) : null)
  const [tempEnd, setTempEnd] = useState<Date | null>(dateTo ? new Date(dateTo) : null)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [baseMonth, setBaseMonth] = useState(() => startOfMonth(new Date()))
  const [mobilePage, setMobilePage] = useState<"left" | "right">("left")

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      setTempStart(dateFrom ? new Date(dateFrom) : null)
      setTempEnd(dateTo ? new Date(dateTo) : null)
      setStep("start")
      setMobilePage("left")
      if (dateFrom) {
        const d = new Date(dateFrom)
        setBaseMonth(startOfMonth(d))
      } else {
        setBaseMonth(startOfMonth(new Date()))
      }
    }
  }, [open, dateFrom, dateTo])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  const maxDate = new Date()

  const handleDayClick = (d: Date) => {
    if (step === "start") {
      setTempStart(d)
      setTempEnd(null)
      setStep("end")
    } else {
      if (tempStart && d < tempStart) {
        setTempStart(d)
        setTempEnd(null)
        setStep("end")
      } else {
        setTempEnd(d)
      }
    }
  }

  const handleDayHover = (d: Date) => {
    if (step === "end") setHoverDate(d)
  }

  const applySelection = () => {
    onFromChange(tempStart ? toISO(tempStart) : "")
    onToChange(tempEnd ? toISO(tempEnd) : "")
    setOpen(false)
  }

  const clearSelection = () => {
    setTempStart(null)
    setTempEnd(null)
    onFromChange("")
    onToChange("")
    setOpen(false)
  }

  const isFiltered = !!(dateFrom && dateTo)
  const leftMonth = baseMonth
  const rightMonth = addMonths(baseMonth, 1)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center rounded-2xl border transition-all duration-200 overflow-hidden ${
          isFiltered
            ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
            : "bg-surface border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60 hover:shadow-sm"
        }`}
      >
        <span className="flex items-center gap-2 px-4 py-3">
          <Calendar size={18} className="shrink-0 text-on-surface-variant/70" />
        </span>
        <div className="hidden sm:flex items-stretch divide-x divide-outline-variant/20">
          <span className="flex flex-col items-start gap-0.5 px-4 py-2 min-w-[130px]">
            <span className="text-label-xs uppercase tracking-wide text-on-surface-variant/60">Start datum</span>
            <span className={`text-body-sm ${isFiltered ? "font-semibold" : ""}`}>
              {dateFrom ? formatDisplay(new Date(dateFrom)) : "Wanneer?"}
            </span>
          </span>
          <span className="flex flex-col items-start gap-0.5 px-4 py-2 min-w-[130px]">
            <span className="text-label-xs uppercase tracking-wide text-on-surface-variant/60">Eind datum</span>
            <span className={`text-body-sm ${isFiltered ? "font-semibold" : ""}`}>
              {dateTo ? formatDisplay(new Date(dateTo)) : "Wanneer?"}
            </span>
          </span>
        </div>
        <span className="flex sm:hidden items-center gap-1.5 px-3 py-3 text-label-md">
          <span className={isFiltered ? "font-semibold" : ""}>
            {dateFrom ? new Date(dateFrom).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "Start"}
          </span>
          <span className="text-on-surface-variant/40">—</span>
          <span className={isFiltered ? "font-semibold" : ""}>
            {dateTo ? new Date(dateTo).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "Eind"}
          </span>
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 sm:hidden" onClick={() => setOpen(false)} />

          <div className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-3 sm:w-fit bg-surface-container-lowest sm:rounded-3xl rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] border border-outline-variant/20 sm:p-8 p-5 sm:max-w-none max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="min-w-0">
                <p className="text-title-lg font-bold text-on-surface truncate">
                  {tempStart ? formatDisplay(tempStart) : "Wanneer?"}
                  {tempStart && tempEnd && (
                    <span className="hidden sm:inline"> — {formatDisplay(tempEnd)}</span>
                  )}
                  {tempStart && tempEnd && (
                    <span className="sm:hidden"><br />{formatDisplay(tempEnd)}</span>
                  )}
                </p>
                <p className="text-body-md text-on-surface-variant mt-1">
                  {step === "start" ? "Selecteer startdatum" : tempEnd ? "Geselecteerd" : "Selecteer einddatum"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  onClick={() => setOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-surface-container-low transition-colors sm:hidden"
                >
                  <X size={20} className="text-on-surface-variant" />
                </button>
                <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
                  <button
                    onClick={() => {
                      if (mobilePage === "right") {
                        setMobilePage("left")
                      } else {
                        setBaseMonth(addMonths(baseMonth, -1))
                      }
                    }}
                    className="p-2.5 rounded-lg hover:bg-surface-container-low transition-colors"
                  >
                    <ChevronLeft size={18} className="text-on-surface-variant" />
                  </button>
                  <button
                    onClick={() => {
                      if (mobilePage === "left") {
                        setMobilePage("right")
                      } else {
                        setBaseMonth(addMonths(baseMonth, 1))
                      }
                    }}
                    className="p-2.5 rounded-lg hover:bg-surface-container-low transition-colors"
                  >
                    <ChevronRight size={18} className="text-on-surface-variant" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-8 sm:gap-12 flex-col sm:flex-row">
              <div className="hidden sm:block">
                <CalendarMonth
                  month={leftMonth}
                  startDate={tempStart}
                  endDate={tempEnd}
                  hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={handleDayHover}
                  maxDate={maxDate}
                />
              </div>
              <div className="hidden sm:block">
                <CalendarMonth
                  month={rightMonth}
                  startDate={tempStart}
                  endDate={tempEnd}
                  hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={handleDayHover}
                  maxDate={maxDate}
                />
              </div>

              <div className="sm:hidden block">
                {mobilePage === "left" ? (
                  <CalendarMonth
                    month={leftMonth}
                    startDate={tempStart}
                    endDate={tempEnd}
                    hoverDate={hoverDate}
                    onDayClick={handleDayClick}
                    onDayHover={handleDayHover}
                    maxDate={maxDate}
                  />
                ) : (
                  <CalendarMonth
                    month={rightMonth}
                    startDate={tempStart}
                    endDate={tempEnd}
                    hoverDate={hoverDate}
                    onDayClick={handleDayClick}
                    onDayHover={handleDayHover}
                    maxDate={maxDate}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-outline-variant/20">
              <button
                onClick={clearSelection}
                className="text-body-md text-on-surface-variant hover:text-on-surface underline underline-offset-2 transition-colors"
              >
                Wis alles
              </button>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 text-body-md text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-low transition-colors"
                >
                  Annuleer
                </button>
                <button
                  onClick={applySelection}
                  disabled={!tempStart || !tempEnd}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 text-body-md bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  Toepassen
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
