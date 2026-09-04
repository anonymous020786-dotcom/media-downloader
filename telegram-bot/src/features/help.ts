import { Telegraf } from 'telegraf'
import type { BotContext } from '../types.js'
import { config } from '../config.js'

export const HELP = `<b>🎬 MediaDL bot</b>
Send any link (video, image page, playlist, file host, torrent/magnet, HLS stream) and I'll analyze it and offer download options. Files come back here; anything over ${config.maxUploadMb} MB comes back as a link. <b>/menu</b> opens the control panel.

<b>Downloading</b>
/analyze &lt;url&gt; — options card (same as just sending a link)
/best &lt;url&gt; — best quality now, no menu
/audio · /mp3 &lt;url&gt; — extract audio
/info &lt;url&gt; — metadata only
/thumb &lt;url&gt; — just the poster image
/subs &lt;url&gt; [langs] — subtitles only
/gif &lt;url&gt; &lt;start&gt; [end] — make a GIF
/capture &lt;url&gt; [secs] — screen-record MSE/blob streams

<b>Bulk &amp; scheduled</b>
/batch [urls…] — queue many (one per line)
/playlist &lt;url&gt; [count] — playlist / channel / profile
/feed &lt;rss|m3u&gt; — pick items from a feed
/later &lt;minutes&gt; &lt;url&gt; — delayed download
/schedule &lt;hourly|daily|weekly&gt; &lt;url&gt; — recurring
/schedules — manage recurring jobs

<b>Find</b>
/search · /searchvideo · /searchimage · /news
/searchfile &lt;ext&gt; &lt;q&gt; · /torrents &lt;q&gt;

<b>Queue</b>
/jobs — live queue · /cancel [id] — stop
/retry &lt;id&gt; · /files &lt;id&gt; — re-send files · /merge

<b>Config</b>
/settings — quality, format, subtitles, SponsorBlock, proxy, speed limit…
/proxy · /cookies · /status · /sites · /engines · /whoami`

export function registerHelp(bot: Telegraf<BotContext>) {
  bot.help((ctx) => ctx.reply(HELP, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }))
}

export const COMMAND_LIST = [
  { command: 'menu', description: 'Open the control panel' },
  { command: 'analyze', description: 'Analyze a link and show options' },
  { command: 'best', description: 'Download best quality now' },
  { command: 'audio', description: 'Extract audio' },
  { command: 'info', description: 'Show metadata only' },
  { command: 'subs', description: 'Download subtitles only' },
  { command: 'gif', description: 'Make a GIF from a time range' },
  { command: 'batch', description: 'Queue many links' },
  { command: 'playlist', description: 'Download a playlist / channel' },
  { command: 'feed', description: 'Pick items from an RSS / M3U feed' },
  { command: 'later', description: 'Delayed download' },
  { command: 'schedule', description: 'Recurring download' },
  { command: 'search', description: 'Web search' },
  { command: 'searchvideo', description: 'Video search' },
  { command: 'searchimage', description: 'Image search' },
  { command: 'searchfile', description: 'File search by extension' },
  { command: 'torrents', description: 'Torrent search' },
  { command: 'jobs', description: 'Show the download queue' },
  { command: 'cancel', description: 'Stop downloads' },
  { command: 'merge', description: 'Merge audio + video' },
  { command: 'settings', description: 'Download preferences' },
  { command: 'proxy', description: 'Manage proxies / VPNs' },
  { command: 'cookies', description: 'Save per-site login cookies' },
  { command: 'status', description: 'Service status' },
  { command: 'sites', description: 'Supported sites' },
  { command: 'engines', description: 'Engine versions' },
  { command: 'whoami', description: 'Your id and access' },
  { command: 'help', description: 'Full command list' },
]
