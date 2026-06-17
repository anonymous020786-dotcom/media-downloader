<?php
/**
 * MediaDL — Hostinger image upload endpoint  (TEMPLATE / SAMPLE)
 * --------------------------------------------------------------------------
 * Copy this file to `upload.php`, then either:
 *   (a) set the MEDIADL_API_KEY env var on your Hostinger host, or
 *   (b) replace the placeholder below with a long random secret.
 * The same secret must be set as HOSTINGER_API_KEY in the backend .env.
 *
 * Place the real file on your Hostinger site at:  public_html/api/upload.php
 * The backend POSTs multipart/form-data here with an X-API-Key header.
 *
 * Returns JSON: { "url": "https://yourdomain.com/uploads/avatars/xxx.jpg" }
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
$API_KEY      = getenv('MEDIADL_API_KEY') ?: 'REPLACE_WITH_A_LONG_RANDOM_SECRET';
$PUBLIC_BASE  = 'https://your-domain.example/api2'; // URL that serves this script's folder (no trailing slash)
$UPLOAD_DIR   = __DIR__;                            // the api2/ folder — uploads go into api2/<folder>/
$MAX_BYTES    = 5 * 1024 * 1024;                   // 5 MB
$ALLOWED_EXT  = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];
$ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
$ALLOWED_DIRS = ['avatars', 'images', 'uploads'];  // folders the API may write to
// Origins allowed to call this script directly from a browser.
$ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost',
  'https://your-domain.example',
  'https://www.your-domain.example',
];
// ──────────────────────────────────────────────────────────────────────────────

// ── CORS ────────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ALLOWED_ORIGINS, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: X-API-Key, Content-Type');
  header('Access-Control-Max-Age: 86400');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json');

function fail($msg, $code = 400) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
$headers = function_exists('getallheaders') ? getallheaders() : [];
$key = $headers['X-API-Key'] ?? $headers['x-api-key'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? '');
if (!hash_equals($API_KEY, (string) $key)) {
  fail('Unauthorized', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
if (!isset($_FILES['file'])) fail('No file uploaded');

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) fail('Upload error code ' . $file['error']);
if ($file['size'] > $MAX_BYTES) fail('File too large (max 5 MB)');

// ── Validate folder ───────────────────────────────────────────────────────────
$folder = preg_replace('/[^a-z0-9_-]/i', '', $_POST['folder'] ?? 'avatars');
if ($folder === '' || !in_array($folder, $ALLOWED_DIRS, true)) $folder = 'avatars';

// ── Validate type ─────────────────────────────────────────────────────────────
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']);
if (!in_array($mime, $ALLOWED_MIME, true)) fail('Unsupported file type: ' . $mime);

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $ALLOWED_EXT, true)) $ext = 'jpg';

// ── Safe unique filename ──────────────────────────────────────────────────────
$base     = preg_replace('/[^a-z0-9_-]/i', '', pathinfo($file['name'], PATHINFO_FILENAME));
$base     = substr($base, 0, 60) ?: 'img';
$filename = $base . '-' . bin2hex(random_bytes(4)) . '.' . $ext;

$destDir = rtrim($UPLOAD_DIR, '/') . '/' . $folder;
if (!is_dir($destDir) && !mkdir($destDir, 0755, true) && !is_dir($destDir)) {
  fail('Could not create upload directory', 500);
}

$destPath = $destDir . '/' . $filename;
if (!move_uploaded_file($file['tmp_name'], $destPath)) {
  fail('Failed to store file', 500);
}
@chmod($destPath, 0644);

echo json_encode([
  'url'      => $PUBLIC_BASE . '/' . $folder . '/' . $filename,
  'path'     => $folder . '/' . $filename,
  'filename' => $filename,
]);
