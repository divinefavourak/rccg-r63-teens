// frontend/src/types/index.ts

export interface Ticket {
  id: string;
  ticketId: string;
  fullName: string;
  age: string | number;
  category: string;
  gender: string;
  phone: string;
  email: string;
  province: string;
  zone: string;
  area: string;
  parish: string;
  department?: string;

  // Medical & Emergency
  medicalConditions?: string;
  medications?: string;
  dietaryRestrictions?: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelationship: string;

  // Parent
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelationship: string;

  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
  registeredBy?: string;
  registrationType?: 'individual' | 'coordinator';
  paymentRef?: string;
  proof_of_payment?: string;
  payment_status?: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'coordinator';
  province?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  parish?: string;
  token?: string;
  refreshToken?: string;
}

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
  province?: string;
  role?: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

// Devotional Content
export interface Devotional {
  id: string;
  title: string;
  date: string;
  
  // Legacy Fields (kept for type safety)
  scripture_reference?: string;
  memory_verse?: string;
  scripture_text?: string;
  anchor_scripture?: string;

  // New Open Heavens Fields
  memory_verse_passage?: string;
  memory_verse_content?: string;
  bible_text_passage?: string;
  bible_text_content?: string;
  bible_in_one_year?: string;
  hymn?: string;
  author?: string;

  key_point?: string;
  prayer?: string;
  prayer_point?: string; // Legacy alias check
  status?: 'draft' | 'published' | 'scheduled';

  cover_image?: string;
  content: string; // HTML or Markdown
  
  likes_count: number;
  is_liked?: boolean;
}

export interface MediaEpisode {
  id: string;
  series?: string;
  series_title?: string;
  title: string;
  description: string;
  media_type: 'audio' | 'video' | 'both';
  thumbnail?: string;
  has_audio: boolean;
  has_video: boolean;
  audio_url?: string;
  audio_file?: string;
  video_url?: string;
  video_file?: string;
  duration_seconds?: number;
  duration_formatted?: string;
  published_at: string;
  view_count: number;
  play_count: number;
  is_featured: boolean;
  status: string;
}

export interface FavoriteItem {
  id: string;
  content_object: Devotional | MediaEpisode;
  content_type: 'devotional' | 'media_episode';
  added_at: string;
}

export interface Manual {
  id: string;
  series?: string | null;
  series_title?: string;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  title: string;
  slug?: string;
  theme?: string;           // bible text passage
  memory_verse?: string;    // passage reference
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
  status?: string;
  published_at?: string;
}

export interface Series {
  id: string;
  title: string;
  description: string;
  manuals_count: number;
}

export interface Event {
  id: string;
  title: string;
  slug?: string;
  event_type?: string;
  short_description?: string;
  description?: string;
  venue?: string;            // backend field (was: location)
  city?: string;
  state?: string;
  address?: string;
  start_datetime: string;    // backend field (was: start_date)
  end_datetime?: string;     // backend field (was: end_date)
  cover_image?: string;
  is_virtual?: boolean;
  is_free?: boolean;
  price: number;
  registration_status?: string;
  registration_count: number;
  max_attendees?: number;    // backend field (was: available_seats)
  spots_remaining?: number;
  is_upcoming?: boolean;
  is_featured?: boolean;
  status?: string;
}


export interface EventRegistration {
  id: string;
  event: Event;
  ticket_id: string; // QR Code content
  registered_at: string;
}

export interface OperationResult {
  action: string;
  total: number;
  successful: number;
  failed: number;
  error?: string;
  details: any[];
}
