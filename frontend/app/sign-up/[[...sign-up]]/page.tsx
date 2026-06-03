import type { Metadata } from 'next'
import { SignUp } from '@clerk/nextjs'

export const metadata: Metadata = { title: 'Sign Up', robots: { index: false, follow: false } }

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 py-16">
      <div className="w-full max-w-md flex flex-col items-center">
        <a href="/" className="mb-6 flex items-center gap-2.5">
          <img src="/logo.svg" alt="MediaDL" width={36} height={36} className="rounded-xl" />
          <span className="font-black text-[var(--text)] text-xl">Media<span className="gradient-text">DL</span></span>
        </a>
        <SignUp appearance={{ elements: { rootBox: 'mx-auto', card: 'shadow-2xl' } }} />
      </div>
    </div>
  )
}
