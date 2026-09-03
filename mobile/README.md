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
src/
  theme/tokens.ts         imperative mirror of global.css + elevation, motion
  theme/ThemeProvider.tsx light/dark, persisted
  state/session.tsx       guest flag, saved items, challenge state
  state/chrome.tsx        nav visibility, shared with the reader's scroll
  components/             Icon, BrandMarks, Photo, BottomNav, ui primitives
  data/content.ts         all fixture content
global.css                semantic colour tokens (light + dark)
tailwind.config.js        tokens -> Tailwind scales
```

## Data

Everything renders from `src/data/content.ts`, typed to match the Django
serialisers in `../backend` rather than the Figma mock. Wiring the real API
means replacing that module's exports with queries; no screen changes shape.

## Design rules this implements

Not restated in code, but load-bearing:

- **Five destinations, forever**, Bible in the centre slot — `05-navigation.md`
- **One Day. One Verse. One Message** — Today has one hero, not a dashboard
- Bottom nav **hides on scroll-down inside the reader only**
- Notification badge is the **only** numeric badge in the teen surface, capped at 9+
- Touch targets ≥44px; reduced-motion honoured on every animation
- Photography appears in Tribe and Library only — Today and Bible stay illustrated

## Not yet built

- Auth (the guest flag in `state/session.tsx` is where it plugs in)
- Real Bible text and search — currently one fixture chapter
- Audio/video playback and the docked mini-player
- Offline sync and the ticket QR's real payload
