# Testing the app on real phones

What has been tried by hand on real devices, what happened, and how to do it
again. The automated backend tests are listed at the end.

This is a record as well as a guide, so every row carries a result. **"Not yet
run" means exactly that**: the code is written and typechecks, and nobody has
watched it work on a phone.

Last updated 6 October 2026, on branch `feat/mobile-teacher-tools`.

## Summary

| Area | Result |
|---|---|
| Push notifications, two phones | **4 of 4 passed** |
| Check-in at the door, two phones | **1 of 9 passed**, 1 fixed and waiting for a retest, 7 not yet run |
| Keyboard over text fields | Fixed, **not yet retested** |
| Scanner frame animation | Built, **not yet run** |
| The Bible kept on the phone | Built, **not yet run** |
| Remembering between launches | Built, **not yet run** |
| Keeping a whole translation | Built, **not yet run** |
| Backend automated tests | **48 passed**; 4 newer ones not yet run |
| Website deep links (production) | **Passed** after the fix |

## What you need

- **Two Android phones** with the development build installed (see *A build you
  can install, and push notifications* in [`README.md`](README.md)). Expo Go
  cannot receive push, so it will not do.
- **The local backend**, on the local database. Never test sign-up or seeding
  against the real one.
- Both phones and the computer on the same Wi-Fi.

### Start everything

Databases, in the Ubuntu (WSL) window:

```bash
cd /mnt/c/Users/HomePC/Desktop/work/rccg-r63-teens/backend
docker compose up -d
```

Backend, in PowerShell from `backend\` (the folder that holds `manage.py`):

```powershell
$env:DATABASE_URL = 'postgres://faithtribe:faithtribe@localhost:5434/faithtribe'
$env:NOTIFICATIONS_DEVICE_PUSH_BACKEND = 'notifications.push.ExpoPushBackend'
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

Those two `$env:` lines last only for that PowerShell window. Without the
first, every command talks to the production database. Check with
`$env:DATABASE_URL` before running anything that writes.

App, in a second PowerShell window from `mobile\`:

```powershell
npx expo start --dev-client
```

Open **Faith Tribe** (not Expo Go) on each phone and scan the QR code.

### Two accounts

Do not use the sign-up screen: `.env` holds the real mail key, so it would send
real e-mail.

```powershell
# A leader. A superuser passes every permission check.
.\venv\Scripts\python.exe manage.py createsuperuser

# A teen, with no permissions.
.\venv\Scripts\python.exe manage.py shell -c "from django.contrib.auth import get_user_model; U = get_user_model(); u = U.objects.create_user(username='tolu', email='tolu@example.com', password='testpass123', first_name='Tolu', last_name='Adeyemi'); print('made', u.email)"
```

In the tables below, **phone A** is signed in as the teen and **phone B** as
the leader.

---

## 1. Push notifications

Run on 6 October 2026 with two Android phones. On each phone, turn push on
first: **Me → Settings → What you hear about → Turn on**.

To send a push to one account (replace the e-mail):

```powershell
.\venv\Scripts\python.exe manage.py shell -c "from django.contrib.auth import get_user_model; from notifications import services; from notifications.models import NotificationType as T; u = get_user_model().objects.get(email='tolu@example.com'); n = services.send(u, T.TRANSACTIONAL, 'It works', 'Push from the Faith Tribe server.', deep_link='/notifications'); print('pushed at:', n.pushed_at, '| held back because:', n.data.get('suppressed'))"
```

`TRANSACTIONAL` is used because it is the one type quiet hours (21:30 to 06:00)
do not hold back, so the test works at any time of day.

| # | Test | How | Expected | Result |
|---|---|---|---|---|
| 1.1 | Push reaches the right person | Different accounts on A and B. Send to one e-mail | Only that phone buzzes | **Passed** |
| 1.2 | One account on two phones | Same account on A and B, push on for both. Send once | Both phones buzz | **Passed** |
| 1.3 | Signing out silences a phone | As 1.2, then sign out on A. Send again | Only B buzzes | **Passed** |
| 1.4 | A teen has no teacher tools | Open **Me** on each phone | The **Teacher tools** card is on B and absent on A | **Passed** |

1.3 is the shared-family-phone case: a phone handed to a sibling must stop
receiving the first teen's reminders.

Not yet tried:

| # | Test | Expected | Result |
|---|---|---|---|
| 1.5 | Tap a notification with the app closed | The app opens on the screen the message is about, and the message is marked read | Not yet run |
| 1.6 | A reminder inside quiet hours | No buzz; the message is in the inbox, with `quiet_hours` recorded as the reason | Not yet run |
| 1.7 | Refuse the phone's permission question | The card changes to "Notifications are off" with a **Settings** button | Not yet run |
| 1.8 | An iPhone | Same as 1.1 | Not yet run (needs an iOS build) |

---

## 2. Check-in at the door

### Seed an event and its tickets

```powershell
.\venv\Scripts\python.exe manage.py seed_checkin_demo --email tolu@example.com
```

This makes **Teens Hangout 2026** (on right now, ₦2,000) and **Youth Praise
Night** (a month away), with six tickets: one for each result a scan can have.
It prints the ticket numbers. It refuses to run against any database that is
not on this computer.

To run the table a second time, put the tickets back to unscanned:

```powershell
.\venv\Scripts\python.exe manage.py seed_checkin_demo --email tolu@example.com --reset
```

### The tests

**Phone A:** **Me → My tickets**. Two tickets, each with a QR code.
**Phone B:** **Me → Open teacher tools → Check in**, and allow the camera.

Chidi, Dayo, Zainab and Amaka have no accounts, so there is no phone to show
their QR code. Reach them with **Search name or ticket number**, which is also
the real-life case of a teen whose phone is dead.

| # | On phone B | Expected | Result |
|---|---|---|---|
| 2.1 | Scan A's **Teens Hangout** QR | Green **Checked in**, "Welcome, Tolu!", the counter goes up by one | **Passed** |
| 2.2 | (watch phone A during 2.1) | Within about 5 seconds the open ticket shows **You're in**, and a "You're checked in" notification arrives | **Failed, then fixed. Needs a retest** |
| 2.3 | Scan the same QR again | Amber **Already checked in**, with the time and the leader's name. The counter does not move. No second notification on A | Not yet run |
| 2.4 | Scan A's **Youth Praise Night** QR | Blue **Different event**, naming Youth Praise Night | Not yet run |
| 2.5 | Search "Chidi" | Amber **Not paid yet**, mentioning ₦2,000 | Not yet run |
| 2.6 | Search "Dayo" | Violet **Registration cancelled** and refunded | Not yet run |
| 2.7 | Search "Zainab" | Amber **On the waiting list** | Not yet run |
| 2.8 | Search "Amaka" | Green **Checked in** | Not yet run |
| 2.9 | Scan any QR code that is not a ticket | Pink **Ticket not found**, offering **Search by name** | Not yet run |

About 2.2: the first time, A's ticket stayed on its QR code after a successful
scan. Two things were missing. The server sent the teen nothing, and the ticket
screen loaded once and never looked again. Now a scan sends a notification, and
an open ticket asks the server every five seconds while its event is on. The
second half works without push permission.

Not yet tried:

| # | Test | Expected | Result |
|---|---|---|---|
| 2.10 | **Offline.** Airplane mode on B, then scan a fresh ticket | Lime **Saved**, and an amber "1 scan queued" banner | Not yet run |
| 2.11 | Turn airplane mode off again | Within about 20 seconds the banner clears and the counter updates | Not yet run |
| 2.12 | Two leaders scan the same ticket at the same moment | One **Checked in**, one **Already checked in**; the counter rises by one, not two | Not yet run (needs a third phone) |
| 2.13 | Refuse the camera permission | The screen explains why and offers **Allow camera**; search still works | Not yet run |
| 2.14 | Open check-in on a day with no event | "No event today" | Not yet run |

---

## 3. Keyboard over text fields

**The fault (seen on 6 October):** on Android the keyboard covered whatever
field was being typed into. The forms left Android to shrink the window by
itself, and with edge-to-edge drawing switched on (`edgeToEdgeEnabled` in
`app.json`) Android no longer does.

**The fix:** one `KeyboardView` in `src/ui/screen.tsx`, used by every form, and
built into the bottom sheet. A sheet with a search box is also kept short
enough to fit above the keyboard.

Nobody has checked the fix on a phone yet. For each row: tap the field and
type. The field, and the button under it, should sit just above the keyboard.

| # | Screen | Field to try | Result |
|---|---|---|---|
| 3.1 | Log in | Password | Not yet run |
| 3.2 | Sign-up | Each step, and the 6-digit code | Not yet run |
| 3.3 | Event → Register | The last field on the form | Not yet run |
| 3.4 | Settings → your profile | "Anything else the team should know" (the bottom one) | Not yet run |
| 3.5 | Settings → Give feedback | The message box | Not yet run |
| 3.6 | Check-in → **Search name or ticket number** | The title and search box stay visible; results sit between them and the keyboard | Not yet run |
| 3.7 | Sign-up phone step → country picker | Same as 3.6 | Not yet run |
| 3.8 | Any form | Drag the page while typing; the keyboard should go away | Not yet run |

Search boxes at the top of a screen (Library, My class, the Bible book picker)
were never covered and were not changed.

---

## 4. The scanner frame

Built on 6 October, not yet seen on a phone.

| # | Test | Expected | Result |
|---|---|---|---|
| 4.1 | Open check-in and point at nothing | The green corners breathe in and out, and a line sweeps up and down | Not yet run |
| 4.2 | Point at a ticket QR | The frame closes on the code and fills with a wash of green, the phone gives one short tick, and the result follows about half a second later | Not yet run |
| 4.3 | Check in by search instead | The frame closes in the middle of the screen while the answer is fetched | Not yet run |
| 4.4 | Tap **Scan next ticket** | The frame opens back to full size and starts breathing again | Not yet run |
| 4.5 | With "Remove animations" switched on in the phone's settings | No breathing and no sweep; the frame simply steps to the code | Not yet run |

One thing to judge by eye in 4.2: whether the frame lands *on* the code. The
camera reports where the code is, but its own notes say the position can be
missing or partial. When it is not believable the frame closes on the middle of
the screen instead, which is where a ticket is held anyway.

---

## 4b. The Bible on the phone

Built on 6 October, not yet seen on a phone. A chapter is saved to the device
the first time it is opened, and read from there afterwards.

| # | Test | Expected | Result |
|---|---|---|---|
| 4b.1 | Open a chapter, close the app fully, turn on airplane mode, open the same chapter | It opens at once, with no "offline" message | Not yet run |
| 4b.2 | Still offline, open the book picker | All 66 books are listed | Not yet run |
| 4b.3 | Still offline, tap a verse, then **Share** and **Copy** | Both work. The shared text ends with a link; the copied text does not | Not yet run |
| 4b.4 | Still offline, open a chapter never opened before | The usual "couldn’t load" message, with **Try again** | Not yet run |
| 4b.5 | Online again, switch translation and back | The second visit to each chapter makes no request (watch the backend window) | Not yet run |
| 4b.6 | Type a word in Library search | The backend window shows one group of three requests after typing stops, not one group per letter | Not yet run |

## 4c. Remembering between launches

Built on 6 October, not yet seen on a phone. The app now saves what it loaded
and who is signed in, and reads both back before the first screen draws.

Watch the backend window while doing these: each request is a line there.

| # | Test | Expected | Result |
|---|---|---|---|
| 4c.1 | Use the app, close it fully, open it again within five minutes | Today, Me and Library show at once with no skeletons, and the backend window shows only `/auth/me/` (and anything older than its freshness rule) | Not yet run |
| 4c.2 | Close the app, turn on airplane mode, open it | You are **still signed in**, and the screens you visited before show what they showed. Before this change, opening with no signal signed you out | Not yet run |
| 4c.3 | Sign out, then look at Today and Me | The guest versions, with nothing of the previous account | Not yet run |
| 4c.4 | Sign in as someone else on the same phone | Their data only. Nothing of the first account flashes up | Not yet run |
| 4c.5 | Close and reopen the app five times | The backend window shows no `POST /notifications/devices/` after the first | Not yet run |
| 4c.6 | As a leader, open **My class**, close the app, go offline, open it | My class asks for a connection. A class list is deliberately not kept on the phone | Not yet run |

## 4d. Keeping a whole translation

Built on 6 October, not yet run. Needs the Bible imported on the backend
(`import_bible`, see `docs/ops/03-bible-import.md`).

| # | Test | Expected | Result |
|---|---|---|---|
| 4d.1 | Bible → tap the translation code → **Save to this phone** | "Downloading WEB…", then a bar counting up to 66 books, then "All of WEB is on this phone" | Not yet run |
| 4d.2 | Close the sheet while it is saving, read a chapter, open the sheet again | The count has carried on | Not yet run |
| 4d.3 | Turn on airplane mode while it says "Downloading" | It stops with "That did not finish". **Try again** starts the one download over | Not yet run |
| 4d.4 | When it has finished, go offline and open a book never read before | It opens | Not yet run |
| 4d.5 | The backend window during 4d.1 | **One** request, to `/bible/pack/`. A second phone downloading the same translation is served the same ready-made file | Not yet run |

## 5. Things found along the way

| Found | Cause | State |
|---|---|---|
| A red "Uncaught (in promise) ApiError: Session expired" screen after pointing the app at a new backend | The app's request code left a failed promise with nothing listening to it. The expired session itself was handled correctly | Fixed in `src/api/client.ts`. An expired session now signs out quietly |
| Tests could not connect, then "password authentication failed" on port 5433 | A PostgreSQL 18 installed on Windows owns port 5433, hiding the Docker test database | Use port 5434. `backend/docker-compose.test.yml` still says 5433 |
| `apt-get update` answered 403 inside WSL | Something on the network blocks plain-HTTP requests to Ubuntu's servers | Switched Ubuntu's package sources to HTTPS |

---

## 6. Backend automated tests

Run from `backend\`. Django builds its own `test_faithtribe` database beside
the local one and removes it afterwards, so the local data is not touched.

```powershell
$env:TEST_DATABASE_URL = 'postgres://faithtribe:faithtribe@localhost:5434/faithtribe'
.\venv\Scripts\python.exe manage.py test notifications.tests.test_devices events.test_checkin identity.tests.test_class --noinput
```

| When | What | Result |
|---|---|---|
| 6 October 2026 | The three new test files: native push, check-in, class roster | **48 passed** in 55 seconds |
| | Four tests added afterwards in `events.test_checkin` (the teen is told when they are checked in) | Not yet run |
| | The rest of `notifications`, `events` and `identity`, whose code this branch also changed | Not yet run |
| | `bible.tests.test_pack` (a whole translation in one download) | Not yet run |
| | `common.test_view_counts` (a view counted once per viewer) | Not yet run |
| | `content`, `media`: their views now count views through the new helper | Not yet run |

To run everything this branch touches:

```powershell
.\venv\Scripts\python.exe manage.py test notifications events identity bible common content media --noinput
```

Expected noise in a passing run: lines such as `Forbidden:` and `Not Found:`
are tests making requests that should be refused, and one `Push failed for
device` traceback is a test that forces a push to fail on purpose.

---

## 7. The website (production)

| When | Test | Result |
|---|---|---|
| 5 October 2026, before the fix | Open `/dashboard`, `/devotionals`, `/privacy` directly | All 404 |
| 5 October 2026, after PR #45 deployed | The same, plus `/admin` | **All 200** |
| | The API address in the new build | `…onrender.com/api/v1`, as intended |
| | Sign in and open the Console at `/admin` | Not yet run |
