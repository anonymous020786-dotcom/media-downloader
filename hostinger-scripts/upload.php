<?php
/**
 * MediaDL — Hostinger image upload endpoint
 * --------------------------------------------------------------------------
 * Place this file on your Hostinger site at:  public_html/api/upload.php
 * The backend POSTs multipart/form-data here with an X-API-Key header.
 *
 * Returns JSON: { "url": "https://yourdomain.com/uploads/avatars/xxx.jpg" }
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
$API_KEY      = getenv('MEDIADL_API_KEY') ?: '2328568639b5fe19f184a96057e80fe93a047871f77f98e439e090d4d317eeca';
$PUBLIC_BASE  = 'https://zestcommerce.in';         // your site root (no trailing slash)
$UPLOAD_DIR   = __DIR__ . '/../uploads';           // public_html/uploads
$MAX_BYTES    = 5 * 1024 * 1024;                   // 5 MB
$ALLOWED_EXT  = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];
$ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
$ALLOWED_DIRS = ['avatars', 'images', 'uploads'];  // folders the API may write to
// ──────────────────────────────────────────────────────────────────────────────

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
  'url'      => $PUBLIC_BASE . '/uploads/' . $folder . '/' . $filename,
  'path'     => 'uploads/' . $folder . '/' . $filename,
  'filename' => $filename,
]);
