export type MediaType = 'video' | 'image' | 'page' | 'playlist' | 'profile' | 'file' | 'torrent'
export type DownloadMode = 'single' | 'playlist' | 'profile' | 'batch' | 'search'

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
}

export interface AdvancedOptions {
  maxItems?:       number | null
  subtitles:       boolean
  subtitleLang:    string
  embedThumbnail:  boolean
  embedMetadata:   boolean
  cookies:         string
  proxy:           string
  capture:         boolean
  scheduleMinutes: number | null
  repeatEvery:     '' | 'hourly' | 'daily' | 'weekly'
  startTime:       string
  endTime:         string
}

export const DEFAULT_ADVANCED: AdvancedOptions = {
  maxItems:       null,
  subtitles:      false,
  subtitleLang:   'en',
  embedThumbnail: false,
  embedMetadata:  true,
  cookies:        '',
  proxy:          '',
  capture:        false,
  scheduleMinutes: null,
  repeatEvery:    '',
  startTime:      '',
  endTime:        '',
}

export interface StorageJob {
  job_id:     string
  files:      { name: string; size: number }[]
  total_size: number
  file_count: number
}
