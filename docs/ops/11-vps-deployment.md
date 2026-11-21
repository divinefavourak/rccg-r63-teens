# 11 — Running the API on a VPS

Since November 2026 the API runs on one VPS (`162.35.99.77`, Ubuntu) under
Docker Compose, in place of Render and Neon. The website
(`www.thefaithtribe.live`) and the web app (`app.thefaithtribe.live`) stay on
Vercel, and uploaded files stay on Cloudflare R2. Nothing that calls the API
changes: every client already uses `https://api.thefaithtribe.live/api/v1`.

```
                      ┌────────────────────── VPS ───────────────────────┐
 api.thefaithtribe ──▶│ caddy :443 ──▶ web (gunicorn) ──┬──▶ db (Postgres 17)
                      │                                 └──▶ redis ◀── worker (+ beat)
                      └──────────────────────────────────────────────────┘
```

| Service | What it is |
|---|---|
| `caddy` | HTTPS. Gets and renews its own certificates. The only service with ports open (80, 443). |
| `web` | gunicorn, 2 workers × 4 threads. |
| `worker` | Celery worker, queues `default` and `celery`, with beat inside it (`-B`): the schedule in `backend/backend/celery.py`. One process to save memory on a 1.6 GB server, so **never scale it past 1**: each copy would send every scheduled task again. |
| `db` | Postgres 17. Data in the `db-data` volume. |
| `redis` | Cache (db 0) and Celery queue (db 1). |

Files: `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/.env.example`,
`deploy/backup.sh`, `backend/Dockerfile`, `backend/release.sh`. The repository
is checked out at `/srv/faithtribe`. Every command below runs there, with:

```bash
cd /srv/faithtribe
alias dc='docker compose -f deploy/docker-compose.yml'
```

---

## Deploying a change

```bash
git pull
dc build
dc run --rm web ./release.sh     # migrate + the post-deploy commands
dc up -d                         # replaces only containers whose image changed
dc ps                            # all running, web healthy
```

`release.sh` does what `build.sh` did on Render, minus installing packages and
collecting static files (the image does both). It prints the email self-test
at the end.

While `web` is recreated (about 10 seconds), Caddy holds incoming requests and
retries them rather than failing them (`lb_try_duration` in the Caddyfile), so
a deploy makes the app pause, not error.

**If the pull changed `deploy/Caddyfile`**, `dc up -d` does not pick it up: the
file is mounted on its own, and `git pull` replaces it with a new file the
running container cannot see. Recreate Caddy (its certificates are kept in the
`caddy-data` volume, so none are fetched again):

```bash
dc up -d --force-recreate caddy
dc exec caddy cat /etc/caddy/Caddyfile   # shows the new version
```

## Logs

```bash
dc logs -f web            # requests and errors
dc logs -f worker         # scheduled tasks: "Sending due task" / "succeeded"
dc logs --since 1h caddy  # HTTPS and certificates
```

Logs are capped at 3 × 10 MB per container. A deploy recreates `web` and
`worker`, which empties their logs: read them before redeploying.

```bash
dc logs --since 30m web | grep -iE "error|traceback" -A 15   # errors with the stack
dc logs --since 24h worker | grep -iE "failed|error"         # tasks that failed
tail /var/log/faithtribe-backup.log                          # last night's backup
```

## Disk space

The app itself (code, database volume, backups) is under 300 MB. The rest of
the 39 GB disk is Ubuntu, snaps from the remote desktop, Docker images and two
swap files (`/swapfile` 2 GB, `/home/swapfile` 512 MB; both are used, keep them).

The system journal is capped at 200 MB
(`/etc/systemd/journald.conf.d/size.conf`, set 2026-11-21). Before that it had
grown to 2.7 GB, almost all of it failed SSH logins.

Every `dc build` adds to Docker's build cache and nothing removes it. When the
disk passes about 70%:

```bash
df -h /
docker system df                  # look at "Build Cache"
docker builder prune -f           # safe: running images are untouched
snap list --all | awk '/disabled/{print $1, $3}' \
  | while read n r; do snap remove "$n" --revision="$r"; done   # old snap copies
```

On 2026-11-21 this took the disk from 57% to 47%.

## SSH and fail2ban

Bots try root passwords all day: 22,351 failures on 2026-11-20. Password
logins are left on deliberately, so the user can sign in from anywhere, and
`fail2ban` (installed 2026-11-21) bans the guessers. The rules live in
`/etc/fail2ban/jail.d/faithtribe.local`: 5 failures in 10 minutes means a
1-hour ban, which doubles for each repeat, up to 1 week.

```bash
fail2ban-client status sshd                   # failures and banned addresses
fail2ban-client set sshd unbanip 1.2.3.4      # let an address back in
```

Mistyping the password 5 times bans your own address too. Wait an hour,
connect from another network, or use the provider's web console, which
fail2ban does not touch, and unban yourself there.

Turning password logins off (keys only) would stop the attempts completely:

```bash
printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' \
  > /etc/ssh/sshd_config.d/10-keys-only.conf
sshd -t && systemctl reload ssh
```

This has not been done. Only do it once every place you log in from has a key.

---

## Setting up a new server

1. **Base system.** Ubuntu 22.04 or 24.04, 2 GB RAM at least, root SSH by key.

   ```bash
   apt update && apt -y upgrade
   curl -fsSL https://get.docker.com | sh
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
   # With under 4 GB RAM, add swap:
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

   Port 22 is allowed before the firewall goes on, or the session is cut off.

2. **Code and settings.**

   ```bash
   git clone https://github.com/divinefavourak/rccg-r63-teens.git /srv/faithtribe
   cd /srv/faithtribe
   cp deploy/.env.example deploy/.env && chmod 600 deploy/.env
   nano deploy/.env
   ```

   Read the notes at the top of `.env.example`. Two that bite:
   `SECRET_KEY` must be the one production already uses, or every teen is
   signed out and every reset link dies; and an optional variable with an
   empty value is not the same as an unset one, so leave unused lines
   commented.

3. **DNS.** An A record for the API host pointing at the server, before Caddy
   starts (it needs it to get the certificate).

4. **Database.** Either restore one (next section) or start empty and follow
   [02 — Fresh installation](02-fresh-installation.md).

5. **Start.**

   ```bash
   dc build
   dc up -d db redis
   dc run --rm web ./release.sh
   dc up -d
   ```

6. **Backups.** See [Backups](#backups).

---

## Copying the database from another Postgres (the Neon move)

The dump holds minors' personal data. It stays in `/root` (mode 600), and the
source address goes through an env-file, never the command line.

```bash
umask 077
read -rsp 'Source DATABASE_URL: ' SRC; echo
printf 'PGURL=%s\n' "$SRC" > /root/src.env; unset SRC

# Dump. For Neon use the direct host, not the "-pooler" one: pg_dump through a
# transaction pooler can fail part-way.
docker run --rm --env-file /root/src.env postgres:17-alpine \
  sh -c 'pg_dump --format=custom --no-owner --no-privileges "$PGURL"' \
  > /root/source.dump

# Counts on the source, to compare with after the restore.
docker run --rm --env-file /root/src.env postgres:17-alpine sh -c \
  'psql "$PGURL" -tAc "SELECT count(*) FROM users_user; SELECT count(*) FROM events_eventregistration;"'

# Restore into an empty database (this deletes whatever the VPS database holds).
dc stop web worker
dc exec -T db psql -U faithtribe -d postgres \
  -c 'DROP DATABASE IF EXISTS faithtribe WITH (FORCE);' \
  -c 'CREATE DATABASE faithtribe OWNER faithtribe;'
dc exec -T db pg_restore -U faithtribe -d faithtribe --no-owner --no-privileges --exit-on-error \
  < /root/source.dump

# The same counts here. They must match.
dc exec -T db psql -U faithtribe -d faithtribe -tAc \
  'SELECT count(*) FROM users_user; SELECT count(*) FROM events_eventregistration;'

rm /root/src.env
```

Then `dc run --rm web ./release.sh` and `dc up -d`.

## The cutover from Render and Neon (November 2026)

**Rehearse first**, while Render still serves real traffic, on
`api-new.thefaithtribe.live` (an A record to the VPS):

- In `deploy/.env`, `CADDY_HOSTS=api-new.thefaithtribe.live`, so Caddy does
  not ask for a certificate for `api` while it still points at Render.
- Copy the database as above, `dc run --rm web ./release.sh`, then
  **`dc up -d web caddy` only. Do not start `worker`:** its beat would run the
  reminder sweep on the copy while Render's timer runs it on Neon, and teens
  would get every notification twice.
- Check the worker boots without running anything on a schedule:
  `dc run --rm worker timeout 30 celery -A backend worker -Q default,celery --concurrency 1 -l info`
  should print `ready.`

When the rehearsal is clean:

1. Disable the cron-job.org timer ([10](10-scheduler-without-a-worker.md)).
2. **Suspend the Render service.** From here Neon gets no writes; anything it
   received after the final dump would be lost.
3. Run the copy above again (the final dump), and check the counts match.
4. `dc run --rm web ./release.sh` and `dc up -d` (now including `worker`).
5. At the DNS host, replace the `api` CNAME to Render with an **A record to
   `162.35.99.77`**. (Lower its TTL to 300 a few hours before.)
6. Once `nslookup api.thefaithtribe.live` shows the VPS, set
   `CADDY_HOSTS=api.thefaithtribe.live, api-new.thefaithtribe.live` in
   `deploy/.env` and `dc up -d caddy`. Caddy fetches the certificate within a
   few seconds; then open `https://api.thefaithtribe.live/api/v1/` and run the
   checks below.

Nothing else needs editing: the Squad webhook, the Google OAuth redirect, the
Vercel settings and the `/p/:code` rewrite all name `api.thefaithtribe.live`.
If the Brevo API key has "authorised IPs" switched on, add the VPS address.

**Rollback, first hour only:** point `api` back at the Render CNAME and resume
Render. Anything written on the VPS since the cutover is lost, because Neon
only has what was there before the final dump. After that, fix forward.

**After a week** with no problems: delete the Render service, the cron-job.org
job and the Neon project, remove `api-new` from DNS, and delete the
`CADDY_HOSTS` line from `deploy/.env` (it defaults to `api.thefaithtribe.live`).

### Checks

```bash
dc exec web python manage.py verify_deployment --strict
dc logs --since 10m worker | grep -E 'dispatch_habit_ladder.*succeeded'
```

The second shows the worker collecting the 5-minute reminder sweep, which
proves beat and the worker agree on the queue. Then, in the browser: sign in
on the website and the web app (email and Google), today's devotional, the
Console, an event page, an image from R2, and the app's "Send me a test
notification".

---

## Backups

`deploy/backup.sh` dumps the database every night to `/var/backups/faithtribe`
(root only), checks the dump can be read, and keeps 14 days.

```bash
chmod +x /srv/faithtribe/deploy/backup.sh
/srv/faithtribe/deploy/backup.sh                 # once by hand: it must print "wrote …"
( crontab -l 2>/dev/null; echo '30 2 * * * /srv/faithtribe/deploy/backup.sh >> /var/log/faithtribe-backup.log 2>&1' ) | crontab -
```

**A backup that lives only on this server is lost with it.** Copy each one off
the server to the private R2 bucket with rclone:

```bash
apt -y install rclone
rclone config   # new remote "r2": type s3, provider Cloudflare, the R2 keys,
                # endpoint https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
# then add RCLONE_REMOTE=r2:<private bucket>/db-backups before the script in the cron line
```

Use the private bucket (`R2_PRIVATE_BUCKET_NAME`), never the public one.

### Restoring a backup

```bash
dc stop web worker
dc exec -T db psql -U faithtribe -d postgres \
  -c 'DROP DATABASE IF EXISTS faithtribe WITH (FORCE);' \
  -c 'CREATE DATABASE faithtribe OWNER faithtribe;'
dc exec -T db pg_restore -U faithtribe -d faithtribe --no-owner --no-privileges --exit-on-error \
  < /var/backups/faithtribe/faithtribe-YYYYMMDD-HHMM.dump
dc up -d
```

Read [08 — Rollback](08-rollback.md) first: restoring is the last resort, and
anything written after the dump is gone.
