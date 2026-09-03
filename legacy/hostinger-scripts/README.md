# Hostinger PHP Upload API

These two PHP scripts let the MediaDL backend store profile images (and any
other uploads) on your Hostinger hosting via simple HTTP — no FTP needed.

## 1. Pick a strong API key

Generate a long random secret (this is the shared password between your
backend and the PHP scripts):

```bash
openssl rand -hex 32
```

## 2. Edit the two scripts

In **both** `upload.php` and `delete.php`, set the same `$API_KEY`, and in
`upload.php` set `$PUBLIC_BASE` to your real domain:

```php
$API_KEY     = 'paste-the-openssl-secret-here';
$PUBLIC_BASE = 'https://yourdomain.com';   // no trailing slash
```

> Tip: instead of hard-coding, you can set an env var in Hostinger
> (hPanel → Advanced → PHP Configuration / .htaccess `SetEnv MEDIADL_API_KEY ...`)
> and the scripts will read it automatically.

## 3. Upload to your Hostinger site

Using hPanel **File Manager** (or FTP), create this structure under
`public_html`:

```
public_html/
├── api/
│   ├── upload.php
│   └── delete.php
└── uploads/            ← created automatically on first upload, or make it yourself
    └── avatars/
```

Make sure `uploads/` is writable (permissions `755`).

## 4. Tell the backend to use it

In your project root `.env`:

```env
STORAGE_PROVIDER=hostinger
HOSTINGER_UPLOAD_URL=https://yourdomain.com/api/upload.php
HOSTINGER_DELETE_URL=https://yourdomain.com/api/delete.php
HOSTINGER_API_KEY=paste-the-same-openssl-secret-here
```

And in `frontend/.env.local`:

```env
NEXT_PUBLIC_STORAGE_PROVIDER=hostinger
```

Then rebuild + restart the backend:

```bash
docker compose build backend && docker compose up -d backend
```

## 5. Test it

```bash
curl -X POST https://yourdomain.com/api/upload.php \
  -H "X-API-Key: your-secret" \
  -F "folder=avatars" \
  -F "file=@/path/to/test.jpg"
# → {"url":"https://yourdomain.com/uploads/avatars/test-xxxx.jpg", ...}
```

## Security notes

- The scripts validate: API key, real MIME type (not just extension),
  file size (5 MB), extension whitelist, and folder whitelist.
- `delete.php` blocks path traversal (`..`, `/`) and confirms the resolved
  path stays inside `uploads/`.
- Keep the API key secret. Rotate it by changing it in both the PHP scripts
  and your `.env`, then restarting the backend.
- Consider adding `uploads/` to a CDN or setting long cache headers via
  `.htaccess` for performance.
