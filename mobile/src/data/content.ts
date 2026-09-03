/**
 * The app's content, as static fixtures.
 *
 * Everything the screens render comes from here rather than from literals
 * scattered through JSX. That is deliberate: when this is wired to the Django
 * API (`backend/`), each exported constant becomes a query and the screens do
 * not change shape — only where they get their data from.
 *
 * Types are written to match the backend serialisers rather than the Figma
 * mock, so that swap stays a one-file change.
 */

// ─── Today ─────────────────────────────────────────────────────────────────

export interface Devotional {
  id: string;
  day: number;
  date: string;
  title: string;
  preview: string;
  body: string[];
  memoryVerse: { text: string; reference: string; translation: string };
  reflection: string;
  prayer: string;
}

export const TODAY_DEVOTIONAL: Devotional = {
  id: 'd-2026-09-02',
  day: 23,
  date: 'Tuesday, 2 Sep',
  title: 'Walking in Purpose',
  preview:
    "Have you ever wondered why you're here — what you were put on earth to do? It's a question every teenager asks, and it's one God has already answered.",
  body: [
    "Have you ever wondered why you're here — what you were put on earth to do? It's a question every teenager asks, and it's one God has already answered.",
    'Jeremiah 29:11 was written to a people in exile — people who felt lost, far from home, unsure of their future. God spoke to them anyway. His word was simple: I have not forgotten you. I have plans for you. Good plans.',
    "Purpose doesn't always announce itself loudly. Most of the time, it grows quietly — like a seed in the dark that nobody can see but God. Your job is not to figure everything out. Your job is to stay rooted in Him, to keep showing up, to keep reading, praying, and trusting.",
    "Today, wherever you are — whether you feel confident or confused, seen or invisible — know this: you are not an accident. You are not a mistake. You were made with intention, and God's plan for your life is already in motion.",
  ],
  memoryVerse: {
    text: '"For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future."',
    reference: 'Jeremiah 29:11',
    translation: 'NLT',
  },
  reflection:
    'Where in your life right now do you find it hardest to trust that God has a good plan? Write one honest sentence about it.',
  prayer:
    'Lord, I give you my questions and my unknowns. Help me to trust that your plans are good, even when I cannot see them. Amen.',
};

export const VERSE_OF_THE_DAY = {
  text: '"I can do all things through Christ who strengthens me."',
  reference: 'Philippians 4:13',
};

export const DAILY_CHALLENGE = [
  { id: 'c1', label: 'Read your devo' },
  { id: 'c2', label: 'Pray for a friend' },
];

export const PROFILE = {
  firstName: 'Temi',
  fullName: 'Adaeze Okafor',
  parish: 'RCCG Victory House, Lagos',
  streak: 7,
  bestStreak: 23,
  daysRead: 23,
  savedCount: 12,
};

/** Mon-first week; `done` days are behind, `today` is the current index. */
export const WEEK = {
  labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  todayIndex: 2,
  doneThrough: 1,
};

// ─── Bible ─────────────────────────────────────────────────────────────────

export const TRANSLATIONS = ['NLT', 'NIV', 'KJV', 'ESV', 'MSG'];

export const BOOKS = [
  'Genesis', 'Exodus', 'Psalms', 'Proverbs', 'Isaiah', 'Jeremiah', 'Matthew',
  'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', 'Philippians',
  'Colossians', '1 Timothy', 'Hebrews', 'James', '1 Peter', 'Revelation',
];

export interface Verse {
  n: number;
  text: string;
}

export const PASSAGE: { book: string; chapter: number; verses: Verse[] } = {
  book: 'John',
  chapter: 3,
  verses: [
    { n: 1, text: 'Now there was a Pharisee, a man named Nicodemus who was a member of the Jewish ruling council.' },
    { n: 2, text: 'He came to Jesus at night and said, "Rabbi, we know that you are a teacher who has come from God. For no one could perform the signs you are doing if God were not with him."' },
    { n: 3, text: 'Jesus replied, "Very truly I tell you, no one can see the kingdom of God unless they are born again."' },
    { n: 4, text: '"How can someone be born when they are old?" Nicodemus asked. "Surely they cannot enter a second time into their mother\'s womb to be born!"' },
    { n: 5, text: 'Jesus answered, "Very truly I tell you, no one can enter the kingdom of God unless they are born of water and the Spirit.' },
    { n: 6, text: 'Flesh gives birth to flesh, but the Spirit gives birth to spirit.' },
    { n: 7, text: "You should not be surprised at my saying, 'You must be born again.'" },
    { n: 8, text: 'The wind blows wherever it pleases. You hear its sound, but you cannot tell where it comes from or where it is going. So it is with everyone born of the Spirit."' },
    { n: 9, text: '"How can this be?" Nicodemus asked.' },
    { n: 10, text: '"You are Israel\'s teacher," said Jesus, "and do you not understand these things?' },
    { n: 11, text: 'Very truly I tell you, we speak of what we know, and we testify to what we have seen, but still you people do not accept our testimony.' },
    { n: 12, text: 'I have spoken to you of earthly things and you do not believe; how then will you believe if I speak of heavenly things?' },
    { n: 13, text: 'No one has ever gone into heaven except the one who came from heaven—the Son of Man.' },
    { n: 14, text: 'Just as Moses lifted up the snake in the wilderness, so the Son of Man must be lifted up,' },
    { n: 15, text: 'that everyone who believes may have eternal life in him."' },
    { n: 16, text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
    { n: 17, text: 'For God did not send his Son into the world to condemn the world, but to save the world through him.' },
    { n: 18, text: "Whoever believes in him is not condemned, but whoever does not believe stands condemned already because they have not believed in the name of God's one and only Son." },
    { n: 19, text: 'This is the verdict: Light has come into the world, but people loved darkness instead of light because their deeds were evil.' },
    { n: 20, text: 'Everyone who does evil hates the light, and will not come into the light for fear that their deeds will be exposed.' },
    { n: 21, text: 'But whoever lives by the truth comes into the light, so that it may be seen plainly that what they have done has been done in the sight of God.' },
  ],
};

// ─── Library ───────────────────────────────────────────────────────────────

export type LibraryItemType = 'devotional' | 'video' | 'podcast' | 'course';

export interface LibraryItem {
  id: string;
  title: string;
  type: LibraryItemType;
  author: string;
  duration: string;
  color: string;
  photoUrl: string;
  progress?: number;
}

export interface Shelf {
  id: string;
  title: string;
  items: LibraryItem[];
}

/**
 * Category tints are literal rather than tokenised: they are content
 * classification, not semantic UI colour, and the design system reserves
 * tokens for the latter.
 */
export const CATEGORIES = [
  { id: 'devotionals', label: 'Devotionals', emoji: '📖', bg: '#E8F3EC', tint: '#3A7D52' },
  { id: 'videos', label: 'Videos', emoji: '🎬', bg: '#FDF0DC', tint: '#C87A15' },
  { id: 'podcasts', label: 'Podcasts', emoji: '🎙️', bg: '#EEF0FD', tint: '#4A5CC8' },
  { id: 'courses', label: 'Courses', emoji: '🎓', bg: '#FDE8EE', tint: '#C83A6A' },
] as const;

export const FEATURED = {
  title: '30 Days of Prayer',
  subtitle: 'A guided prayer journey for teens',
  tag: 'Devotional Series',
  days: 30,
  progress: 23,
  color: '#3A7D52',
};

export const SHELVES: Shelf[] = [
  {
    id: 's1',
    title: 'New this week',
    items: [
      { id: '1', title: 'Identity in Christ', type: 'devotional', author: 'Pastor Tolu Adeyemi', duration: '5 min read', color: '#E8F3EC', photoUrl: 'https://images.unsplash.com/photo-1604882737206-8a000c03d8fe?w=320&h=180&fit=crop&auto=format&q=75' },
      { id: '2', title: 'When Fear Comes', type: 'video', author: 'Faith Tribe Team', duration: '12 min', color: '#FDF0DC', photoUrl: 'https://images.unsplash.com/photo-1522158637959-30385a09e0da?w=320&h=180&fit=crop&auto=format&q=75' },
      { id: '3', title: 'Praise Session: Gratitude', type: 'podcast', author: 'Melody Okafor', duration: '24 min', color: '#EEF0FD', photoUrl: 'https://images.unsplash.com/photo-1694055839308-97e8ae47f5a6?w=320&h=180&fit=crop&auto=format&q=75' },
      { id: '4', title: 'Faith Over Feelings', type: 'devotional', author: 'Adaora Nwosu', duration: '4 min read', color: '#FDE8EE', photoUrl: 'https://images.unsplash.com/photo-1553729784-e91953dec042?w=320&h=180&fit=crop&auto=format&q=75' },
    ],
  },
  {
    id: 's2',
    title: 'Continue learning',
    items: [
      { id: '5', title: 'Who Am I? A Course on Identity', type: 'course', author: 'Region 63 Team', duration: '6 sessions', color: '#F9F6F1', photoUrl: 'https://images.unsplash.com/photo-1657268376463-919a6f4c6657?w=320&h=180&fit=crop&auto=format&q=75', progress: 50 },
      { id: '6', title: 'The Armour of God', type: 'devotional', author: 'Bishop Emeka Chukwu', duration: '7 min read', color: '#E8F3EC', photoUrl: 'https://images.unsplash.com/photo-1497621122273-f5cfb6065c56?w=320&h=180&fit=crop&auto=format&q=75', progress: 30 },
    ],
  },
];

// ─── Tribe ─────────────────────────────────────────────────────────────────

export interface TribeEvent {
  id: string;
  title: string;
  date: string;
  dateShort: string;
  day: string;
  month: string;
  time: string;
  location: string;
  price: string | null;
  category: string;
  desc: string;
  registered: boolean;
  photoColor: string;
  photoUrl: string;
  capacity: number;
  registeredCount: number;
}

export const EVENTS: TribeEvent[] = [
  {
    id: 'e1',
    title: 'RCCG Region 63 Teen Camp 2026',
    date: 'Saturday, 12 September 2026',
    dateShort: '12 Sep',
    day: '12',
    month: 'SEP',
    time: '8:00 AM – 5:00 PM',
    location: 'RCCG Camp Ground, Mowe, Ogun State',
    price: null,
    category: 'Annual Camp',
    desc: 'Three days of worship, teaching, games and fellowship with teens from across Region 63. Come with your Bible, a sleeping bag, and an open heart. Meals provided. This is the biggest event of the year — do not miss it.',
    registered: false,
    photoColor: '#2D6340',
    photoUrl: 'https://images.unsplash.com/photo-1657268376463-919a6f4c6657?w=480&h=240&fit=crop&auto=format&q=75',
    capacity: 500,
    registeredCount: 312,
  },
  {
    id: 'e2',
    title: 'Teen Sunday – Identity Edition',
    date: 'Sunday, 7 September 2026',
    dateShort: '7 Sep',
    day: '7',
    month: 'SEP',
    time: '9:00 AM – 12:30 PM',
    location: 'RCCG Victory House, Lagos',
    price: null,
    category: 'Worship Service',
    desc: "This month's Teen Sunday is built around the question: Who am I? Guest speaker Pastor Kemi Adeyemi will walk us through what God says about your identity. Expect worship, small groups, and great food after service.",
    registered: true,
    photoColor: '#7B4FA8',
    photoUrl: 'https://images.unsplash.com/photo-1589707181684-24a34853641d?w=480&h=240&fit=crop&auto=format&q=75',
    capacity: 200,
    registeredCount: 178,
  },
  {
    id: 'e3',
    title: 'Bible Quiz Championship',
    date: 'Saturday, 20 September 2026',
    dateShort: '20 Sep',
    day: '20',
    month: 'SEP',
    time: '10:00 AM – 3:00 PM',
    location: 'RCCG House of Grace, Abuja',
    price: '₦500',
    category: 'Competition',
    desc: 'Test your knowledge of the scriptures against the best teen Bible scholars in Region 63. Three rounds covering Old Testament, New Testament and Psalms & Proverbs. Top three winners receive prizes and recognition certificates.',
    registered: false,
    photoColor: '#C87A15',
    photoUrl: 'https://images.unsplash.com/photo-1497621122273-f5cfb6065c56?w=480&h=240&fit=crop&auto=format&q=75',
    capacity: 80,
    registeredCount: 54,
  },
  {
    id: 'e4',
    title: 'Worship Night: Still Waters',
    date: 'Friday, 26 September 2026',
    dateShort: '26 Sep',
    day: '26',
    month: 'SEP',
    time: '6:00 PM – 9:00 PM',
    location: 'RCCG Restoration House, Port Harcourt',
    price: null,
    category: 'Worship',
    desc: 'An evening of unhurried, intimate worship for Region 63 teens. Live band, devotional readings, and open prayer time. Bring a friend. Dress comfortably.',
    registered: false,
    photoColor: '#1D6FA4',
    photoUrl: 'https://images.unsplash.com/photo-1522158637959-30385a09e0da?w=480&h=240&fit=crop&auto=format&q=75',
    capacity: 150,
    registeredCount: 67,
  },
];

// ─── Me ────────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  name: string;
  date: string;
  location: string;
  code: string;
}

export const MY_TICKETS: Ticket[] = [
  { id: '1', name: 'Teen Camp 2026', date: 'Aug 14–17, 2026', location: 'Redemption Camp, Lagos', code: 'TRIBE-ADZ-2026-0312' },
  { id: '2', name: 'Identity Edition Sunday', date: 'Sep 7, 2026', location: 'RCCG House of Praise, Abuja', code: 'TRIBE-ADZ-2026-0428' },
  { id: '3', name: 'Bible Quiz Regional Finals', date: 'Oct 3, 2026', location: 'RCCG Lighthouse, PH', code: 'TRIBE-ADZ-2026-0519' },
];

export const PROFILE_COVER =
  'https://images.unsplash.com/photo-1613578519724-22fdb5d06388?w=480&h=160&fit=crop&auto=format&q=75';

export const JOURNEY = { title: '30 Days of Prayer', day: 23, total: 30 };

// ─── Notifications ─────────────────────────────────────────────────────────

export type NotificationGroup = 'today' | 'week' | 'earlier';

export interface AppNotification {
  id: string;
  emoji: string;
  iconBg: string;
  title: string;
  time: string;
  unread: boolean;
  group: NotificationGroup;
}

export const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', emoji: '🌱', iconBg: '#E8F3EC', title: 'New devotional available — Day 24 drops tomorrow morning.', time: '2m ago', unread: true, group: 'today' },
  { id: 'n2', emoji: '🔥', iconBg: '#FDF5E4', title: "Keep your streak alive — there's still time for today's devo.", time: '1h ago', unread: true, group: 'today' },
  { id: 'n3', emoji: '📅', iconBg: '#EEF0FD', title: 'Teen Camp 2026 — registration closes in 3 days. Secure your spot.', time: '2d ago', unread: true, group: 'week' },
  { id: 'n4', emoji: '✦', iconBg: '#E8F3EC', title: 'Identity Edition Sunday — your registration is confirmed.', time: '3d ago', unread: false, group: 'week' },
  { id: 'n5', emoji: '📖', iconBg: '#F2EAE0', title: 'New series added to Library: "Who Am I?" — 6 sessions.', time: '5d ago', unread: false, group: 'week' },
  { id: 'n6', emoji: '🎉', iconBg: '#FDF5E4', title: 'You completed Day 21 — great consistency! Keep growing.', time: '1w ago', unread: false, group: 'earlier' },
];

export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroup, string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};
