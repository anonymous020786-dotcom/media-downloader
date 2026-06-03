import type { Metadata } from 'next'
import { UserSearch } from 'lucide-react'
import PeopleSearch from '@/components/social/PeopleSearch'

export const metadata: Metadata = {
  title: 'Find People & Download Their Public Media',
  description: 'Search for anyone by handle or name across Instagram, TikTok, X, YouTube, Reddit and more — preview and download their public posts, images, and videos with MediaDL.',
  alternates: { canonical: '/people' },
}

export default function PeoplePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-2)] mb-4">
          <UserSearch size={12} className="text-[var(--brand)]" /> Social People Search
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[var(--text)] mb-4">
          Find <span className="gradient-text">Anyone</span>, Download Their Media
        </h1>
        <p className="text-lg text-[var(--text-2)] max-w-2xl mx-auto">
          Search a username or full name and discover their profiles across 14 platforms — then preview and download their public posts, images, and videos.
        </p>
      </div>
      <PeopleSearch />
    </div>
  )
}
