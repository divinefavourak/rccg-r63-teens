/**
 * Response shapes, transcribed from the Django serializers in `../backend`.
 *
 * Written by hand rather than generated: `manage.py spectacular` reports 278
 * errors on this schema because the hand-rolled `APIView`s (Today, Progress,
 * Bible search) declare no serializer_class, so the generated types would be
 * `unknown` exactly where the app needs them most.
 *
 * Source of truth for each block is named in its comment. When the backend
 * serializer changes, this file changes with it.
 */

// ─── Auth (users/views.py CustomTokenObtainPairView) ───────────────────────

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  is_verified?: boolean;
  /** Absolute URL, or null until the teen adds a photo. */
  profile_picture?: string | null;
  /** In `+234…` form. */
  phone?: string | null;
  /** Where the teen worships, as free text copied from the tree at sign-up. */
  province?: string | null;
  province_display?: string | null;
  zone?: string | null;
  area?: string | null;
  parish?: string | null;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
  needs_gender: boolean;
}

/** One row of the public church picker (hierarchy/views.py PublicChildrenView). */
export type ChurchLevel = 'region' | 'province' | 'zone' | 'area' | 'parish';

export interface ChurchNode {
  id: string;
  name: string;
  node_type: ChurchLevel;
}

// ─── Today (today/serializers.py) ──────────────────────────────────────────

/** The devotional *card* — the body arrives separately from /content/. */
export interface TodayDevotional {
  id: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  reading_time_minutes: number;
}

/** content/serializers.py MemoryVerseSerializer. */
export interface MemoryVerse {
  id: string;
  devotional: string | null;
  devotional_date: string | null;
  is_primary: boolean;
  reference_display: string;
  /** Resolves the override-or-Scripture rule server-side. */
  text: string;
  text_override: string | null;
  translation: string | null;
  translation_code: string | null;
  /** Copyright line licensed translations require. */
  attribution: string | null;
  start_verse: string | null;
  end_verse: string | null;
}

/** An address into the reader, not resolved text. */
export interface TodayScriptureReference {
  reference_display: string;
  kind: string;
  book_osis: string;
  chapter_number: number;
  start_verse_number: number | null;
  end_verse_number: number | null;
}

export interface TodayChallenge {
  id: string;
  title: string;
  description: string;
  challenge_date: string;
}

/** No deficit, no "days missed" — 12-gamification.md forbids shaming copy. */
export interface StreakState {
  current_length: number;
  longest_length: number;
  last_active_on: string | null;
}

/** bible/serializers.py ContinueReadingSerializer. */
export interface ContinueReading {
  /** The chapter's id. */
  chapter: string;
  chapter_detail: {
    id: string;
    number: number;
    /** "John 3" */
    reference: string;
    translation_code: string | null;
  };
  translation_code: string | null;
  verse_number: number | null;
}

/**
 * `GET /today/` — the whole screen in one call.
 *
 * Public: a guest gets the devotional, verse and challenge with the personal
 * half null. A pipeline gap is a 200 with `has_devotional: false`, never a 404.
 */
export interface TodayResponse {
  date: string;
  greeting: string;

  has_devotional: boolean;
  devotional: TodayDevotional | null;
  devotional_completed: boolean;

  memory_verse: MemoryVerse | null;
  scripture_references: TodayScriptureReference[];

  challenge: TodayChallenge | null;
  challenge_completed: boolean;

  streak: StreakState | null;
  grace_balance: number;
  continue_reading: ContinueReading | null;
}

// ─── Content (content/serializers.py) ──────────────────────────────────────

export interface DevotionalDetail {
  id: string;
  date: string;
  title: string;
  slug: string;
  author: string | null;

  /** The structured Scripture layer; may be null while the legacy strings hold. */
  memory_verse: MemoryVerse | null;
  scripture_references: TodayScriptureReference[];
  discussion_questions: { id: string; devotional: string; text: string; order: number }[];

  /**
   * The Open Heavens sections, as imported.
   *
   * Every one of these is optional per devotional, and a real entry usually
   * fills only some — so the reader renders each on its own presence rather
   * than assuming a fixed template.
   */
  memory_verse_passage: string | null;
  memory_verse_content: string | null;
  anchor_scripture: string | null;
  scripture_text: string | null;
  bible_text_passage: string | null;
  bible_text_content: string | null;
  content: string;
  key_point: string | null;
  action_point: string | null;
  prayer: string | null;
  confession: string | null;
  bible_in_one_year: string | null;
  /**
   * Present in the API but deliberately not rendered: the importer has been
   * filling it with a mojibake copy of the whole message rather than a hymn.
   */
  hymn: string | null;

  cover_image: string | null;
  has_audio: boolean;
  audio_url: string | null;
}

export interface DevotionalListItem {
  id: string;
  date: string;
  title: string;
  slug: string;
  memory_verse_passage: string | null;
  memory_verse_content: string | null;
  cover_image: string | null;
  has_audio: boolean;
  view_count: number;
  status: string;
  published_at: string | null;
}

// ─── Progress (progress/serializers.py) ────────────────────────────────────

export interface ProgressSummary {
  current_streak: number;
  longest_streak: number;
  last_active_on: string | null;
  grace_balance: number;
  devotionals_completed: number;
  chapters_read: number;
  books_read: number;
}

// ─── Events (events/serializers.py EventListSerializer) ────────────────────

export interface EventListItem {
  id: string;
  title: string;
  slug: string;
  event_type: string;
  short_description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  venue: string | null;
  city: string | null;
  cover_image: string | null;
  is_virtual: boolean;
  is_free: boolean;
  price: string | null;
  current_price: string | null;
  registration_status: string;
  registration_count: number;
  max_attendees: number | null;
  spots_remaining: number | null;
  is_upcoming: boolean;
  is_featured: boolean;
  status: string;
}

export interface EventDetail extends EventListItem {
  description: string | null;
  address: string | null;
  virtual_link: string | null;
  organizer_name: string | null;
  /** A plain list of items; empty when the organiser gave none. */
  what_to_bring: string[] | null;
  is_full: boolean;
  requires_guardian_consent: boolean;
  min_age: number | null;
  max_age: number | null;
}

// ─── Notifications (notifications/serializers.py) ──────────────────────────

export interface AppNotification {
  id: string;
  notification_type: string;
  rung: string | null;
  title: string;
  body: string;
  deep_link: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  pushed_at: string | null;
  created_at: string;
}

// ─── Bible (bible/serializers.py) ──────────────────────────────────────────

export interface BibleTranslation {
  id: string;
  code: string;
  name: string;
  attribution?: string | null;
  /** Whether the licence allows keeping the text on a device. */
  is_offline_capable?: boolean;
  /** True when the licence requires `copyright_notice` wherever the text is shown. */
  attribution_required?: boolean;
  copyright_notice?: string | null;
}

export interface BibleBook {
  id: string;
  translation: string;
  translation_code: string;
  /** 'Gen', 'John' — the canonical address segment. `osis` is not a field. */
  osis_code: string;
  book_number: number;
  name: string;
  abbreviation: string;
  testament: string;
  /** Bounds chapter navigation, so next/prev cannot walk past the end. */
  chapter_count: number;
}

export interface BibleVerse {
  id: string;
  chapter: string;
  number: number;
  text: string;
  reference: string;
}

export interface BibleChapterDetail {
  id: string;
  number: number;
  reference: string;
  translation_code: string | null;
  verses: BibleVerse[];
}

export interface Highlight {
  id: string;
  verse: string;
  color: string;
}

/** A saved verse or chapter (bible/serializers.py BookmarkSerializer). */
export interface Bookmark {
  id: string;
  verse: string | null;
  chapter: string | null;
  verse_detail: {
    id: string;
    number: number;
    text: string;
    reference: string;
    translation_code: string | null;
  } | null;
  /** "John 3:16", or "John 3" for a whole chapter. */
  target_reference: string;
  created_at: string;
}

/**
 * `GET /bible/search/` — one field, two answers. A `reference` result is a
 * passage to open; a `keyword` result is a list of hits grouped by book.
 */
export interface ScriptureSearch {
  query: string;
  kind: 'reference' | 'keyword';
  reference?: string;
  /** OSIS code, on a reference result. */
  book?: string;
  chapter?: number;
  verses?: BibleVerse[];
  results?: { osis_code: string; name: string; testament: string; verses: BibleVerse[] }[];
  total?: number;
}

/** `GET /bible/share/` — the words the licence allows, ready to send. */
export interface VerseShare {
  reference: string;
  text: string;
  translation_code: string;
  attribution: string;
  share_text: string;
  copy_text: string;
}

// ─── DRF pagination envelope ───────────────────────────────────────────────

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Profile (profiles/serializers.py TeenProfileSerializer) ───────────────

export interface TeenProfile {
  id: string;
  user: string;
  user_email: string;
  user_username: string;
  full_name: string;

  date_of_birth: string | null;
  age: number | null;
  age_group: string | null;
  gender: string | null;
  bio: string | null;
  avatar: string | null;

  province: string | null;
  zone: string | null;
  area: string | null;
  parish: string | null;

  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_relationship: string | null;

  devotionals_read_count: number;
  events_attended_count: number;
  streak_days: number;
  longest_streak: number;
  last_active_at: string | null;
}

/**
 * A saved item (profiles/serializers.py FavoriteSerializer).
 *
 * Generic by design: `content_type` names the domain ('devotional', 'event',
 * 'article') and `content_id` the row, so one table serves every "Saved" list.
 */
export interface Favorite {
  id: string;
  profile: string;
  content_type: string;
  content_id: string;
  created_at: string;
}

// ─── Event registration (events/serializers.py) ────────────────────────────

/**
 * One of the teen's own registrations, with its event
 * (`EventRegistrationDetailSerializer`). `registration_id` is the human code
 * printed on the ticket and encoded in its QR.
 */
export interface EventRegistration {
  id: string;
  registration_id: string;
  event: string;
  event_detail: EventListItem | null;
  attendee_name: string;
  /** pending · confirmed · cancelled · waitlisted · checked_in · attended · no_show */
  status: string;
  /** not_required · pending · paid · refunded · failed */
  payment_status: string;
  amount_due: string | null;
  amount_paid: string | null;
  payment_reference: string | null;
  /** The server's word on whether to offer Pay. Never worked out here. */
  can_pay: boolean;
  /** When an unpaid place is released, or null when no clock is running. */
  pay_by: string | null;
  /** Goes in the link a parent pays from. Null when there is nothing to pay. */
  pay_token: string | null;
  checked_in_at: string | null;
  created_at: string;
}

/** `POST /payments/registrations/<id>/checkout/`: Paystack's page for a ticket. */
export interface Checkout {
  reference: string;
  authorization_url: string;
  amount: string;
  pay_link: string;
}

/**
 * `GET /bible/lookup/` — resolve a reference to its verses.
 *
 * Takes either free text (`?q=jn 3:16`) or a structured address
 * (`?book=John&chapter=3`), and returns one shape either way. An unimported
 * passage yields an empty `verses` list rather than a 404 — the address is
 * valid even before the text lands.
 */
export interface ScriptureLookup {
  translation: BibleTranslation;
  book: string;
  book_name: string;
  chapter: number;
  start_verse: number | null;
  end_verse: number | null;
  /** The canonical rendering of the address; never format one locally. */
  reference: string;
  verses: BibleVerse[];
}

/**
 * What `POST /events/events/{id}/register/` requires.
 *
 * Eleven fields are mandatory (`EventRegistrationCreateSerializer`), which is
 * why a bare `{}` returned 400 "field required". Most can be prefilled from the
 * teen's own profile, so the form asks them to confirm rather than to type.
 */
export interface EventRegistrationInput {
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  attendee_age: number;
  attendee_province: string;
  attendee_parish: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  guardian_relationship: string;

  // Optional, but worth carrying when the profile already knows them.
  attendee_gender?: string;
  attendee_date_of_birth?: string;
  attendee_zone?: string;
  attendee_area?: string;
  guardian_consent?: boolean;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  medical_conditions?: string;
  allergies?: string;
  dietary_restrictions?: string;
  notes?: string;
}

/** The registration response has the same shape as a row of "mine". */
export type EventRegistrationDetail = EventRegistration;

/**
 * Reminder settings (notifications/serializers.py).
 *
 * The "rungs" are the habit-reminder ladder from
 * `docs/07-feature-specifications.md` #10: morning, afternoon, evening, final.
 * The server steps a teen down the ladder on its own and stops entirely once
 * the day's devotional is done — `active_rungs` and `last_stepped_down_at` are
 * read-only reports of that, never things the client sets.
 */
export interface NotificationPreferences {
  intensity: string;

  habit_reminders_enabled: boolean;
  event_notifications_enabled: boolean;
  announcements_enabled: boolean;
  system_notifications_enabled: boolean;

  morning_rung_enabled: boolean;
  afternoon_rung_enabled: boolean;
  evening_rung_enabled: boolean;
  final_rung_enabled: boolean;

  /** "07:00:00" */
  morning_at: string;
  afternoon_at: string;
  evening_at: string;
  final_at: string;

  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;

  readonly active_rungs: number;
  readonly last_stepped_down_at: string | null;
}

/**
 * `GET /identity/me/` — who the user is and what they may do.
 *
 * `permissions` is the authority for every capability check in the app.
 * 05-navigation.md is explicit that role-gated items are *invisible* to those
 * without the role, and that capability comes from permissions rather than a
 * role code — so nothing in the client branches on a role string.
 */
export interface Identity {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  permissions: string[];
  memberships: Membership[];
  role_assignments: unknown[];
}

/** Where a person belongs in the church tree (identity MembershipSerializer). */
export interface Membership {
  id: string;
  organization_node: string;
  organization_node_detail: ChurchNode | null;
  is_primary: boolean;
}

/** Permission codes, as registered in `identity/permissions_registry.py`. */
export const PERM = {
  contentView: 'content.view',
  contentManage: 'content.manage',
  contentPublish: 'content.publish',
  eventsView: 'events.view',
  eventsManage: 'events.manage',
  eventsCheckin: 'events.checkin',
  profilesView: 'profiles.view',
} as const;

// ─── Library (content/serializers.py, media/serializers.py) ────────────────

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  /** faith · relationships · education · health · lifestyle · testimonies · news */
  category: string;
  author_name: string | null;
  cover_image: string | null;
  read_time_minutes: number | null;
  is_featured: boolean;
  published_at: string | null;
}

export interface ArticleDetail extends ArticleListItem {
  content: string;
  author_bio: string | null;
}

/** One podcast or video episode (MediaEpisodeListSerializer). */
export interface MediaEpisode {
  id: string;
  series: string | null;
  series_title: string;
  episode_number: number | null;
  title: string;
  description: string | null;
  thumbnail: string | null;
  /** audio · video · both */
  media_type: string;
  has_audio: boolean;
  has_video: boolean;
  audio_url: string | null;
  audio_file: string | null;
  video_url: string | null;
  video_file: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  is_featured: boolean;
}

// ─── Progress calendar (progress/views.py CalendarView) ────────────────────

export interface ProgressCalendar {
  /** "2026-10" */
  month: string;
  /** ISO dates the teen did something on, oldest first. */
  active_days: string[];
}

// ─── Teacher tools (content, identity/class_views.py, events/checkin.py) ───

/**
 * A weekly teaching manual (content/serializers.py ManualDetailSerializer).
 *
 * The four teacher fields only arrive for someone holding `content.view`; for
 * anyone else the server leaves them out, so they are optional here.
 */
export interface ManualDetail {
  id: string;
  series_detail: { id: string; title: string } | null;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  title: string;
  theme: string;
  memory_verse: string;
  memory_verse_text: string;
  /** JSON lists: usually strings, sometimes small objects. See `data/lesson.ts`. */
  lesson_objectives: unknown[];
  lesson_content: string;
  key_takeaways: unknown[];
  discussion_questions: unknown[];
  practical_application: string;
  activity_suggestions: unknown[];
  opening_prayer_points: unknown[];
  closing_prayer: string;

  has_teacher_edition?: boolean;
  teacher_notes?: string;
  teacher_resources?: unknown[];
  discussion_guide?: string;
}

/** One teen in a leader's class (identity/class_views.py). */
export interface ClassMember {
  id: string;
  name: string;
  age: number | null;
  photo: string | null;
  parish: string;
  /** Monday first. A day still to come is simply false. */
  week: boolean[];
  days_this_week: number;
  read_today: boolean;
  /** ISO date of the last day they read anything, or null. */
  last_read_on: string | null;
}

export interface ClassRoster {
  today: string;
  week_start: string;
  /** Everyone in the class; `members` is capped at 300. */
  total: number;
  read_today: number;
  members: ClassMember[];
}

export interface ClassMemberDetail extends ClassMember {
  today: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_relationship: string;
}

/** An event that is on today and that this person may check people in to. */
export interface CheckInEvent {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  venue: string;
  city: string;
  is_free: boolean;
  max_attendees: number | null;
  registered: number;
  checked_in: number;
}

export interface CheckInAttendee {
  registration_id: string;
  name: string;
  parish: string;
  photo: string | null;
  status: string;
  payment_status: string;
}

export type CheckInOutcome =
  | 'checked_in'
  | 'already_checked_in'
  | 'not_found'
  | 'wrong_event'
  | 'not_paid'
  | 'cancelled'
  | 'waitlisted';

/**
 * What a scan turned out to be (events/checkin.py `scan`).
 *
 * Always a 200: a cancelled ticket is an answer for the volunteer, not a
 * failed request. Only the fields that belong to the outcome are present.
 */
export interface CheckInResult {
  outcome: CheckInOutcome;
  attendee: CheckInAttendee | null;
  counts: { registered: number; checked_in: number };
  checked_in_at?: string | null;
  checked_in_by?: string;
  other_event?: { title: string; start_datetime: string };
  cancelled_at?: string | null;
  refunded?: boolean;
  amount_due?: string | null;
}
