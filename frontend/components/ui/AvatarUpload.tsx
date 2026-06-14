'use client'
import { useRef, useState } from 'react'
import { Camera, X, User } from 'lucide-react'

type Size = 'sm' | 'md' | 'lg'

interface AvatarUploadProps {
  value?:    string
  initials?: string
  onChange:  (file: File) => void
  onRemove?: () => void
  size?:     Size
  loading?:  boolean
}

const SIZE_MAP: Record<Size, { px: number; icon: number; camera: number }> = {
  sm: { px: 48,  icon: 20, camera: 14 },
  md: { px: 80,  icon: 28, camera: 16 },
  lg: { px: 120, icon: 40, camera: 20 },
}

export default function AvatarUpload({
  value,
  initials,
  onChange,
  onRemove,
  size    = 'md',
  loading = false,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [hover,   setHover]   = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  const { px, icon, camera } = SIZE_MAP[size]
  const src = preview ?? value

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return }
    setPreview(URL.createObjectURL(file))
    onChange(file)
    e.target.value = ''
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    setPreview(null)
    onRemove?.()
  }

  return (
    <div className="relative inline-block" style={{ width: px, height: px }}>
      <button
        type="button"
        className="relative w-full h-full rounded-full overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
        style={{ width: px, height: px }}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={loading}
        aria-label="Upload avatar"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Avatar" className="w-full h-full object-cover" />
        ) : initials ? (
          <div className="w-full h-full flex items-center justify-center bg-[var(--brand)]/15 text-[var(--brand)] font-bold"
            style={{ fontSize: px * 0.3 }}>
            {initials.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--bg-hover)] text-[var(--text-3)]">
            <User size={icon} />
          </div>
        )}

        {/* Hover overlay */}
        {(hover || loading) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Camera size={camera} className="text-white" />
            }
          </div>
        )}
      </button>

      {/* Remove button */}
      {(src || preview) && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
          aria-label="Remove avatar"
        >
          <X size={10} />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
