export type MediaType = 'video' | 'image' | 'page' | 'playlist' | 'profile' | 'file' | 'torrent'

export interface DownloadJob {
  url:            string
  jobId:          string
  mediaType:      MediaType
  format:         string
  quality?:       string
  formatId?:      string   // yt-dlp format_id to pin exact stream (avoids re-analysis)
  title?:         string
  thumbnail?:     string
  addedAt:        number
  userId?:        string   // Clerk user id — used for FCM push notifications
  priority?:      number   // BullMQ priority: 1=high, 5=normal (default), 10=low
  // Advanced options
  maxItems?:      number
  startIndex?:    number
  subtitles?:     boolean
  embedThumbnail?: boolean
  embedMetadata?:  boolean
  cookies?:       string
  proxy?:         string
  capture?:       boolean
  captureSeconds?: number
  startTime?:          string
  endTime?:            string
  subtitleLangs?:      string[]
  sponsorBlock?:       boolean
  splitChapters?:      boolean
  normalizeAudio?:     boolean
  writeThumbnail?:     boolean
  outputTemplate?:     string
  speedLimit?:         string
  concurrentFragments?: number
  webhookUrl?:         string   // POST to this URL when job completes or fails
}

export interface JobProgress {
  status:          'queued'|'starting'|'downloading'|'scraping'|'converting'|'processing'|'completed'|'failed'
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
}

export interface JobView extends DownloadJob {
  bullId:   string
  progress: JobProgress
}
