CREATE DATABASE IF NOT EXISTS mediadl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mediadl;

CREATE TABLE IF NOT EXISTS blog_posts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(300)   NOT NULL,
  slug          VARCHAR(300)   NOT NULL UNIQUE,
  excerpt       TEXT,
  content       LONGTEXT,
  author        VARCHAR(100)   DEFAULT 'MediaDL Team',
  cover_image   VARCHAR(600),
  tags          VARCHAR(500),
  category      VARCHAR(100)   DEFAULT 'General',
  read_minutes  INT            DEFAULT 4,
  published     TINYINT(1)     DEFAULT 1,
  published_at  DATETIME       DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_published (published),
  INDEX idx_category (category),
  FULLTEXT INDEX ft_search (title, excerpt, content)
);

CREATE TABLE IF NOT EXISTS faq_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  question    VARCHAR(500) NOT NULL,
  answer      TEXT         NOT NULL,
  category    VARCHAR(100) DEFAULT 'General',
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category)
);

CREATE TABLE IF NOT EXISTS testimonials (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  role       VARCHAR(150),
  avatar     VARCHAR(500),
  content    TEXT         NOT NULL,
  rating     TINYINT      DEFAULT 5,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  key_name    VARCHAR(100) NOT NULL UNIQUE,
  value       TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Users (Supabase auth UUIDs + app roles) ──────────────────────────────────
-- Roles are owned by this table; Supabase auth owns identity only.
-- super_admin is seeded at backend startup via SUPER_ADMIN_EMAIL env var.
-- No API endpoint can elevate a user to super_admin.
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)  PRIMARY KEY,           -- Supabase auth.users UUID
  email       VARCHAR(200) NOT NULL UNIQUE,
  name        VARCHAR(200),
  avatar_url  VARCHAR(500),
  role        ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user',
  last_sign_in DATETIME    DEFAULT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
);

CREATE TABLE IF NOT EXISTS download_stats (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(36),
  url         TEXT,
  media_type  VARCHAR(50),
  format      VARCHAR(20),
  quality     VARCHAR(20),
  status      VARCHAR(20),
  ip_hash     VARCHAR(64),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(200) NOT NULL,
  subject    VARCHAR(300),
  message    TEXT         NOT NULL,
  status     VARCHAR(20)  DEFAULT 'unread',
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status)
);

-- ── Seed data ────────────────────────────────────────────────────────────────

INSERT INTO faq_items (question, answer, category, sort_order) VALUES
('What websites does MediaDL support?', 'MediaDL supports 1000+ websites via yt-dlp including YouTube, Instagram, TikTok, Twitter/X, Facebook, Reddit, Vimeo, Twitch, SoundCloud, Dailymotion, Pinterest, Tumblr, Flickr, and many more.', 'General', 1),
('Is MediaDL free to use?', 'Yes, MediaDL is completely free. There are no download limits, no account required, and no hidden fees.', 'General', 2),
('Can I download entire playlists?', 'Yes! Use the Playlist mode to download entire YouTube playlists, SoundCloud playlists, or any channel. You can set a limit or download all items.', 'Features', 3),
('What video formats are supported?', 'We support MP4, WebM, MKV, AVI, MOV, MP3, M4A, Opus, and many more. Use the format selector after analyzing a URL.', 'Features', 4),
('Can I download HD and 4K videos?', 'Yes. After analyzing a URL, select your preferred quality — Best, 1080p, 720p, 480p, or any resolution available from the source.', 'Features', 5),
('How do I download from Instagram?', 'Paste any Instagram post, reel, or story URL. MediaDL will analyze it and let you download the video or photo in full quality.', 'Platforms', 6),
('Can I preview images before downloading?', 'Yes! For web pages, click Preview to see all images before selecting which ones to download. You can select/deselect individually or all at once.', 'Features', 7),
('Is my privacy protected?', 'Yes. We do not store your URLs, personal data, or downloaded content. Downloads happen server-side and files are automatically cleaned up.', 'Privacy', 8),
('Can I download HLS / encrypted streams?', 'Yes. MediaDL uses FFmpeg to download HLS (m3u8) streams, including AES-128 encrypted streams. The decryption key is fetched automatically.', 'Technical', 9),
('Do I need to install anything?', 'No. MediaDL is 100% browser-based. No software, no browser extension, no account required.', 'General', 10);

INSERT INTO testimonials (name, role, avatar, content, rating) VALUES
('Alex M.', 'Content Creator', NULL, 'MediaDL is the only downloader that consistently works for all platforms I use. The playlist download feature saved me hours of work.', 5),
('Sarah K.', 'Social Media Manager', NULL, 'I use MediaDL daily to archive content. The bulk download and preview features are game-changers. Nothing else comes close.', 5),
('James R.', 'Video Editor', NULL, 'The quality selection and format conversion work perfectly. Downloaded a 4K playlist of 200 videos overnight without a single failure.', 5),
('Priya S.', 'Researcher', NULL, 'The image scraper is incredibly powerful — fetched 1,400 images from a gallery site in minutes. The preview grid before downloading is brilliant.', 5),
('Tom H.', 'Podcaster', NULL, 'I use MediaDL to download audio from YouTube interviews and SoundCloud tracks. MP3 extraction at 320kbps is flawless.', 5),
('Elena V.', 'Photographer', NULL, 'Migrated my entire Instagram archive using MediaDL. Downloaded 3 years of posts in one session. Absolutely essential tool.', 5);

INSERT INTO site_settings (key_name, value) VALUES
('site_name', 'MediaDL'),
('site_tagline', 'Download Any Video or Image from Any Website'),
('support_email', 'support@mediadl.app'),
('whatsapp_number', '+1234567890'),
('tawk_widget_id', 'YOUR_TAWK_WIDGET_ID'),
('ga_measurement_id', 'G-XXXXXXXXXX'),
('recaptcha_site_key', 'YOUR_RECAPTCHA_SITE_KEY'),
('adsense_client_id', 'ca-pub-XXXXXXXXXX'),
('twitter_url', 'https://twitter.com/mediadl'),
('github_url', 'https://github.com/mediadl'),
('discord_url', 'https://discord.gg/mediadl'),
('youtube_url', 'https://youtube.com/@mediadl'),
('total_downloads', '50000000'),
('total_sites', '1000');

INSERT INTO blog_posts (title, slug, excerpt, content, author, tags) VALUES
('How to Download YouTube Videos in 4K', 'download-youtube-4k', 'Learn how to download YouTube videos in 4K resolution using MediaDL with step-by-step instructions.', '# How to Download YouTube Videos in 4K\n\nMediaDL makes downloading YouTube videos simple...', 'MediaDL Team', 'youtube,4k,tutorial'),
('Download Instagram Reels Without Watermark', 'download-instagram-reels', 'Download Instagram reels, posts, and stories in full quality without any watermark.', '# Download Instagram Reels Without Watermark\n\nInstagram does not allow direct downloads...', 'MediaDL Team', 'instagram,reels,tutorial'),
('How to Download TikTok Videos Without Watermark', 'download-tiktok-no-watermark', 'Use MediaDL to download TikTok videos in HD quality without the TikTok watermark.', '# TikTok Video Downloader\n\nDownloading TikTok videos...', 'MediaDL Team', 'tiktok,watermark,tutorial'),
('Complete Guide to Bulk Image Downloading', 'bulk-image-download-guide', 'Learn how to use MediaDL to scrape and download hundreds of images from any website at once.', '# Bulk Image Download Guide\n\nScraping images from websites...', 'MediaDL Team', 'images,bulk,scraping'),
('Download Entire YouTube Playlists', 'download-youtube-playlist', 'Download entire YouTube playlists with one click using MediaDL playlist mode.', '# YouTube Playlist Downloader\n\nDownloading entire playlists...', 'MediaDL Team', 'youtube,playlist,tutorial'),
('HLS Stream Downloader — Download Any Encrypted Stream', 'hls-stream-download', 'MediaDL can download HLS, DASH, and AES-128 encrypted streams using FFmpeg integration.', '# HLS Stream Downloader\n\nHLS (HTTP Live Streaming)...', 'MediaDL Team', 'hls,stream,technical');
