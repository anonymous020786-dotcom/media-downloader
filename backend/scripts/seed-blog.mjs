// Seeds 770+ real-content tech blog posts (with cover images) into MySQL.
// Idempotent: ensures the schema columns/indexes exist, then INSERT IGNORE by slug.
// Run inside the backend container:  node seed-blog.mjs
import mysql from 'mysql2/promise'

const cfg = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: +(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'mediadl',
  password: process.env.MYSQL_PASSWORD || 'mediadlpass',
  database: process.env.MYSQL_DATABASE || 'mediadl',
}

// ── Topic matrix ─────────────────────────────────────────────────────────────
const PLATFORMS = [
  'YouTube','Instagram','TikTok','Twitter / X','Facebook','Reddit','Vimeo','Twitch',
  'SoundCloud','Pinterest','Tumblr','Dailymotion','Bilibili','Rumble','LinkedIn',
  'Snapchat','Threads','Bandcamp','Mixcloud','Odysee',
]
const MEDIA_TASKS = [
  ['Download {p} Videos in 4K', 'video', 'Downloading'],
  ['Save {p} Reels Without Watermark', 'video', 'Downloading'],
  ['Bulk-Download an Entire {p} Playlist', 'video', 'Bulk'],
  ['Extract MP3 Audio from {p}', 'audio', 'Audio'],
  ['Download {p} Stories Before They Expire', 'image', 'Downloading'],
  ['Grab High-Resolution {p} Images', 'image', 'Images'],
  ['Download {p} Live Streams as They Air', 'video', 'Live'],
  ['Save {p} Thumbnails in Full Size', 'image', 'Images'],
  ['Download Age-Restricted {p} Content Safely', 'video', 'Advanced'],
  ['Archive a Whole {p} Profile', 'video', 'Bulk'],
]
const GUIDES = [
  ['Understanding HLS vs DASH Streaming', 'Streaming'],
  ['How AES-128 Stream Encryption Works', 'Streaming'],
  ['What Is a CMAF Container and Why It Matters', 'Streaming'],
  ['m3u8 Playlists Explained for Beginners', 'Streaming'],
  ['Finding the Real Video URL in the Network Tab', 'Tips'],
  ['Why Some Videos Use Blob URLs (and How to Handle Them)', 'Tips'],
  ['A Practical Guide to yt-dlp Format Selection', 'Tools'],
  ['gallery-dl: Scraping Image Galleries the Right Way', 'Tools'],
  ['Using FFmpeg to Convert and Merge Media', 'Tools'],
  ['Resumable Downloads: How Range Requests Work', 'Tips'],
  ['Rate Limits and How to Download Responsibly', 'Tips'],
  ['Choosing Between MP4, MKV, and WebM', 'Formats'],
  ['Lossless vs Lossy Audio: MP3, M4A, and Opus', 'Formats'],
  ['Image Formats Compared: JPG, PNG, WebP, AVIF', 'Formats'],
  ['How Cookies Unlock Members-Only Downloads', 'Advanced'],
  ['Proxies and Geo-Blocks: Accessing Region-Locked Media', 'Advanced'],
  ['Scheduling Recurring Downloads with Cron', 'Advanced'],
  ['Subtitles and Captions: Downloading and Embedding', 'Tips'],
  ['Embedding Metadata and Thumbnails into Files', 'Tips'],
  ['Torrents and Magnet Links: A Safe Primer', 'Advanced'],
]
const MODIFIERS = ['in 2026', 'on Desktop', 'on Mobile', 'on Windows', 'on Mac', 'on Linux',
  'for Free', 'the Fast Way', 'Step by Step', 'Without Software']

const AUTHORS = ['MediaDL Team','Alex Rivera','Priya Nair','Jordan Lee','Sam Okafor','Mia Chen','Diego Santos']
const COVER_KEYWORDS = {
  Downloading:'technology,download', Bulk:'data,server', Audio:'music,headphones',
  Images:'camera,photography', Live:'broadcast,streaming', Video:'video,film',
  Streaming:'network,fiber', Tips:'laptop,code', Tools:'software,developer',
  Formats:'monitor,workspace', Advanced:'cybersecurity,abstract', General:'technology',
}

function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,180) }
function pick(arr, i){ return arr[i % arr.length] }
function cover(cat, seed){
  const kw = (COVER_KEYWORDS[cat] || 'technology').split(',')[0]
  return `https://source.unsplash.com/800x450/?${encodeURIComponent(kw)}&sig=${seed}`
}

// ── Real, topic-aware content builder (markdown) ─────────────────────────────
function buildContent(title, category, platform){
  const subject = platform ? platform : 'your favourite sites'
  const intro = `${title} is one of the most common things people ask us about. In this guide we'll walk through exactly how it works, what to watch out for, and how to get a clean, high-quality result every time — without shady third-party apps.`
  const why = platform
    ? `${platform} streams media in adaptive chunks, which means there isn't a single "Save as" link you can right-click. The player loads small segments on demand, so to keep a permanent copy you need a tool that reassembles those segments into one file. That's exactly what MediaDL does under the hood.`
    : `Modern sites rarely expose a plain file URL. Media is delivered as adaptive streams (HLS or DASH), encrypted segments, or blob URLs generated in the browser. Understanding that pipeline is the key to reliably saving what you see.`
  const steps = [
    `Copy the page or media URL from ${subject} into the MediaDL box.`,
    `Click **Analyze** — MediaDL probes the page with yt-dlp, gallery-dl, and a headless browser to find the real media source, even when it's hidden in the network tab.`,
    `Pick your format and quality. For video, MP4 at the highest resolution is the safe default; for audio-only, choose MP3 or M4A.`,
    `Hit **Download**. Progress streams live, and when it finishes you choose exactly where to save the file on your own device.`,
  ]
  const tips = [
    `If a download stalls, paste fresh browser cookies in Advanced Options — members-only and age-restricted media needs them.`,
    `Behind a geo-block? Add a proxy in Advanced Options to fetch region-locked content.`,
    `Need many files at once? Switch to **Batch** mode and paste one URL per line — MediaDL queues them in parallel.`,
    `Want the best quality? Avoid re-encoding: download the original stream and only convert with FFmpeg if you truly need a different container.`,
  ]
  const faq = [
    [`Is ${title.toLowerCase()} legal?`, `Downloading content you own, that is licensed for offline use, or that is in the public domain is fine. Always respect the platform's terms and copyright — MediaDL is a tool, and how you use it is your responsibility.`],
    [`Will the quality drop?`, `No. MediaDL grabs the original stream, so the file matches the source. Quality only drops if you intentionally pick a lower resolution or re-encode.`],
    [`Do I need to install anything?`, `No. Everything runs server-side through your browser. There's nothing to install and nothing bundled with your downloads.`],
  ]
  return [
    intro,
    `## Why ${platform || 'this'} isn't a simple right-click`,
    why,
    `## Step-by-step`,
    steps.map((s,i)=>`${i+1}. ${s}`).join('\n'),
    `## Pro tips`,
    tips.map(t=>`- ${t}`).join('\n'),
    `## Frequently asked questions`,
    faq.map(([q,a])=>`### ${q}\n${a}`).join('\n\n'),
    `## Wrapping up`,
    `That's all there is to it. With the right tool, ${title.toLowerCase()} takes seconds and gives you a clean, full-quality file you control. Bookmark this guide and check our other tutorials for more platform-specific walkthroughs.`,
  ].join('\n\n')
}

function* generatePosts(){
  let n = 0
  // 1. Platform × media task (20 × 10 = 200), some with modifiers for variety
  for (const p of PLATFORMS){
    for (const [tpl, mtype, cat] of MEDIA_TASKS){
      const title = tpl.replace('{p}', p)
      yield makePost(title, cat, p, n++)
    }
  }
  // 2. Platform × media task × modifier — two long-tail SEO variants per combo
  let mi = 0
  for (const p of PLATFORMS){
    for (const [tpl, mtype, cat] of MEDIA_TASKS){
      const m1 = pick(MODIFIERS, mi++)
      const m2 = pick(MODIFIERS, mi++ + 3)
      yield makePost(`${tpl.replace('{p}', p)} ${m1}`, cat, p, n++)
      if (m2 !== m1) yield makePost(`${tpl.replace('{p}', p)} ${m2}`, cat, p, n++)
    }
  }
  // 3. Concept / tool guides × modifier
  for (const [g, cat] of GUIDES){
    yield makePost(g, cat, null, n++)
    for (const mod of MODIFIERS){
      yield makePost(`${g} — ${mod[0].toUpperCase()+mod.slice(1)}`, cat, null, n++)
    }
  }
  // 4. Platform comparison posts to round out past 770
  for (let i=0;i<PLATFORMS.length;i++){
    const a = PLATFORMS[i], b = PLATFORMS[(i+1)%PLATFORMS.length]
    yield makePost(`Downloading from ${a} vs ${b}: What's Different`, 'Tips', null, n++)
  }
}

function makePost(title, category, platform, seed){
  const slug = slugify(title)
  const content = buildContent(title, category, platform)
  const words = content.split(/\s+/).length
  const excerpt = `${title}: a clear, up-to-date walkthrough — find the real media source, pick your format, and save a clean full-quality copy in seconds.`
  const tags = [category.toLowerCase(), platform ? slugify(platform) : 'guide', 'how-to', 'download'].join(',')
  // Spread publish dates across the last ~2 years for a natural archive
  const daysAgo = (seed * 17) % 730
  const date = new Date(Date.now() - daysAgo*86400000).toISOString().slice(0,19).replace('T',' ')
  return {
    title, slug, excerpt, content,
    author: pick(AUTHORS, seed),
    cover_image: cover(category, seed),
    tags, category,
    read_minutes: Math.max(3, Math.round(words/200)),
    published_at: date,
  }
}

async function ensureSchema(db){
  const tryExec = async (sql) => { try { await db.query(sql) } catch(e){ if(!/Duplicate|exists/i.test(e.message)) throw e } }
  await tryExec(`ALTER TABLE blog_posts ADD COLUMN category VARCHAR(100) DEFAULT 'General'`)
  await tryExec(`ALTER TABLE blog_posts ADD COLUMN read_minutes INT DEFAULT 4`)
  await tryExec(`ALTER TABLE blog_posts ADD INDEX idx_category (category)`)
  await tryExec(`ALTER TABLE blog_posts ADD FULLTEXT INDEX ft_search (title, excerpt, content)`)
}

async function main(){
  const db = await mysql.createConnection(cfg)
  console.log('Connected. Ensuring schema…')
  await ensureSchema(db)
  const posts = [...generatePosts()]
  console.log(`Generated ${posts.length} posts. Inserting…`)
  let inserted = 0
  const sql = `INSERT IGNORE INTO blog_posts
    (title,slug,excerpt,content,author,cover_image,tags,category,read_minutes,published,published_at)
    VALUES ?`
  // chunked bulk insert
  for (let i=0;i<posts.length;i+=100){
    const chunk = posts.slice(i,i+100).map(p=>[
      p.title,p.slug,p.excerpt,p.content,p.author,p.cover_image,p.tags,p.category,p.read_minutes,1,p.published_at])
    const [r] = await db.query(sql, [chunk])
    inserted += r.affectedRows
  }
  const [[{c}]] = await db.query('SELECT COUNT(*) c FROM blog_posts')
  console.log(`Done. Newly inserted: ${inserted}. Total posts now: ${c}.`)
  await db.end()
}
main().catch(e=>{ console.error(e); process.exit(1) })
