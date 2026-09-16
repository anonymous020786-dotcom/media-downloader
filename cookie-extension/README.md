# MediaDL Cookie Sync

Exports a site's cookies as `cookies.txt` (the same format as the "Get
cookies.txt LOCALLY" extension) and gets them into your MediaDL Telegram bot
in two clicks — for sites like YouTube that block logged-out / datacenter
requests and need a real session.

## Why not talk to the bot server directly?

The bot's backend deliberately isn't exposed to the internet (see
`deploy/README.md` — it fetches arbitrary URLs server-side, so a public port
is a real risk). This extension works *with* that: it copies the cookie file
to your clipboard and opens the bot chat, so the cookies go in over Telegram
itself — same trust boundary as pasting them in by hand, just without hunting
for a downloaded file.

## Install (Chrome / Edge / Brave / Opera)
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** and select this `cookie-extension/` folder
4. Pin the icon to your toolbar

## Use
1. Open the site you need cookies from (e.g. youtube.com) and make sure
   you're logged in.
2. Click the extension icon. It prefills the domain from the current tab.
3. Click **Copy & Open Telegram** — approves reading that site's cookies,
   copies them as `cookies.txt` text to your clipboard, and opens your bot's
   chat in a new tab.
4. In that chat, send `/cookies add <domain>`, then paste (**Ctrl+V**) as
   your next message.

Prefer a file? **Download cookies.txt instead** saves it to disk like the
original tool, for attaching manually or using with a local yt-dlp install.

Set your bot's username once under **Bot settings** in the popup (defaults to
whatever bot this was built for) — it's remembered after that.

## Privacy

Cookies never leave your machine except to your clipboard and to Telegram
(when you paste them into your own bot chat). Nothing is sent to any third
-party server. Site permission is requested per-domain, only when you use it.
