# 12 — Media uploads (podcasts and videos)

How a podcast episode or video gets from the Console to storage, what limits it
passes on the way, and what to do when an upload fails.

## The path a file takes

```
Console (MediaUploader)  →  Caddy  →  gunicorn / Django  →  R2 (or local disk)
  POST multipart             body-size       DRF serializer
  /api/v1/media/episodes/    limit           detects duration (mutagen)
```

- The Console sends one `file` field and a `media_type` (`audio` or `video`).
  The serializer stores it as `audio_file` or `video_file` and reads the
  length from the file. Nobody types in a duration.
- Django holds files under `FILE_UPLOAD_MAX_MEMORY_SIZE` (5 MB) in memory and
  writes larger ones to a temporary file, so a big upload does not use much
  memory. `DATA_UPLOAD_MAX_MEMORY_SIZE` (10 MB) counts form fields only, not
  file contents, so it does not limit media.

## The limits

| Layer | Where it's set | Limit |
|---|---|---|
| Caddy, media paths (`/api/v1/media/*`, `/api/media/*`) | `deploy/Caddyfile` | **500MB** |
| Caddy, every other path | `deploy/Caddyfile` | 25MB |
| Payment receipts | `MAX_RECEIPT_SIZE` in `backend/backend/settings.py` | 5 MB |

**Caddy's `MB` is 10^6 bytes; the Console shows sizes in MiB (2^20).** A file
the Console lists as "24.0 MB" is 25.2 million bytes, which is over a `25MB`
Caddy limit. Leave some room when you choose a limit.

### Rough file sizes

| Content | Typical size |
|---|---|
| 30-minute MP3 at 128 kbps | ~28 MB |
| 60-minute MP3 at 128 kbps | ~56 MB |
| 10-minute 1080p video | 150–300 MB |

Videos longer than a few minutes should go on YouTube, and the episode should
link to them with `external_video_id`, not be uploaded here. A file of several
hundred MB over a mobile connection is likely to fail partway through, and
each viewer would then download it from our storage.

## Guidelines for whoever uploads

- **Audio:** export MP3 at 96–128 kbps, mono for speech. A one-hour talk then
  comes to 45–56 MB, not 100 MB+.
- **Video:** upload to YouTube and link it where you can. If you must upload,
  export H.264 MP4 at 720p.
- **Thumbnail:** a 16:9 JPG or PNG, under 1 MB.
- Keep the tab open until the bar reaches 100% and "Processing on the server…"
  finishes. Closing it cancels the upload.
- Save it as **Draft** first, play it back in the Console, then publish.

## Changing the limit

1. Edit the `max_size` under `@media_upload` in `deploy/Caddyfile`. Change the
   25MB block only if every request on the site should get the new limit.
2. Merge and pull on the server, then recreate Caddy. A plain `dc up -d` does
   not pick up a changed Caddyfile (see [11](11-vps-deployment.md)):

   ```bash
   dc up -d --force-recreate caddy
   ```

   ```bash
   dc exec caddy cat /etc/caddy/Caddyfile
   ```

3. If Caddy does not start, `dc logs caddy` shows the config error.
4. Check there is disk space for the temporary file: Django writes it under
   `/tmp` in the `web` container until it is copied to R2.

## When an upload fails

The Console's message tells you which layer stopped it:

| Message | Cause | Fix |
|---|---|---|
| `file: …`, `title: …` or another field name | Django rejected a field (wrong type, missing title) | Correct that field |
| "This file (…) is larger than the server accepts." | A 413 that came back with CORS headers | Make the file smaller, or raise the limit |
| "The upload did not reach the server…" | No response: the connection dropped, **or Caddy rejected the size** (Caddy's 413 has no CORS headers, so the browser reports it as a network error) | Retry on a better connection; if it keeps failing, compare the file size with the Caddy limit |
| "The upload failed. Check the file type and size." | Any other error with no detail | Look at the server logs |

To see what the server did:

```bash
dc logs --since 15m caddy | grep -i "media\|413"
```

```bash
dc logs --since 15m web | grep -i "media/episodes"
```

A `413` in the Caddy log means the body-size limit. A `500` in the `web` log
usually means storage (R2 credentials or bucket) or a file mutagen could not
read.

## History

- **18 November 2026:** a 24 MiB MP3 failed with only the generic message. The
  Caddyfile had one 25MB limit for every request. Media paths now get 500MB,
  and the Console names the cause when a request is rejected or never gets an
  answer.
