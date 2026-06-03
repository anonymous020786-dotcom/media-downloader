export interface Language { code: string; label: string; flag: string }

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'pt', label: 'Português',  flag: '🇵🇹' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'ar', label: 'العربية',     flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी',       flag: '🇮🇳' },
  { code: 'id', label: 'Indonesia',  flag: '🇮🇩' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', label: 'ไทย',         flag: '🇹🇭' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
]

export type LangCode = string

export interface Dict {
  heroTitle1: string
  heroTitle2: string
  heroSubtitle: string
  ctaDownload: string
  downloadFree: string
  signIn: string
  paste: string
  supportedPlatforms: string
  pasteHint: string
}

// Curated translations for the most visible UI strings.
export const DICT: Record<string, Dict> = {
  en: { heroTitle1: 'Download Any Video or Image', heroTitle2: 'from Any Website', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1,000+ more sites. HD, 4K, 8K. MP4, MP3, WebM. Playlists. Bulk images. Completely free.', ctaDownload: 'Download', downloadFree: 'Download Free', signIn: 'Sign in', paste: 'Paste', supportedPlatforms: 'Download from 1,000+ websites', pasteHint: 'Paste any video or image URL here…' },
  es: { heroTitle1: 'Descarga Cualquier Video o Imagen', heroTitle2: 'de Cualquier Sitio Web', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + más de 1.000 sitios. HD, 4K, 8K. MP4, MP3, WebM. Listas. Imágenes en lote. Totalmente gratis.', ctaDownload: 'Descargar', downloadFree: 'Descargar Gratis', signIn: 'Iniciar sesión', paste: 'Pegar', supportedPlatforms: 'Descarga de más de 1.000 sitios web', pasteHint: 'Pega aquí cualquier URL de video o imagen…' },
  fr: { heroTitle1: 'Téléchargez Toute Vidéo ou Image', heroTitle2: 'depuis N’importe Quel Site', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1 000 sites. HD, 4K, 8K. MP4, MP3, WebM. Playlists. Images en masse. Entièrement gratuit.', ctaDownload: 'Télécharger', downloadFree: 'Télécharger Gratuitement', signIn: 'Se connecter', paste: 'Coller', supportedPlatforms: 'Téléchargez depuis plus de 1 000 sites', pasteHint: 'Collez ici une URL de vidéo ou d’image…' },
  de: { heroTitle1: 'Lade Jedes Video oder Bild', heroTitle2: 'von Jeder Website Herunter', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + über 1.000 Seiten. HD, 4K, 8K. MP4, MP3, WebM. Playlists. Massen-Bilder. Komplett kostenlos.', ctaDownload: 'Herunterladen', downloadFree: 'Kostenlos Laden', signIn: 'Anmelden', paste: 'Einfügen', supportedPlatforms: 'Von über 1.000 Websites herunterladen', pasteHint: 'Füge hier eine Video- oder Bild-URL ein…' },
  pt: { heroTitle1: 'Baixe Qualquer Vídeo ou Imagem', heroTitle2: 'de Qualquer Site', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1.000 sites. HD, 4K, 8K. MP4, MP3, WebM. Playlists. Imagens em massa. Totalmente grátis.', ctaDownload: 'Baixar', downloadFree: 'Baixar Grátis', signIn: 'Entrar', paste: 'Colar', supportedPlatforms: 'Baixe de mais de 1.000 sites', pasteHint: 'Cole aqui qualquer URL de vídeo ou imagem…' },
  it: { heroTitle1: 'Scarica Qualsiasi Video o Immagine', heroTitle2: 'da Qualsiasi Sito', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + oltre 1.000 siti. HD, 4K, 8K. MP4, MP3, WebM. Playlist. Immagini in blocco. Gratis.', ctaDownload: 'Scarica', downloadFree: 'Scarica Gratis', signIn: 'Accedi', paste: 'Incolla', supportedPlatforms: 'Scarica da oltre 1.000 siti', pasteHint: 'Incolla qui un URL di video o immagine…' },
  nl: { heroTitle1: 'Download Elke Video of Afbeelding', heroTitle2: 'van Elke Website', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1.000+ sites. HD, 4K, 8K. MP4, MP3, WebM. Afspeellijsten. Bulk afbeeldingen. Gratis.', ctaDownload: 'Downloaden', downloadFree: 'Gratis Downloaden', signIn: 'Inloggen', paste: 'Plakken', supportedPlatforms: 'Download van 1.000+ websites', pasteHint: 'Plak hier een video- of afbeeldings-URL…' },
  ru: { heroTitle1: 'Скачайте Любое Видео или Фото', heroTitle2: 'с Любого Сайта', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1000 сайтов. HD, 4K, 8K. MP4, MP3, WebM. Плейлисты. Массовая загрузка. Бесплатно.', ctaDownload: 'Скачать', downloadFree: 'Скачать Бесплатно', signIn: 'Войти', paste: 'Вставить', supportedPlatforms: 'Загрузка с более чем 1000 сайтов', pasteHint: 'Вставьте сюда ссылку на видео или фото…' },
  tr: { heroTitle1: 'Herhangi Bir Video veya Resmi', heroTitle2: 'Herhangi Bir Siteden İndir', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1.000’den fazla site. HD, 4K, 8K. MP4, MP3, WebM. Oynatma listeleri. Toplu resim. Ücretsiz.', ctaDownload: 'İndir', downloadFree: 'Ücretsiz İndir', signIn: 'Giriş yap', paste: 'Yapıştır', supportedPlatforms: '1.000’den fazla siteden indirin', pasteHint: 'Buraya bir video veya resim URL’si yapıştırın…' },
  ar: { heroTitle1: 'حمّل أي فيديو أو صورة', heroTitle2: 'من أي موقع', heroSubtitle: 'يوتيوب، إنستغرام، تيك توك، تويتر، فيسبوك + أكثر من 1000 موقع. HD، 4K، 8K. MP4، MP3، WebM. قوائم التشغيل. صور بالجملة. مجاناً تماماً.', ctaDownload: 'تحميل', downloadFree: 'تحميل مجاني', signIn: 'تسجيل الدخول', paste: 'لصق', supportedPlatforms: 'التحميل من أكثر من 1000 موقع', pasteHint: 'الصق هنا أي رابط فيديو أو صورة…' },
  hi: { heroTitle1: 'कोई भी वीडियो या इमेज डाउनलोड करें', heroTitle2: 'किसी भी वेबसाइट से', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1,000+ साइटें। HD, 4K, 8K. MP4, MP3, WebM. प्लेलिस्ट। बल्क इमेज। पूरी तरह मुफ़्त।', ctaDownload: 'डाउनलोड', downloadFree: 'मुफ़्त डाउनलोड', signIn: 'साइन इन', paste: 'पेस्ट', supportedPlatforms: '1,000+ वेबसाइटों से डाउनलोड करें', pasteHint: 'यहाँ कोई भी वीडियो या इमेज URL पेस्ट करें…' },
  id: { heroTitle1: 'Unduh Video atau Gambar Apa Saja', heroTitle2: 'dari Situs Mana Saja', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1.000+ situs. HD, 4K, 8K. MP4, MP3, WebM. Playlist. Gambar massal. Gratis sepenuhnya.', ctaDownload: 'Unduh', downloadFree: 'Unduh Gratis', signIn: 'Masuk', paste: 'Tempel', supportedPlatforms: 'Unduh dari 1.000+ situs web', pasteHint: 'Tempel URL video atau gambar di sini…' },
  vi: { heroTitle1: 'Tải Mọi Video hoặc Hình Ảnh', heroTitle2: 'từ Bất Kỳ Trang Web Nào', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + hơn 1.000 trang. HD, 4K, 8K. MP4, MP3, WebM. Danh sách phát. Ảnh hàng loạt. Hoàn toàn miễn phí.', ctaDownload: 'Tải xuống', downloadFree: 'Tải Miễn Phí', signIn: 'Đăng nhập', paste: 'Dán', supportedPlatforms: 'Tải từ hơn 1.000 trang web', pasteHint: 'Dán URL video hoặc hình ảnh vào đây…' },
  th: { heroTitle1: 'ดาวน์โหลดวิดีโอหรือรูปภาพใดก็ได้', heroTitle2: 'จากเว็บไซต์ใดก็ได้', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + กว่า 1,000 เว็บไซต์ HD, 4K, 8K MP4, MP3, WebM เพลย์ลิสต์ รูปภาพจำนวนมาก ฟรีทั้งหมด', ctaDownload: 'ดาวน์โหลด', downloadFree: 'ดาวน์โหลดฟรี', signIn: 'เข้าสู่ระบบ', paste: 'วาง', supportedPlatforms: 'ดาวน์โหลดจากกว่า 1,000 เว็บไซต์', pasteHint: 'วาง URL วิดีโอหรือรูปภาพที่นี่…' },
  pl: { heroTitle1: 'Pobierz Dowolny Film lub Obraz', heroTitle2: 'z Dowolnej Strony', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + ponad 1000 stron. HD, 4K, 8K. MP4, MP3, WebM. Playlisty. Masowe obrazy. Całkowicie za darmo.', ctaDownload: 'Pobierz', downloadFree: 'Pobierz Za Darmo', signIn: 'Zaloguj się', paste: 'Wklej', supportedPlatforms: 'Pobieraj z ponad 1000 stron', pasteHint: 'Wklej tutaj adres URL filmu lub obrazu…' },
  zh: { heroTitle1: '下载任何视频或图片', heroTitle2: '从任何网站', heroSubtitle: 'YouTube、Instagram、TikTok、Twitter、Facebook + 1000 多个网站。HD、4K、8K。MP4、MP3、WebM。播放列表。批量图片。完全免费。', ctaDownload: '下载', downloadFree: '免费下载', signIn: '登录', paste: '粘贴', supportedPlatforms: '从 1000+ 网站下载', pasteHint: '在此粘贴任何视频或图片链接…' },
  ja: { heroTitle1: 'あらゆる動画や画像をダウンロード', heroTitle2: 'どんなウェブサイトからでも', heroSubtitle: 'YouTube、Instagram、TikTok、Twitter、Facebook + 1,000以上のサイト。HD、4K、8K。MP4、MP3、WebM。プレイリスト。一括画像。完全無料。', ctaDownload: 'ダウンロード', downloadFree: '無料ダウンロード', signIn: 'ログイン', paste: '貼り付け', supportedPlatforms: '1,000以上のサイトからダウンロード', pasteHint: '動画や画像のURLをここに貼り付け…' },
  ko: { heroTitle1: '모든 동영상 또는 이미지 다운로드', heroTitle2: '모든 웹사이트에서', heroSubtitle: 'YouTube, Instagram, TikTok, Twitter, Facebook + 1,000개 이상 사이트. HD, 4K, 8K. MP4, MP3, WebM. 재생목록. 대량 이미지. 완전 무료.', ctaDownload: '다운로드', downloadFree: '무료 다운로드', signIn: '로그인', paste: '붙여넣기', supportedPlatforms: '1,000개 이상 사이트에서 다운로드', pasteHint: '여기에 동영상 또는 이미지 URL 붙여넣기…' },
}

export function t(lang: string, key: keyof Dict): string {
  return (DICT[lang] ?? DICT.en)[key] ?? DICT.en[key]
}

export const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])
