# Faith Tribe — mobile

The RCCG Region 63 Teens app, built from the *Faith Tribe Design Foundations*
Figma Make export and the specs in [`../docs`](../docs).

## Running it

```bash
cd mobile
npm install
npx expo start
```

Press `a` for Android, `i` for iOS, or scan the QR code with Expo Go.

## Stack, and why

| Piece | Choice | Reason |
|---|---|---|
| Framework | Expo SDK 57 (RN 0.86, New Architecture) | |
| Routing | `expo-router` | File-based, typed routes, real deep links — 05-navigation.md requires a stable shareable URL per entity |
| Styling | NativeWind v4 | Tailwind classes compiled to style objects **at bundle time**; no runtime class parser, no per-render object allocation |
| Theming | CSS custom properties | `global.css` defines the semantic tokens; one root class re-themes the app, exactly as the web design does |
| Animation | Reanimated 4 | Every transition runs on the UI thread — the nav notch, the reader chrome, press feedback |
| Icons | `@expo/vector-icons` (Ionicons) + `react-native-svg` | See below |
| Images | `expo-image` | Disk cache across launches, `recyclingKey` for virtualised lists |
| Lists | `Animated.FlatList` / `FlatList` | Bible chapters reach 176 verses (Psalm 119) |

FlashList was evaluated for the Bible reader and dropped: verse heights change
with the font-size control, so a fixed-estimate list is the wrong tool, and
`FlatList` handles a few hundred text rows without breaking a sweat. One fewer
native dependency to keep in step with the SDK.

### On `react-icons`

`react-icons` renders DOM `<svg>` elements and cannot run in React Native —
there is no DOM, so every icon would render nothing on device. There is no
maintained RN port.

The substitute is a two-part set:

- **Ionicons**, via `@expo/vector-icons` — the ~25 generic glyphs. An icon font
  renders each as one cached text run rather than parsing and rasterising a
  path set per mount. Ionicons rather than Feather because
  `10-design-system.md` requires *filled variants for active nav states*, and
  it is the only bundled family with matched outline/filled pairs (plus the
  ticket and QR glyphs the product needs).
- **`react-native-svg`** — the brand marks no icon font has: the leaf identity,
  the Bible book-cross, the streak flame, the illustrated avatar.

`src/components/Icon.tsx` holds the name map, so changing icon families later
is a change to one table rather than to every screen.

## Bundle size

Two barrel imports were quietly costing several megabytes. Both matter here:
`15-technical-architecture.md` sets performance budgets against Nigerian data
plans and low-end Android hardware.

| Import | Cost | Fix |
|---|---|---|
| `import { Ionicons } from '@expo/vector-icons'` | 18 icon fonts, **~3.5MB** | `import Ionicons from '@expo/vector-icons/Ionicons'` — 390KB |
| `import { X } from '@expo-google-fonts/lora'` | all 8 Lora + 18 Inter faces | import each weight's own subpath, e.g. `@expo-google-fonts/lora/400Regular` |

The rule in both cases: **Metro bundles every asset a module graph can reach.**
A package index that re-exports its whole catalogue drags all of it in, because
`require()`-ing a `.ttf` is a side effect no tree-shaker will drop. Import the
leaf, not the barrel.

Result: the Android export went from **12MB to 6.3MB**, 18 icon fonts down to
one.

One asset remains that nothing here uses: `MaterialSymbols_400Regular.ttf`
(964KB), pulled in by `expo-router` → `expo-symbols` for rendering Android tab
icons from SF Symbol names. `metro.config.js` carries a commented-out resolver
stub that removes it, along with why it is off by default.

Verify with:

```bash
npx expo export --platform android --output-dir /tmp/export-check --clear
```

and check what lands in the asset list.

## Layout

```
app/                      routes (expo-router)
  _layout.tsx             fonts, splash, providers, stack
  (tabs)/
    _layout.tsx           the five destinations
    index.tsx             Today
    bible.tsx             the reader, and its book and chapter picker
    library.tsx           shelves, filters and search
    tribe.tsx             events, notices, my church
    me.tsx                profile, numbers and the way to everything of yours
  (auth)/
    welcome.tsx           first-launch pages
    sign-up.tsx           eight questions on one screen; only the question changes
    verify.tsx            the 6-digit code (sign-up and log in)
    all-set.tsx  log-in.tsx
    forgot-password.tsx   ask for the email, send the reset link
  devotional.tsx          full devotional (modal)
  article/[id].tsx        an article from the Library
  player.tsx              the full audio player (modal)
  watch/[id].tsx          a Library video, played in the app
  event/[id]/             event detail, and the registration form
  events/past.tsx         events that are over
  ticket/[id].tsx         one ticket, with its QR code
  tickets.tsx             every ticket the teen holds
  progress.tsx            streak, this month, totals
  saved.tsx               kept verses, readings and talks
  notifications.tsx       inbox
  settings/               reminders, appearance, profile, feedback
  console/                teacher tools: its own stack and bottom nav
    index.tsx             Teacher home
    lesson.tsx            this week's manual, a part at a time
    class/                the class list, and one teen read-only
    check-in.tsx          the ticket scanner and its result screens
    review.tsx            devotionals waiting to be published
  +not-found.tsx          dead deep links
src/
  api/config.ts           base URL resolution, cache staleness
  api/tokens.ts           JWTs in the Keychain / Keystore
  api/client.ts           fetch + single-flight refresh
  api/types.ts            response shapes, from the Django serialisers
  api/queries.ts          React Query hooks, one per screen concern
  api/queryClient.ts      cache defaults + RN focus/online bridges
  theme/tokens.ts         imperative mirror of global.css + elevation, motion
  theme/ThemeProvider.tsx light/dark, persisted
  state/auth.tsx          who is signed in
  state/chrome.tsx        nav visibility, shared with the reader's scroll
  state/reader.tsx        reader theme, text size and last page, on this phone
  state/player.tsx        the one audio player, held above the navigator
  state/push.ts           push permission, registration and tap routing
  state/teacher.ts        which teacher tools this person's permissions allow
  state/checkinQueue.ts   scans made offline, kept until they can be sent
  data/                   what each screen says about a reading, event or ticket
  ui/                     the Figma kit: Button, inputs, cards, art, Press
  components/             pieces built from the kit for one tab (Bible picker,
                          Library shelves, event rows, the teacher nav)
global.css                semantic colour tokens (light + dark)
tailwind.config.js        tokens -> Tailwind scales
```

## Design source

The look comes from the Figma file *Faith Tribe — Design System & App*. Tokens
in `global.css` and `src/theme/tokens.ts` mirror its Color variables (Light and
Dark); `src/ui/` mirrors its Components page. Fonts are Inter for UI and Lora
for the reader.

`/dev/kit` shows every kit component on one screen, in development builds only.
`npx expo start --web` serves the app in a browser for quick visual checks; the
web target is a preview, not a shipped product.

## Running through a tunnel

`npx expo start --tunnel` carries the JS bundle only. The app normally finds the
API on the machine serving the bundle, and a tunnel hostname cannot reach port
8000, so under a tunnel set the address yourself in `mobile/.env` and restart
Expo:

```
EXPO_PUBLIC_API_URL=http://<your-computer-ip>:8000/api/v1
```

The phone must be on the same Wi-Fi, and Windows Firewall must allow Python on
private networks.

## A build you can install, and push notifications

Expo Go is enough for most screens. It is not enough for two things:

- **Push.** Expo Go on Android has not been able to receive remote push since
  SDK 53.
- **Anything that needs this app's own native setup**, such as its notification
  icon and its camera permission text.

So push, and a proper test of check-in, need a *development build*: this app
with its own native code, which still loads the JavaScript from your computer.

The steps are in the order they depend on each other. Steps 1 to 3 give you an
installable app. Steps 4 to 6 make push work on Android. Step 7 is the server.

### 1. Link the project to Expo (done once)

```powershell
cd mobile
npx eas init
```

This is already done: the project is `@akcodex/faith-tribe`, and its id is in
`app.json` under `extra.eas.projectId`. The app reads that id to ask for a push
token, so do not remove it.

### 2. Build the development app

```powershell
npm install -g eas-cli          # keep the CLI current; old ones fail in odd ways
npx eas build --profile development --platform android
```

Answer **yes** to installing `expo-dev-client` and to generating a keystore.
The build runs on Expo's servers and takes 10 to 20 minutes. It ends with a
link and a QR code for an `.apk`.

If it stops with *"Android app build credentials with name already exists"*:
the keystore was made and the CLI then tried to save it twice. Run the same
command again and it will pick up the credentials that now exist. If it does
it a second time, run `npx eas credentials`, choose Android, and remove the
duplicate entry.

### 3. Install it and start the app

Open the build's link on the phone and install the `.apk` (Android will ask
you to allow installs from the browser). Then, on your computer:

```powershell
npx expo start --dev-client
```

Open **Faith Tribe** on the phone (not Expo Go) and scan the QR code, with the
phone on the same Wi-Fi. Start the backend as described in *Running the
backend* below.

At this point the whole app works, including the check-in camera. Push does
not yet: on Android it needs Firebase.

### 4. Create the Firebase project (Android push)

Expo delivers to Android through Google's Firebase Cloud Messaging, and Google
will only talk to an app it knows about.

1. Go to <https://console.firebase.google.com> and create a project (the name
   is yours to choose; Analytics can be off).
2. In the project, choose **Add app → Android**.
3. For **Android package name** enter exactly `org.rccgregion63.faithtribe`.
   It must match `android.package` in `app.json`.
4. Download **`google-services.json`** and put it in `mobile/`.
5. Tell the app where it is, in `app.json`:

   ```json
   "android": {
     "package": "org.rccgregion63.faithtribe",
     "googleServicesFile": "./google-services.json"
   }
   ```

`google-services.json` identifies the app to Google. It is not a password: the
same values are inside every copy of the installed app. It is still left out of
this repository for now, because the repository is public and the file holds an
API key that scanners will flag. EAS builds pick it up from your folder whether
or not it is committed. The file in the next step is a different matter.

### 5. Give Expo the key to send through Firebase

1. In the Firebase console: **Project settings (the gear) → Service accounts →
   Generate new private key**. A `.json` file downloads.

   **This file is a secret.** It can send notifications to every phone with the
   app. Never commit it and never put it in `mobile/`. Keep it somewhere safe
   and delete the copy in Downloads once it is uploaded.

2. Upload it to Expo:

   ```powershell
   npx eas credentials
   ```

   Choose **Android → development → Google Service Account → Manage your
   Google Service Account Key for Push Notifications (FCM V1) → Set up a
   Google Service Account Key → Upload a new service account key**, and give
   it the path to the file.

   The same upload is available on the web: expo.dev → the project →
   **Credentials → Android → FCM V1 service account key**.

### 6. Build again

`google-services.json` is compiled into the app, so the build from step 2 does
not have it:

```powershell
npx eas build --profile development --platform android
```

Install the new `.apk` over the old one.

### 7. Turn delivery on in the backend

Until this is set the server writes every notification to the in-app inbox and
*logs* the push instead of sending it. From `backend/`:

```powershell
.\venv\Scripts\python.exe manage.py migrate notifications
```

Then add to the backend's `.env` and restart the server:

```
NOTIFICATIONS_DEVICE_PUSH_BACKEND=notifications.push.ExpoPushBackend
```

`EXPO_ACCESS_TOKEN` is only needed if "enhanced security for push" is switched
on for the project at expo.dev; leave it unset otherwise.

Daily reminders are sent by a scheduled job, so they also need the Celery
worker and beat running. A message sent by hand, as below, does not.

### 8. Check that it works

1. In the app, sign in, then go to **Me → Settings → What you hear about** and
   tap **Turn on**. Say yes to the phone's question.
2. Confirm the server knows the phone. From `backend/`:

   ```powershell
   .\venv\Scripts\python.exe manage.py shell -c "from notifications.models import PushDevice; print(list(PushDevice.objects.values_list('user__username', 'platform', 'token', 'is_active')))"
   ```

   One row with your username means registration worked.

3. Send yourself one, replacing `YOUR_USERNAME`:

   ```powershell
   .\venv\Scripts\python.exe manage.py shell -c "from django.contrib.auth import get_user_model; from notifications import services; from notifications.models import NotificationType as T; u = get_user_model().objects.get(username='YOUR_USERNAME'); n = services.send(u, T.TRANSACTIONAL, 'It works', 'Push from the Faith Tribe server.', deep_link='/notifications'); print('pushed at:', n.pushed_at, '| held back because:', n.data.get('suppressed'))"
   ```

   `TRANSACTIONAL` is used on purpose: it is the one type quiet hours
   (21:30 to 06:00) do not hold back, so the test works at night too.

   - `pushed at:` shows a time, and the phone buzzes: done.
   - `held back because: no_subscription`: the phone is not registered. Go
     back to step 8.2.
   - `pushed at: None` with nothing held back: the send failed. The reason is
     in the server log, on a line starting `Push failed for device`.

4. Tap the notification. It should open the inbox, with that message marked
   read.

To test a token without the server at all, paste it into
<https://expo.dev/notifications>.

### iPhone

iOS needs no Firebase. It needs a paid Apple Developer account:

```powershell
npx eas build --profile development --platform ios
```

EAS asks to sign in to Apple and offers to create the push key itself; say
yes. Installing a development build on an iPhone also means registering the
phone first with `npx eas device:create`.

Until there is such an account, iPhone users have the web app instead: see
[The web app, for iPhones](#the-web-app-for-iphones).

What has been tried on real phones so far, with results, is in
[`TESTING.md`](TESTING.md).

### When something is wrong

| What you see | Why | What to do |
|---|---|---|
| Dev warning: *"Push is not set up on this build"* | No push token could be made | In Expo Go: expected, use the development build. In the build: steps 4 to 6 are not done |
| *"Default FirebaseApp is not initialized"* | The app was built without `google-services.json` | Step 4, then build again (step 6) |
| The "Turn on" card says *Notifications are off* | The phone's permission was refused | Tap **Settings** on the card and allow notifications for Faith Tribe |
| Registered, test says `pushed at: None` | Expo refused the message | Usually step 5 was skipped: `InvalidCredentials` in the server log |
| Works, then stops after reinstalling | The token changed and the old one was retired | Open the app once while signed in; it registers again on launch |
| A reminder never arrives but shows in the inbox | It was held back on purpose | Open the row's `data.suppressed`: `quiet_hours`, `type_muted` or `announcement_cap` |
| Nothing arrives and the server log says `DEVICE PUSH ->` | The server is still on the logging backend | Step 7, and restart the server |

### What must not be committed

- The **service account key** from step 5. Ever.
- `.env` files. `mobile/.gitignore` already covers `.env*.local`; the backend's
  `.env` is ignored at the repo root.

`eas.json` and `app.json` (with the project id) are fine to commit.
`google-services.json` is not a secret, but see the note in step 4 before
adding it to a public repository.

## The web app, for iPhones

There is no Apple Developer account, so there is no iPhone app in the App
Store. iPhone users get the same app as a website they add to their Home
Screen (a PWA). It is this codebase built for the web, not a second app:
`npx expo export --platform web` turns it into a folder of static files.

What an iPhone user gets, once it is on the Home Screen:

- It opens full screen from its own icon, with no browser bars.
- It opens with no signal. The page and scripts are kept by the service worker
  (`public/sw.js`); Today, the profile and so on come back from the saved cache,
  and the Bible from the chapters saved on the phone.
- A whole translation can be kept on the phone, as in the Android app.
- Reminders and event news as notifications (iOS 16.4 or later).

What is different from the Android app:

| | Android app | Web app |
|---|---|---|
| Sign-in is kept in | The phone's keystore | `localStorage` (see `src/api/tokens.web.ts` for why) |
| Bible and cache are kept in | Files | IndexedDB (`src/data/disk.web.ts`) |
| Notifications go through | Expo and Firebase (`/notifications/devices/`) | Web Push (`/notifications/push/`) |
| Ticket scanning with the camera | Yes | Not yet: search by name or ticket number instead |

Files that exist only for the web end in `.web.ts`; Metro picks them over the
plain file when building for the web. Everything else is shared.

### Try it on this computer

```powershell
cd mobile
npx expo start --web
```

The service worker is left out while developing, so offline and notifications
can only be tried on a real build:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:8000/api/v1"
npx expo export --platform web
npx serve dist --single
```

### Put it online (once)

It is hosted as its own Vercel project, separate from the website.

1. In Vercel, **Add New → Project**, pick this repository, and set **Root
   Directory** to `mobile`. `mobile/vercel.json` supplies the build command,
   the output folder and the rule that sends every address to the app.
2. Under **Environment Variables** add:

   | Name | Value |
   |---|---|
   | `EXPO_PUBLIC_API_URL` | The API, ending in `/api/v1`. The same address the website uses |
   | `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | The backend's `VAPID_PUBLIC_KEY`. Leave it out and the app works without notifications |

   Both are read when the site is built, so changing one means redeploying.
3. Give it an address, for example `app.thefaithtribe.live` (**Settings →
   Domains**). It must be HTTPS; a service worker does not run otherwise.
4. Tell the API to accept requests from that address. On the backend host, add
   it to `CORS_ALLOWED_ORIGINS`, for example:

   ```
   CORS_ALLOWED_ORIGINS=https://www.thefaithtribe.live,https://app.thefaithtribe.live
   ```

   Without this every request from the web app is refused by the browser and
   the app shows its "couldn't load" screens.
5. For notifications, the backend needs web push turned on
   ([`docs/ops/06-push-notifications.md`](../docs/ops/06-push-notifications.md)):
   `NOTIFICATIONS_PUSH_BACKEND=notifications.push.WebPushBackend`, both VAPID
   keys, and `VAPID_ADMIN_EMAIL`.

### How a teen installs it

On an iPhone, in **Safari**: open the address, tap **Share**, then **Add to
Home Screen**. Today shows a card saying exactly this until it is done
(`src/components/InstallHint.tsx`). On Android or desktop Chrome the same card
has an **Install** button.

Two things only work after it has been added, and this is Apple's rule, not
ours: notifications, and keeping saved data for good. In a Safari tab the
reminder question is never asked, because the answer could not be honoured.

### Releasing a change

Push to the branch Vercel builds from. The next time someone opens the app
with a connection they get the new version; nothing is installed again. If
`public/sw.js` itself changes in a way that makes old kept files wrong, bump
`VERSION` at the top of it.

## Running the backend

The app talks to the Django API in `../backend`. **Start it bound to all
interfaces**, not the `runserver` default:

```bash
cd ../backend && venv/Scripts/python.exe manage.py runserver 0.0.0.0:8000
```

`manage.py runserver` binds `127.0.0.1` unless told otherwise, which means only
the host machine can reach it — a phone on the LAN or an Android emulator
(which reaches the host at `10.0.2.2`) gets a refused connection and every
screen shows its offline state. `ALLOWED_HOSTS` already defaults to `['*']`, so
nothing else needs changing. On Windows, allow `python.exe` on the private
network when the firewall prompts.

`src/api/config.ts` resolves the base URL in this order:

1. `EXPO_PUBLIC_API_URL` — set this for staging/production (see `.env.example`).
2. The machine currently serving the JS bundle, on port 8000. Expo already knows
   the developer machine's LAN address because it is serving the bundle from it,
   so a physical device works with no configuration.
3. Loopback (`10.0.2.2` on Android) for the simulator.

In development, a failed request names the URL it tried rather than saying
"you're offline" — an unreachable dev server and a dropped connection look
identical otherwise.

## Data

Every screen reads from the live API through React Query (`src/api/queries.ts`).
Response types in `src/api/types.ts` are transcribed by hand from the Django
serialisers, because `manage.py spectacular` reports 278 errors on this schema —
the hand-rolled `APIView`s (Today, Progress, Bible lookup) declare no
`serializer_class`, so generated types would be `unknown` exactly where the app
needs them most.

| Screen | Endpoint |
|---|---|
| Today | `GET /today/` — the whole screen in one call, public |
| Challenge | `POST /today/challenge/complete/` |
| Devotional | `GET /content/devotionals/{id}/` |
| Library | `GET /content/devotionals/?search=` |
| Bible | `GET /bible/lookup/?book=&chapter=`, `/bible/books/`, `/bible/translations/` |
| Tribe | `GET /events/events/`, `POST /events/events/{id}/register/` |
| Notifications | `GET /notifications/inbox/`, `POST .../mark_read/`, `POST/DELETE /notifications/devices/` |
| Teacher tools | `GET /content/manuals/current/`, `/identity/class/`, `/events/checkin/today/`, `POST /events/checkin/scan/` |
| Me | `GET /profiles/me/`, `/progress/summary/`, `/events/registrations/mine/` |
| Ticket (paying) | `POST /payments/registrations/{id}/checkout/`, `POST /payments/registrations/{id}/check/`. The paying itself is on Squad's page in the browser; the link for a parent is `/payments/pay/{pay_token}/` |
| Saved | `GET/POST /profiles/favorites/`, `DELETE .../remove/` |
| Sign-up | `POST /auth/signup/start/`, `/auth/signup/complete/`, `GET /hierarchy/public/children/` |
| Log in | `POST /auth/login/`, `/auth/otp/request/`, `/auth/otp/verify/`, `/auth/refresh/`, `/auth/logout/`, `GET /auth/me/` |

Notes on the wiring:

- **Today is public.** A guest gets the devotional, verse and challenge with the
  personal half null — which is what lets the screen render before anyone has an
  account (05-navigation.md: the guest view is a preview of the real product).
- **A pipeline gap is a 200, not a 404.** `has_devotional: false` still carries
  a true streak and challenge, so the screen keeps working and shows the empty
  state from 06-user-flows.md flow 5. If Today looks bare, check whether a
  devotional exists for *today's* date — the API is behaving correctly.
- **Sign-up has no password.** The teen gives an email and a phone number, one
  code goes to both, and either copy creates the account. Signing in later is
  by code too, or by password for accounts made on the website.
- **Tokens live in `expo-secure-store`** (iOS Keychain / Android Keystore), not
  AsyncStorage: these are bearer credentials for a minor's account.
- **One refresh, shared.** Several requests 401 together on a cold start; a
  single in-flight promise refreshes once and the rest await it, rather than N
  refreshes racing to rotate the same token.

## Design rules this implements

Not restated in code, but load-bearing:

- **Five destinations, forever**, Bible in the centre slot — `05-navigation.md`
- **One Day. One Verse. One Message** — Today has one hero, not a dashboard
- Bottom nav **hides on scroll-down inside the reader only**
- Notification badge is the **only** numeric badge in the teen surface, capped at 9+
- Touch targets ≥44px; reduced-motion honoured on every animation
- Photography appears in Tribe and Library only — Today and Bible stay illustrated

## Not yet built

- Marking a devotional read — the Progress domain records it, but the app only
  posts challenge completions so far
- Bible search, highlights, notes and continue-reading (endpoints exist under
  `/bible/`; the reader currently only reads passages)
- Library's video, podcast and course shelves — `/media/` and the article and
  manual endpoints under `/content/`
- Audio/video playback and the docked mini-player
- A real scannable QR on the ticket sheet; the registration code is shown but
  the symbol is a placeholder glyph
- Offline sync (check-in queues its own scans; nothing else does)
- Push on a real phone has not been tested end to end yet: it needs the
  Firebase steps above
- **Tribe's community half.** `04-information-architecture.md` defines Tribe as
  "events + community"; the design export and this build cover events only.
  Friends, prayer and groups join this tab later — the nav never grows past
  five. Me → My tickets is a shortcut; the canonical home is Tribe → Events.
- Lint config — `npx expo lint` scaffolds it
