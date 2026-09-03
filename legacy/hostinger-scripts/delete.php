<?php
/**
 * MediaDL — Hostinger image delete endpoint
 * --------------------------------------------------------------------------
 * Place at:  public_html/api/delete.php
 * Backend POSTs JSON { "filename": "...", "folder": "avatars" } + X-API-Key.
 *
 * The shared secret is read from the MEDIADL_API_KEY env var (set it on the
 * host, e.g. via .htaccess `SetEnv MEDIADL_API_KEY ...`). Must match upload.php
 * and the backend's HOSTINGER_API_KEY. Never hardcode the secret here.
 */

// ── CONFIG (must match upload.php) ──────────────────────────────────────────────
$API_KEY      = getenv('MEDIADL_API_KEY') ?: '';
$UPLOAD_DIR   = __DIR__ . '/../uploads';
$ALLOWED_DIRS = ['avatars', 'images', 'uploads'];
// ──────────────────────────────────────────────────────────────────────────────

header('Content-Type: application/json');

function fail($msg, $code = 400) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$key = $headers['X-API-Key'] ?? $headers['x-api-key'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? '');
if ($API_KEY === '' || !hash_equals($API_KEY, (string) $key)) fail('Unauthorized', 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);

$body     = json_decode(file_get_contents('php://input'), true) ?: [];
$filename = basename($body['filename'] ?? '');                      // strip any path
$folder   = preg_replace('/[^a-z0-9_-]/i', '', $body['folder'] ?? 'avatars');

if ($filename === '') fail('filename required');
if (!in_array($folder, $ALLOWED_DIRS, true)) $folder = 'avatars';

// Reject traversal attempts
if (strpos($filename, '..') !== false || strpos($filename, '/') !== false) fail('Invalid filename');

$path = rtrim($UPLOAD_DIR, '/') . '/' . $folder . '/' . $filename;
$real = realpath($path);
$root = realpath($UPLOAD_DIR);

// Ensure the resolved path is still inside the uploads dir
if ($real === false || $root === false || strpos($real, $root) !== 0) {
  echo json_encode(['success' => true, 'note' => 'not found']);  // idempotent
  exit;
}

@unlink($real);
echo json_encode(['success' => true]);
