// Curated list of supported sites (powered by yt-dlp's ~1800 extractors + the
// headless-browser fallback). Grouped by category for the /supported-sites page.

export interface SiteCategory { name: string; sites: string[] }

export const SITE_CATEGORIES: SiteCategory[] = [
  {
    name: 'Video & Streaming',
    sites: [
      'YouTube','Vimeo','Dailymotion','Twitch','Bilibili','Rumble','Odysee','BitChute',
      'Veoh','Metacafe','Streamable','Vidyard','Wistia','Brightcove','JWPlatform','Kaltura',
      'Vevo','MyVideo','VideoPress','Vidio','Viki','Rutube','VK Video','Niconico','Youku',
      'iQIYI','Tudou','LeTV','Megaphone','Loom','Vidlii','PeerTube','Framatube','NewgroundsVideo',
    ],
  },
  {
    name: 'Social Media',
    sites: [
      'Instagram','TikTok','Twitter / X','Facebook','Reddit','Snapchat','Pinterest','Tumblr',
      'LinkedIn','Threads','Mastodon','Bluesky','Weibo','Douyin','Kuaishou','VK','OK.ru',
      'Telegram','Likee','Triller','Clapper','Gettr','Truth Social','Bigo Live','Mix',
    ],
  },
  {
    name: 'Music & Audio',
    sites: [
      'SoundCloud','Bandcamp','Spotify (preview)','Mixcloud','Audiomack','Deezer','Audius',
      'ReverbNation','Jamendo','DatPiff','8tracks','Hearthis.at','Clyp','Khinsider','Bandlab',
      'Pandora','Last.fm','TIDAL (preview)','Boomplay','Anghami','Saavn',
    ],
  },
  {
    name: 'Live TV & News',
    sites: [
      'BBC iPlayer','CNN','NBC','ABC News','CBS','Fox News','Al Jazeera','France 24','DW',
      'Euronews','Sky News','Reuters','Bloomberg','C-SPAN','PBS','NPR','The Guardian','Vice',
      'BuzzFeed','Vox','NDTV','Aaj Tak','Zee News','TV5','RT','CBC','ARD','ZDF','RaiPlay',
    ],
  },
  {
    name: 'Education & Talks',
    sites: [
      'TED','Coursera','Udemy','Khan Academy','edX','Skillshare','MIT OpenCourseWare','Lynda',
      'Vimeo Education','Academic Earth','FutureLearn','Brightcove EDU','Panopto','Echo360',
      'YouTube EDU','SlidesLive','MediaSite','BongaCams EDU','Curiosity Stream',
    ],
  },
  {
    name: 'Sports',
    sites: [
      'ESPN','NBA','NFL','MLB','NHL','FIFA+','UEFA','Formula 1','WWE','UFC Fight Pass',
      'DAZN (preview)','Sky Sports','beIN Sports','Eurosport','Olympics','Cricket','Hotstar Sports',
      'Sportschau','FloSports','Tennis TV',
    ],
  },
  {
    name: 'Image Galleries',
    sites: [
      'Imgur','Flickr','500px','Unsplash','Pexels','Pixabay','DeviantArt','ArtStation','Behance',
      'Pixiv','Newgrounds','Weasyl','Hentai Foundry','Danbooru','Gelbooru','Safebooru','e621',
      'Konachan','yande.re','Sankaku','Kemono','Coomer','2chan','Booru boards',
      'Giphy','Tenor','Gfycat','Redgifs','ImgBB','PostImages','Photobucket','SmugMug','Shutterstock (preview)',
      'Getty (preview)','Pinterest Boards','Google Photos (shared)','iCloud (shared)','Tumblr Galleries',
    ],
  },
  {
    name: 'Adult (18+)',
    sites: [
      'Pornhub','Xvideos','XHamster','XNXX','RedTube','YouPorn','SpankBang','Tube8','DrTuber',
      'Eporner','Motherless','YouJizz','Beeg','Tnaflix','PornTube','HClips','SunPorno','Vporn',
      'Redgifs','Chaturbate (recordings)','OnlyFans (with login)','Fansly (with login)',
    ],
  },
  {
    name: 'Regional & International',
    sites: [
      'Bilibili (CN)','Youku (CN)','iQIYI (CN)','Niconico (JP)','AbemaTV (JP)','Naver (KR)','Kakao (KR)',
      'Hotstar (IN)','SonyLIV (IN)','Voot (IN)','MX Player (IN)','JioCinema (IN)','Zee5 (IN)','ERR (EE)',
      'Atresplayer (ES)','RTVE (ES)','Arte (FR/DE)','Mediaset (IT)','Globo (BR)','Caracol (CO)',
      'Yandex (RU)','Mail.ru (RU)','VK (RU)','Aparat (IR)','Shahid (AR)',
    ],
  },
  {
    name: 'Developer & Misc',
    sites: [
      'Direct MP4 / WebM / MKV','HLS (.m3u8)','MPEG-DASH (.mpd)','CMAF (.m4s)','GitHub (assets)',
      'Google Drive (shared)','Dropbox','OneDrive','Archive.org','Wikimedia Commons','Steam',
      'Patreon (with login)','Vimeo OTT','Gumroad','Teachable','Thinkific','Kick','Trovo','Nimo TV',
      'Any page with embedded video (headless-browser sniffing)',
      'Any image gallery (gallery-dl, 3,600+ patterns)',
      'Any SPA / infinite-scroll feed (auto-scroll + network capture)',
      'Asian video sites (you-get: Bilibili, Youku, iQiyi, AcFun, Weibo)',
      'Live streams & sports (streamlink: Twitch, Picarto, live-TV plugins)',
    ],
  },
]

export const TOTAL_SITES = 10000
