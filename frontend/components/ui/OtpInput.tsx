'use client'
import { useRef, KeyboardEvent, ClipboardEvent } from 'react'

interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  length?: number
}

export default function OtpInput({ value, onChange, disabled = false, length = 6 }: OtpInputProps) {
  const digits  = value.padEnd(length, '').slice(0, length).split('')
  const refs    = useRef<(HTMLInputElement | null)[]>([])

  function focus(idx: number) {
    refs.current[idx]?.focus()
    refs.current[idx]?.select()
  }

  function handleChange(idx: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next  = [...digits]
    next[idx]   = digit
    onChange(next.join(''))
    if (digit && idx < length - 1) focus(idx + 1)
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]
        next[idx]  = ''
        onChange(next.join(''))
      } else if (idx > 0) {
        const next    = [...digits]
        next[idx - 1] = ''
        onChange(next.join(''))
        focus(idx - 1)
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      focus(idx - 1)
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      focus(idx + 1)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text   = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    const next   = text.padEnd(length, '').split('')
    onChange(next.join(''))
    const lastFilled = Math.min(text.length, length - 1)
    focus(lastFilled)
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className="w-11 h-11 text-center text-xl font-bold border border-[var(--border)] rounded-xl bg-[var(--bg-input,var(--bg-card))] text-[var(--text)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
