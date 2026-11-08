# Deploy — bot-only, on a VPS

Runs the Telegram bot + its backend (python-service + Express) as `systemd`
services. **No web UI.** Tested on Ubuntu 24.04 / 26.04, KVM-4 class.

## Safe on a shared box

`install.sh` is **strictly additive** — it will not touch your firewall, will
not replace an existing Node (needs ≥18; aborts if older rather than upgrading),
refuses to start if ports 8000/4000 are taken, and everything it creates is
namespaced (`mediadl` user, `mediadl-*` units, `/opt/mediadl`, `/run/mediadl`,
services bound to `127.0.0.1`). Anything else running on the VPS keeps running.

Locking the box down is a **separate, deliberate** step — `firewall.sh`, which
shows you what's currently listening and asks before it denies inbound. Run it
only if MediaDL is the only public-facing thing here; otherwise pass your other
ports: `bash firewall.sh 80 443`.

## Why bot-only

The web UI has no authentication and the analyze/download/stream endpoints fetch
arbitrary URLs server-side (SSRF). Exposing it publicly is not safe and can get a
VPS suspended under most hosts' AUP. The bot is gated by `TELEGRAM_ALLOWED_USERS`
and only talks *outbound* to Telegram, so nothing needs to be open.

## Install

The repo is **private**, so first get the code onto the VPS one of these ways:

**A — GitHub token** (quickest). Make a token at
<https://github.com/settings/tokens> with `repo:read` scope, then:
```bash
ssh root@YOUR_VPS_IP
git clone https://TOKEN@github.com/anonymous020786-dotcom/media-downloader.git /opt/mediadl
```

**B — SSH deploy key**:
```bash
ssh root@YOUR_VPS_IP
ssh-keygen -t ed25519 -f ~/.ssh/id_deploy -N ''   # add the .pub at
                                                  # repo → Settings → Deploy keys
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_deploy' git clone \
  git@github.com:anonymous020786-dotcom/media-downloader.git /opt/mediadl
```

Then:
```bash
cd /opt/mediadl/deploy
bash install.sh          # first run creates /opt/mediadl/.env and stops
nano /opt/mediadl/.env   # set TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USERS
bash install.sh          # second run finishes and starts everything
```

Re-run `bash install.sh` any time to pull the latest code and restart. (With
option B, prefix it: `GIT_SSH_COMMAND='ssh -i ~/.ssh/id_deploy' bash install.sh`.)

## .env keys that matter

| key | |
|---|---|
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_ALLOWED_USERS` | comma-separated numeric IDs. Add someone: they message the bot, it replies with their ID, add it, `systemctl restart mediadl-bot`. **No limit on how many.** |
| `TELEGRAM_ADMINS` | optional subset for engine/global actions |
| `TELEGRAM_DELIVERY` | `upload` by default. A datacenter's uplink to Telegram is fast, so uploads work — unlike a home ISP. |

## Files bigger than 50 MB

Telegram's Bot API caps *every* upload at 50 MB. To send bigger files, get an
**API ID + API hash** from <https://my.telegram.org> (that's your Telegram
*account*, not the bot), put them in `.env`:

```
TELEGRAM_API_ID=1234567
TELEGRAM_API_HASH=abcdef...
```

and re-run `install.sh`. It builds a local `telegram-bot-api` server on
`127.0.0.1:8081` (≈15 min compile), points the bot at it, and switches delivery
to `auto` → uploads up to **2 GB**, still zero inbound ports.

## Managing it

```bash
systemctl status  mediadl-bot mediadl-api mediadl-py
journalctl -u mediadl-bot -f        # bot logs
systemctl restart mediadl-bot       # after editing .env
curl -s localhost:4000/health
```

Firewall: not touched by `install.sh`. Run `bash firewall.sh` (optionally with
extra ports) when you're ready to lock the box to SSH-only.

## Uninstall

```bash
systemctl disable --now mediadl-{py,api,bot} telegram-bot-api 2>/dev/null
rm /etc/systemd/system/mediadl-*.service /etc/systemd/system/telegram-bot-api.service
systemctl daemon-reload
userdel mediadl; rm -rf /opt/mediadl
```

## CI/CD — automatic deploys from GitHub

`.github/workflows/deploy.yml` deploys automatically every time CI passes on
`master` (and on demand from the **Actions → Deploy → Run workflow** button).
It SSHes into the server, runs `git pull` + `install.sh`, and fails the run if
`/health` doesn't come up. Works on any VPS, including an AWS EC2 instance.

One-time setup:

1. Make a key pair just for GitHub (on your PC):
   `ssh-keygen -t ed25519 -f gh_deploy -N ''`
2. Put the public key on the server:
   `cat gh_deploy.pub >> /root/.ssh/authorized_keys` (as root on the server)
3. In GitHub → repo **Settings → Secrets and variables → Actions**, add:
   - `VPS_HOST` — server IP / EC2 public DNS or Elastic IP
   - `VPS_SSH_KEY` — the full contents of `gh_deploy` (the private key)
   - optional `VPS_USER` (default `root`; non-root needs passwordless sudo)
     and `VPS_PORT` (default `22`)
4. On EC2, allow inbound SSH (22) in the instance's security group. GitHub's
   runner IPs change, so either allow 0.0.0.0/0 on 22 with key-only auth, or
   keep it locked down and deploy with the manual `install.sh` instead.

The server must already be installed once per the steps above, and must be
able to `git pull` the private repo (token in the remote URL, or the
`/root/.ssh/id_deploy` deploy key — the workflow picks that up automatically).
Until the secrets exist, the Deploy job is skipped with a notice.
