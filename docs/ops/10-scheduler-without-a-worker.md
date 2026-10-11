# 10 — Timed tasks without a worker

The timed work — daily reminders, the end-of-day close-out, event reminders,
expiring unpaid registrations, the devotional scrape and its gap alert — is a
Celery beat schedule (`backend/backend/celery.py`). Beat needs a worker and a
beat process running beside the web service. Where the host charges for that
(a Render Background Worker), there is a second way to drive the same schedule
that costs nothing.

## How it works

An outside timer calls one address on the web service every 5 minutes:

```
POST https://api.thefaithtribe.live/api/v1/scheduler/tick/
Authorization: Bearer <SCHEDULER_SECRET>
```

The server works out which entries of the beat schedule came due since the last
call and runs them in the web process. It answers `202` straight away with the
list; the work carries on after the answer.

- A late or skipped call is covered by the next one (up to 3 hours back; 30
  minutes for reminders, since a morning reminder at noon helps nobody).
- If the web service restarts in the middle of the work, the next call does it
  again: a call only counts once its work has finished.
- Every scheduled task already refuses to send the same thing twice, so an
  extra call does no harm.
- The calls also keep a free web service from going to sleep.

## Setting it up

1. **Choose a secret.** Any long random string, for example from
   `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

2. **On the web service, set two environment variables** and redeploy:

   ```bash
   SCHEDULER_SECRET=<the secret>
   CELERY_TASK_ALWAYS_EAGER=true
   ```

   The second makes any task the code hands to the queue run on the spot, since
   no worker will ever collect it.

3. **Create the timer.** Any service that can send a POST with a header on a
   schedule will do. With [cron-job.org](https://cron-job.org) (free):

   - **URL:** `https://api.thefaithtribe.live/api/v1/scheduler/tick/`
   - **Schedule:** every 5 minutes
   - **Advanced → Request method:** `POST`
   - **Advanced → Headers:** `Authorization` = `Bearer <the secret>`

4. **Check it.** The timer's history should show `202` every 5 minutes, and the
   web service log a line like `Scheduler tick ran: {...}` whenever something
   was due. To try it by hand:

   ```bash
   curl -X POST -H "Authorization: Bearer <the secret>" \
     https://api.thefaithtribe.live/api/v1/scheduler/tick/
   ```

   `404` means `SCHEDULER_SECRET` is not set on the server; `403` means the
   header does not match it.

## What this is not

- **Not for a deployment that has a worker and beat.** Run one or the other.
  Both together is harmless (nothing is sent twice) but pointless.
- **Not a queue.** Work runs inside the web process, sharing its memory and
  CPU. That is fine for these tasks at this size. If the scrape or a reminder
  sweep starts to slow requests down, that is the sign to pay for a worker.

## Moving to a real worker later

Start the worker and beat (`celery -A backend worker -B -l info`), remove
`CELERY_TASK_ALWAYS_EAGER`, delete the timer, and clear `SCHEDULER_SECRET`.
The schedule itself does not change: both read `backend/backend/celery.py`.
