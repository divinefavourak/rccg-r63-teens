export interface Ticket {
  id: string; // ✅ Changed from number to string (Backend uses UUIDs)
  ticketId: string;
  fullName: string;
  age: string | number; // ✅ Allow string to handle form inputs before conversion
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
  scripture_reference: string;
  memory_verse: string;

  // New Fields
  memory_verse_passage?: string;
  memory_verse_content?: string;
  bible_text_passage?: string;
  bible_text_content?: string;
  bible_in_one_year?: string;

  // Admin/Legacy Fields
  scripture_text?: string;
  anchor_scripture?: string;
  key_point?: string;
  prayer?: string;
  status?: 'draft' | 'published' | 'scheduled';

  cover_image?: string;

  content: string; // HTML or Markdown
  prayer_point: string;
  likes_count: number;
  is_liked?: boolean;
}

export interface MediaEpisode {
  id: string;
  title: string;
  description: string;
  media_type: 'audio' | 'video';
  file_url: string;
  thumbnail_url?: string;
  duration: string;
  published_at: string;
}

export interface FavoriteItem {
  id: string;
  content_object: Devotional | MediaEpisode;
  content_type: 'devotional' | 'media_episode';
  added_at: string;
}

export interface Manual {
  id: string;
  title: string;
  description: string;
  cover_image?: string;
  file_url: string; // PDF
  is_series: boolean;
  series_id?: string;
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
  description: string;
  details: string; // Markdown/HTML
  location: string;
  start_date: string;
  end_date: string;
  registration_deadline?: string;
  price: number;
  image?: string;
  is_active: boolean;
  registration_count: number;
  available_seats?: number;
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