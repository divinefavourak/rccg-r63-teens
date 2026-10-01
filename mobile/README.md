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
| `import { X } from '@expo-google-fonts/lora'` | all 8 Lora + 14 Jakarta weights | import each weight's own subpath, e.g. `@expo-google-fonts/lora/400Regular` |

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
    library.tsx  bible.tsx  tribe.tsx  me.tsx
  devotional.tsx          full devotional (modal)
  notifications.tsx       inbox (bottom sheet over Today)
  event/[id].tsx          event detail
  sign-in.tsx             auth (modal, dismissible)
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
  components/             Icon, BrandMarks, Flame, Photo, BottomNav, states, ui
global.css                semantic colour tokens (light + dark)
tailwind.config.js        tokens -> Tailwind scales
```

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
| Notifications | `GET /notifications/inbox/`, `POST .../mark_read/` |
| Me | `GET /profiles/me/`, `/progress/summary/`, `/events/registrations/mine/` |
| Saved | `GET/POST /profiles/favorites/`, `DELETE .../remove/` |
| Auth | `POST /auth/login/`, `/auth/refresh/`, `/auth/logout/`, `GET /auth/me/` |

Notes on the wiring:

- **Today is public.** A guest gets the devotional, verse and challenge with the
  personal half null — which is what lets the screen render before anyone has an
  account (05-navigation.md: the guest view is a preview of the real product).
- **A pipeline gap is a 200, not a 404.** `has_devotional: false` still carries
  a true streak and challenge, so the screen keeps working and shows the empty
  state from 06-user-flows.md flow 5. If Today looks bare, check whether a
  devotional exists for *today's* date — the API is behaving correctly.
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
- Offline sync, and push registration via `/notifications/push/`
- **Tribe's community half.** `04-information-architecture.md` defines Tribe as
  "events + community"; the design export and this build cover events only.
  Friends, prayer and groups join this tab later — the nav never grows past
  five. Me → My tickets is a shortcut; the canonical home is Tribe → Events.
- Lint config — `npx expo lint` scaffolds it
