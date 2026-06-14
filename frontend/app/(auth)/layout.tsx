import Image from 'next/image'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4 py-12">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <Image src="/logo.svg" alt="MediaDL" width={36} height={36} className="rounded-xl" />
        <span className="font-black text-2xl text-[var(--text)]">Media<span className="gradient-text">DL</span></span>
      </Link>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
