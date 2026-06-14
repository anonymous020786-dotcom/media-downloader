# MediaDL — Production Setup Guide

## Step 1 — Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click **New project** → fill in name, database password, region
3. Wait ~2 minutes for it to provision

## Step 2 — Get your Supabase credentials

Go to your project → **Settings → API** and copy:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "Project API keys → anon / public" |
| `SUPABASE_SERVICE_ROLE_KEY` | "Project API keys → service_role" |
| `SUPABASE_JWT_SECRET` | Settings → API → **JWT Settings** → JWT Secret |

## Step 3 — Enable Auth Providers (optional but recommended)

In Supabase → **Authentication → Providers**:

- **Email** — enabled by default. Turn on "Confirm email" for verification.
- **Google** — needs OAuth credentials from Google Cloud Console
- **GitHub** — needs OAuth App credentials from GitHub Developer Settings

For the redirect URL, use: `https://yourdomain.com/auth/callback`

## Step 4 — Fill in .env

Edit `C:\Users\anony\media-downloader\.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret

SUPER_ADMIN_EMAIL=zestcommerce841428@gmail.com

# Change these from defaults for production:
MYSQL_ROOT_PASSWORD=use-openssl-rand-hex-32
MYSQL_PASSWORD=use-openssl-rand-hex-32

# For production, set to your real domain:
ALLOWED_ORIGINS=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## Step 5 — Rebuild and restart

```bash
cd C:\Users\anony\media-downloader
docker compose build --no-cache frontend backend
docker compose up -d
```

## Step 6 — Become super admin

1. Go to http://localhost (or your domain)
2. Sign up with `zestcommerce841428@gmail.com`
3. The backend auto-grants `super_admin` on first login because it matches `SUPER_ADMIN_EMAIL`
4. Go to http://localhost/admin — you'll have full access

## Step 7 — Deploy to VPS (Hetzner / DigitalOcean)

```bash
# On your VPS:
apt update && apt install -y docker.io docker-compose-plugin git
git clone https://github.com/your-username/media-downloader /app
cd /app
cp .env.prod.example .env
nano .env   # fill in all values
docker compose up -d
```

For HTTPS, add a reverse proxy like Caddy or Certbot in front of nginx.

---

## Architecture Summary

| Container | Port | Role |
|---|---|---|
| nginx | 80 | Reverse proxy — public entry point |
| frontend | 3000 | Next.js 16 (App Router) |
| backend | 4000 | Express API + Socket.io |
| python-service | 8000 | yt-dlp downloader (FastAPI) |
| mysql | 3306 | Primary database |
| redis | 6379 | Job queue + cache |
| kafka | 9092 | Event streaming |

Auth flow: **Supabase** issues JWTs → **backend verifies** with `SUPABASE_JWT_SECRET` → roles stored in **MySQL users table**.
