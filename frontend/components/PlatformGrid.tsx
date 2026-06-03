'use client'

interface Platform { name: string; short: string; bg: string; emoji: string; placeholder: string; fmt: string }

const P: Platform[] = [
  { name:'YouTube',    short:'YT',  bg:'bg-red-600/80',          emoji:'▶',  fmt:'mp4', placeholder:'https://youtube.com/watch?v= · /playlist?list= · /@channel' },
  { name:'Instagram',  short:'IG',  bg:'bg-gradient-to-br from-pink-500 to-violet-600', emoji:'📷', fmt:'mp4', placeholder:'https://instagram.com/p/ · /reel/ · /username/' },
  { name:'TikTok',     short:'TK',  bg:'bg-gray-800',            emoji:'♪',  fmt:'mp4', placeholder:'https://tiktok.com/@username/video/ · /@username' },
  { name:'Twitter/X',  short:'X',   bg:'bg-gray-900',            emoji:'𝕏',  fmt:'mp4', placeholder:'https://x.com/username/status/ · /username/media' },
  { name:'Facebook',   short:'FB',  bg:'bg-blue-700/80',         emoji:'f',  fmt:'mp4', placeholder:'https://facebook.com/watch/?v= · /videos/' },
  { name:'Reddit',     short:'RD',  bg:'bg-orange-600/80',       emoji:'👾', fmt:'mp4', placeholder:'https://reddit.com/r/sub/ · /u/user/ · /comments/' },
  { name:'Pinterest',  short:'PT',  bg:'bg-red-700/80',          emoji:'📌', fmt:'jpg', placeholder:'https://pinterest.com/username/ · /pin/' },
  { name:'Vimeo',      short:'VM',  bg:'bg-teal-600/80',         emoji:'🎬', fmt:'mp4', placeholder:'https://vimeo.com/videoid · /channels/ · /album/' },
  { name:'Twitch',     short:'TV',  bg:'bg-purple-700/80',       emoji:'🎮', fmt:'mp4', placeholder:'https://twitch.tv/username · /videos/' },
  { name:'SoundCloud', short:'SC',  bg:'bg-orange-500/80',       emoji:'☁', fmt:'mp3', placeholder:'https://soundcloud.com/artist · /artist/track' },
  { name:'Dailymotion',short:'DM',  bg:'bg-blue-600/80',         emoji:'▶',  fmt:'mp4', placeholder:'https://dailymotion.com/video/' },
  { name:'Tumblr',     short:'TB',  bg:'bg-indigo-700/80',       emoji:'t',  fmt:'jpg', placeholder:'https://username.tumblr.com/ · /post/' },
  { name:'Flickr',     short:'FL',  bg:'bg-pink-600/80',         emoji:'🌸', fmt:'jpg', placeholder:'https://flickr.com/photos/username/ · /sets/' },
  { name:'Imgur',      short:'IM',  bg:'bg-green-700/80',        emoji:'🖼', fmt:'jpg', placeholder:'https://imgur.com/a/albumid · /gallery/' },
  { name:'Twitch Clip',short:'CLP', bg:'bg-purple-800/80',       emoji:'✂', fmt:'mp4', placeholder:'https://clips.twitch.tv/ClipName' },
  { name:'Any URL',    short:'ANY', bg:'bg-slate-700/80',        emoji:'🌐', fmt:'mp4', placeholder:'Paste any URL — videos, images, streams, pages…' },
]

interface Props { onSelect: (placeholder: string, fmt: string) => void }

export default function PlatformGrid({ onSelect }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[#2d3a4f] uppercase tracking-[0.15em] font-bold">
        Supported platforms
      </p>
      {/* Horizontal scroll on mobile, grid on larger */}
      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-8 sm:overflow-visible sm:pb-0">
        {P.map((p) => (
          <button
            key={p.name}
            onClick={() => onSelect(p.placeholder, p.fmt)}
            title={`${p.name} — click to pre-fill URL`}
            className={`flex-shrink-0 flex flex-col items-center gap-1 w-14 sm:w-auto px-1 py-2.5 rounded-xl
              ${p.bg} opacity-60 hover:opacity-100 active:scale-95
              transition-all duration-150 hover:scale-105 hover:shadow-lg hover:shadow-black/30`}
          >
            <span className="text-base leading-none select-none">{p.emoji}</span>
            <span className="text-[9px] text-white/90 font-bold tracking-wide leading-none">{p.short}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
