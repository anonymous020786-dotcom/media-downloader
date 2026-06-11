export type MediaType = 'video' | 'image' | 'page' | 'playlist' | 'profile' | 'file' | 'torrent'
export type DownloadMode = 'single' | 'playlist' | 'profile' | 'batch' | 'search' | 'feed'

export interface AnalyzeResult {
  type:           MediaType
  title?:         string
  thumbnail?:     string
  duration?:      number
  uploader?:      string
  extractor?:     string
  qualities?:     number[]
  video_formats?: string[]
  image_formats?: string[]
  url?:           string
  filename?:      string
  content_type?:  string
  size?:          number
  is_live?:       boolean
  is_stream?:     boolean
  is_playlist?:   boolean
  playlist_count?: number
}

export interface PlaylistInfo {
  type:        'playlist'
  title:       string
  uploader:    string
  thumbnail?:  string
  item_count:  number
  extractor:   string
  is_channel:  boolean
}

export type JobStatus =
  | 'queued' | 'starting' | 'downloading' | 'scraping'
  | 'converting' | 'processing' | 'completed' | 'failed'

export interface JobProgress {
  status:          JobStatus
  progress:        number
  speed?:          number | null
  eta?:            number | null
  downloaded?:     number | null
  total?:          number | null
  total_files?:    number | null
  completed_files?: number | null
  files?:          string[]
  error?:          string
  filename?:       string
  current_item?:   number | null   // 1-based index of current item in playlist
}

export interface Job {
  bullId:          string
  jobId:           string
  url:             string
  mediaType:       MediaType
  format:          string
  quality?:        string
  title?:          string
  thumbnail?:      string
  addedAt:         number
  progress:        JobProgress
  maxItems?:       number
  subtitles?:      boolean
  embedThumbnail?: boolean
  priority?:       number   // 1=high, 5=normal, 10=low
}

export interface AdvancedOptions {
  // Playlist
  maxItems?:            number | null
  // Subtitles
  subtitles:            boolean
  subtitleLang:         string
  // Output
  embedThumbnail:       boolean
  embedMetadata:        boolean
  writeThumbnail:       boolean        // save thumbnail as separate file
  outputTemplate:       string         // custom yt-dlp outtmpl
  // Post-processing
  sponsorBlock:         boolean        // remove YouTube sponsor/intro/outro segments
  splitChapters:        boolean        // split video into per-chapter files
  normalizeAudio:       boolean        // FFmpeg loudnorm equalisation
  // Network
  speedLimit:           string         // e.g. "5M" = 5 MB/s, empty = unlimited
  concurrentFragments:  number         // 1-16 parallel HLS/DASH fragments
  cookies:              string
  proxy:                string
  capture:              boolean
  // Scheduling
  scheduleMinutes:      number | null
  repeatEvery:          '' | 'hourly' | 'daily' | 'weekly'
  // Clip extraction
  startTime:            string
  endTime:              string
  // Queue priority
  priority:             1 | 5 | 10    // 1=high, 5=normal, 10=low
  // Webhook
  webhookUrl:           string
}

export const DEFAULT_ADVANCED: AdvancedOptions = {
  maxItems:            null,
  subtitles:           false,
  subtitleLang:        'en',
  embedThumbnail:      false,
  embedMetadata:       true,
  writeThumbnail:      false,
  outputTemplate:      '',
  sponsorBlock:        false,
  splitChapters:       false,
  normalizeAudio:      false,
  speedLimit:          '',
  concurrentFragments: 16,
  cookies:             '',
  proxy:               '',
  capture:             false,
  scheduleMinutes:     null,
  repeatEvery:         '',
  startTime:           '',
  endTime:             '',
  priority:            5,
  webhookUrl:          '',
}

// ── RSS / M3U feed types ──────────────────────────────────────────────────────
export interface FeedItem {
  title:          string
  url:            string
  thumbnail?:     string | null
  description?:   string | null
  pub_date?:      string | null
  duration_str?:  string | null
  duration?:      number | null
  group?:         string
  enclosure_type?: string | null
}

export interface FeedResult {
  type:        'rss' | 'atom' | 'm3u'
  feed_title?: string
  feed_url:    string
  count:       number
  items:       FeedItem[]
  _cached?:    boolean
}

// ── Convert job types ─────────────────────────────────────────────────────────
export interface ConvertRequest {
  job_id:         string
  filename:       string
  output_format:  string
  new_job_id?:    string
  video_codec?:   string
  resolution?:    string
  crf?:           number
  fps?:           number
  audio_codec?:   string
  audio_bitrate?: string
  extract_audio?: boolean
  gif_fps?:       number
  gif_scale?:     number
  start_time?:    string
  end_time?:      string
}

export interface StorageJob {
  job_id:     string
  files:      { name: string; size: number }[]
  total_size: number
  file_count: number
}
