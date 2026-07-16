// frontend/src/types/index.ts
// Kept in sync with all Django REST Framework serializers across every app.

// ─── Enums / Literals ────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'coordinator' | 'teacher' | 'teen' | 'individual';
export type AgeGroup = 'toddler' | 'children' | 'pre_teen' | 'teen' | 'superteen' | '';
export type ContentStatus = 'draft' | 'published' | 'scheduled' | 'archived';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  password_confirm?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  gender?: string;
  province?: string;
  role?: string;
  date_of_birth?: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
  needs_gender?: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────

/** Matches UserSerializer */
export interface User {
  id: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone?: string;
  gender?: string;
  role: UserRole;
  role_display?: string;
  province?: string;
  province_display?: string;
  zone?: string;
  area?: string;
  parish?: string;
  is_active?: boolean;
  date_joined?: string;
  last_login?: string | null;
  profile_picture?: string | null;
  bio?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  age_group?: AgeGroup;
  date_of_birth?: string;
  // Client-side only — not returned by API
  name?: string;
  token?: string;
  refreshToken?: string;
}

export interface LoginHistory {
  id: string;
  user_username?: string;
  ip_address?: string;
  user_agent?: string;
  login_time: string;
  success: boolean;
}

export interface AuditLog {
  id: string;
  user_display?: string;
  action: string;
  action_display?: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

// ─── Teen Profile ─────────────────────────────────────────────────────────────

/** Matches TeenProfileSerializer */
export interface TeenProfile {
  id: string;
  user: string;
  user_email?: string;
  user_username?: string;
  full_name?: string;
  date_of_birth?: string | null;
  age?: number;
  age_group?: AgeGroup;
  gender?: string;
  bio?: string;
  avatar?: string | null;
  province?: string;
  zone?: string;
  area?: string;
  parish?: string;
  department?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relationship?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  medical_conditions?: string;
  allergies?: string;
  medications?: string;
  dietary_restrictions?: string;
  blood_group?: string;
  favorite_devotional_topics?: string[];
  notification_preferences?: Record<string, unknown>;
  devotionals_read_count?: number;
  events_attended_count?: number;
  streak_days?: number;
  longest_streak?: number;
  last_active_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Content ──────────────────────────────────────────────────────────────────

/** Matches DevotionalDetailSerializer */
export interface Devotional {
  id: string;
  date: string;
  title: string;
  slug?: string;

  // Open Heavens fields
  memory_verse_passage?: string;
  memory_verse_content?: string;
  bible_text_passage?: string;
  bible_text_content?: string;
  bible_in_one_year?: string;
  anchor_scripture?: string;
  scripture_text?: string;
  content: string;
  key_point?: string;
  prayer?: string;
  confession?: string;
  action_point?: string;
  hymn?: string;
  author?: string;

  // Media
  cover_image?: string;
  audio_url?: string;
  audio_file?: string;
  audio_duration_seconds?: number | null;
  has_audio?: boolean;

  // Stats
  view_count?: number;
  share_count?: number;
  read_count?: number;
  likes_count?: number;
  is_liked?: boolean;

  tags?: string[];
  status?: ContentStatus;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;

  // Legacy aliases — kept for pages not yet migrated
  scripture_reference?: string;
  memory_verse?: string;
  prayer_point?: string;
}

/** Matches ManualSeriesDetailSerializer */
export interface Series {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  cover_image?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  order?: number;
  target_age_group?: string;
  manual_count?: number;
  status?: ContentStatus;
  created_at?: string;
  updated_at?: string;
}

/** Matches ManualDetailSerializer */
export interface Manual {
  id: string;
  series?: string | null;
  series_title?: string;
  series_detail?: Series;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  title: string;
  slug?: string;
  theme?: string;
  memory_verse?: string;
  memory_verse_text?: string;
  lesson_objectives?: string[];
  lesson_content?: string;
  key_takeaways?: string[];
  discussion_questions?: string[];
  practical_application?: string;
  activity_suggestions?: string[];
  opening_prayer_points?: string[];
  closing_prayer?: string;
  cover_image?: string;
  pdf_url?: string;
  pdf_file?: string;
  additional_resources?: string[];
  has_pdf?: boolean;
  target_age_group?: string;
  view_count?: number;
  download_count?: number;
  status?: ContentStatus;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Article {
  id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  tags?: string[];
  author_name?: string;
  author_bio?: string;
  author_image?: string;
  cover_image?: string;
  featured_image_caption?: string;
  read_time_minutes?: number;
  view_count?: number;
  share_count?: number;
  is_featured?: boolean;
  is_pinned?: boolean;
  status?: ContentStatus;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Media ────────────────────────────────────────────────────────────────────

/** Matches MediaCategorySerializer */
export interface MediaCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  cover_image?: string | null;
  icon?: string;
  color?: string;
  is_featured?: boolean;
  is_active?: boolean;
  order?: number;
  series_count?: number;
}

/** Matches MediaSeriesDetailSerializer */
export interface MediaSeries {
  id: string;
  category?: string;
  category_detail?: MediaCategory;
  category_name?: string;
  title: string;
  slug?: string;
  description?: string;
  short_description?: string;
  cover_image?: string | null;
  banner_image?: string | null;
  host_name?: string;
  host_bio?: string;
  host_image?: string | null;
  rss_feed_url?: string;
  website_url?: string;
  apple_podcasts_url?: string;
  spotify_url?: string;
  youtube_channel_url?: string;
  release_frequency?: string;
  subscriber_count?: number;
  total_listen_count?: number;
  episode_count?: number;
  order?: number;
  is_featured?: boolean;
  status?: ContentStatus;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Matches MediaEpisodeDetailSerializer */
export interface MediaEpisode {
  id: string;
  series?: string;
  series_detail?: MediaSeries;
  series_title?: string;
  episode_number?: number | null;
  season_number?: number | null;
  title: string;
  slug?: string;
  description: string;
  show_notes?: string;
  thumbnail?: string | null;
  media_type: 'audio' | 'video' | 'both';
  has_audio: boolean;
  has_video: boolean;

  // Audio
  audio_url?: string;
  audio_file?: string;
  audio_duration_seconds?: number | null;
  audio_file_size_bytes?: number | null;
  audio_mime_type?: string;

  // Video
  video_url?: string;
  video_file?: string;
  video_duration_seconds?: number | null;
  video_file_size_bytes?: number | null;
  video_mime_type?: string;
  video_resolution?: string;
  hls_url?: string;
  dash_url?: string;
  embed_code?: string;
  external_video_id?: string;

  duration_seconds?: number;
  duration_formatted?: string;
  file_size_bytes?: number | null;

  // Stats
  view_count: number;
  play_count: number;
  like_count?: number;
  share_count?: number;
  download_count?: number;

  tags?: string[];
  guests?: string[];
  transcript?: string;
  chapters?: object[];

  is_featured: boolean;
  is_premium?: boolean;
  is_explicit?: boolean;
  order?: number;
  status: string;
  published_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface Playlist {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  cover_image?: string | null;
  created_by?: string;
  is_public?: boolean;
  is_featured?: boolean;
  is_system?: boolean;
  episode_count?: number;
  total_duration_seconds?: number;
  episodes_list?: MediaEpisode[];
  created_at?: string;
  updated_at?: string;
}

export interface FavoriteItem {
  id: string;
  content_object: Devotional | MediaEpisode;
  content_type: 'devotional' | 'media_episode';
  added_at: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

/** Matches PaymentPlanSerializer */
export interface PaymentPlan {
  id: string;
  name: string;
  plan_type?: string;
  description?: string;
  amount: number;
  formatted_amount?: string;
  currency?: string;
  is_active?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  ticket_category?: string;
  max_usage?: number | null;
  usage_count?: number;
  is_valid?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Matches PaymentSerializer */
export interface Payment {
  id: string;
  reference: string;
  paystack_reference?: string;
  amount: number;
  formatted_amount?: string;
  currency?: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  status_display?: string;
  payment_method?: string;
  payment_method_display?: string;
  ticket?: string | null;
  ticket_details?: Ticket;
  description?: string;
  payer_email?: string;
  payer_name?: string;
  payer_phone?: string;
  authorization_code?: string;
  channel?: string;
  is_successful?: boolean;
  is_pending?: boolean;
  initiated_at?: string;
  completed_at?: string | null;
  updated_at?: string;
  metadata?: Record<string, unknown>;
  paystack_response?: Record<string, unknown>;
}

// ─── Legacy Tickets (tickets app — superseded by EventRegistration) ────────────

/** Matches TicketSerializer (snake_case = what the API returns) */
export interface Ticket {
  id: string;
  ticket_id: string;
  full_name: string;
  age: number;
  age_group?: string;
  category: string;
  category_display?: string;
  gender: string;
  gender_display?: string;
  date_of_birth?: string | null;
  phone: string;
  email: string;
  province: string;
  zone?: string;
  area?: string;
  parish: string;
  department?: string;

  // Medical & Emergency
  medical_conditions?: string;
  medications?: string;
  dietary_restrictions?: string;
  emergency_contact: string;
  emergency_phone: string;
  emergency_relationship: string;

  // Parent / Guardian
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  parent_relationship: string;

  status: 'pending' | 'approved' | 'rejected';
  status_display?: string;
  notes?: string;
  registered_at: string;
  registered_by?: string | null;
  registered_by_name?: string;
  approved_at?: string | null;
  approved_by?: string | null;
  approved_by_name?: string;
  created_at?: string;
  updated_at?: string;
  qr_code?: string | null;
  payment_status?: string;
  proof_of_payment?: string | null;

  // Legacy camelCase aliases — some older pages still read these
  /** @deprecated use ticket_id */   ticketId?: string;
  /** @deprecated use full_name */   fullName?: string;
  /** @deprecated use registered_at */ registeredAt?: string;
  /** @deprecated use registered_by */ registeredBy?: string;
  /** @deprecated use parent_name */ parentName?: string;
  /** @deprecated use parent_email */ parentEmail?: string;
  /** @deprecated use parent_phone */ parentPhone?: string;
  /** @deprecated use parent_relationship */ parentRelationship?: string;
  /** @deprecated use emergency_contact */ emergencyContact?: string;
  /** @deprecated use emergency_phone */ emergencyPhone?: string;
  /** @deprecated use emergency_relationship */ emergencyRelationship?: string;
  /** @deprecated use medical_conditions */ medicalConditions?: string;
  /** @deprecated use dietary_restrictions */ dietaryRestrictions?: string;
  registrationType?: 'individual' | 'coordinator';
  paymentRef?: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

/** Matches EventDetailSerializer */
export interface Event {
  id: string;
  title: string;
  slug?: string;
  event_type?: string;
  short_description?: string;
  description?: string;

  // Location
  venue?: string;
  city?: string;
  state?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;

  // Dates
  start_datetime: string;
  end_datetime?: string;
  timezone_name?: string;

  // Virtual
  is_virtual?: boolean;
  is_hybrid?: boolean;
  virtual_link?: string;
  virtual_platform?: string;

  // Media
  cover_image?: string;
  gallery_images?: string[];
  promotional_video_url?: string;

  // Registration settings
  registration_status?: string;
  registration_opens?: string | null;
  registration_closes?: string | null;
  max_attendees?: number;
  waitlist_enabled?: boolean;
  max_waitlist?: number | null;

  // Pricing
  is_free?: boolean;
  price: number;
  current_price?: number;
  early_bird_price?: number | null;
  early_bird_deadline?: string | null;
  group_discount_threshold?: number | null;
  group_discount_price?: number | null;

  // Eligibility
  target_provinces?: string[];
  target_age_groups?: string[];
  min_age?: number | null;
  max_age?: number | null;
  requires_guardian_consent?: boolean;

  // Organizer
  organizer_name?: string;
  organizer_email?: string;
  organizer_phone?: string;
  organizer_website?: string;

  // Additional info
  what_to_bring?: string[];
  schedule?: object[];
  faqs?: object[];

  // Stats
  registration_count: number;
  waitlist_count?: number;
  checked_in_count?: number;
  view_count?: number;
  spots_remaining?: number;

  // Computed flags
  is_upcoming?: boolean;
  is_ongoing?: boolean;
  is_past?: boolean;
  is_full?: boolean;
  is_featured?: boolean;

  // Publishing
  status?: string;
  published_at?: string | null;
  scheduled_for?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Matches EventRegistrationDetailSerializer */
export interface EventRegistration {
  id: string;
  registration_id: string;
  event: string;
  event_detail?: Event;
  user?: string | null;
  profile?: string | null;

  // Attendee
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  attendee_age: number;
  attendee_gender?: string;
  attendee_date_of_birth?: string | null;
  attendee_category?: string;

  // Church
  attendee_province: string;
  attendee_zone?: string;
  attendee_area?: string;
  attendee_parish: string;
  attendee_department?: string;

  // Guardian
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relationship?: string;
  guardian_consent?: boolean;
  consent_timestamp?: string | null;

  // Emergency
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;

  // Medical
  medical_conditions?: string;
  allergies?: string;
  medications?: string;
  dietary_restrictions?: string;
  special_needs?: string;

  // Status & payment
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' | 'checked_in' | 'attended' | 'no_show';
  payment_status: 'not_required' | 'pending' | 'paid' | 'refunded' | 'failed';
  registration_type?: string;
  is_confirmed?: boolean;
  is_paid?: boolean;
  is_checked_in?: boolean;

  // Payment details
  amount_due?: number | null;
  amount_paid?: number | null;
  payment?: string | null;
  payment_reference?: string;
  qr_code?: string | null;

  // Check-in
  checked_in_at?: string | null;
  check_in_method?: string;

  // Workflow
  registered_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string;

  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EventDashboardStats {
  total_registrations: number;
  confirmed_count: number;
  pending_count: number;
  cancelled_count: number;
  waitlisted_count: number;
  checked_in_count: number;
  paid_count: number;
  unpaid_count: number;
  total_revenue: number;
}

export interface EventBulkUpload {
  id: string;
  event: string;
  uploaded_by?: string;
  filename: string;
  file?: string;
  total_records?: number;
  successful_records?: number;
  failed_records?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  error_log?: string;
  error_details?: object[];
  processed_at?: string | null;
  created_at?: string;
}

export interface RegistrationAuditLog {
  id: string;
  registration: string;
  user?: string | null;
  user_name?: string;
  action: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  timestamp: string;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export interface OperationResult {
  action: string;
  total: number;
  successful: number;
  failed: number;
  error?: string;
  details: unknown[];
}
