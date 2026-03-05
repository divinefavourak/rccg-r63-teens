import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import { FaPlus, FaMinus, FaArrowLeft } from "react-icons/fa";
import { Users, Calendar, MapPin, RefreshCw, ChevronRight } from "lucide-react";

const PROVINCE_LABELS: Record<string, string> = {
  lagos_province_9:   'Lagos Province 9',
  lagos_province_28:  'Lagos Province 28',
  lagos_province_69:  'Lagos Province 69',
  lagos_province_84:  'Lagos Province 84',
  lagos_province_86:  'Lagos Province 86',
  lagos_province_104: 'Lagos Province 104',
  regional_hq:        'Regional Headquarter',
};

type CategoryKey = 'toddlers' | 'children' | 'pre_teens' | 'teens';

const CATEGORIES: { id: CategoryKey; label: string; age: number; prefix: string }[] = [
  { id: 'toddlers',  label: 'Toddlers (2–5 yrs)',    age: 3,  prefix: 'Toddler'  },
  { id: 'children',  label: 'Children (6–8 yrs)',     age: 7,  prefix: 'Child'    },
  { id: 'pre_teens', label: 'Pre-Teens (9–12 yrs)',  age: 11, prefix: 'Pre-Teen' },
  { id: 'teens',     label: 'Teens (13–19 yrs)',      age: 15, prefix: 'Teen'     },
];

interface EventOption {
  id: string;
  title: string;
  start_datetime: string;
  venue: string;
  registration_status: string;
  is_free: boolean;
  price: number | null;
  registration_count: number;
  max_attendees: number | null;
  min_age: number | null;
  max_age: number | null;
}

const BulkRegister = () => {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const province     = (user as any)?.province || '';
  const provinceLabel = PROVINCE_LABELS[province] || province?.replace(/_/g, ' ') || '';

  // Events
  const [events, setEvents]               = useState<EventOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');

  // Coordinator details (editable, pre-filled from profile)
  const [coordinatorName,  setCoordinatorName]  = useState((user as any)?.name || (user as any)?.username || '');
  const [coordinatorPhone, setCoordinatorPhone] = useState((user as any)?.phone || '');
  const [coordinatorEmail, setCoordinatorEmail] = useState((user as any)?.email || '');
  const [parish, setParish] = useState((user as any)?.parish || '');

  // Category counters
  const [counts, setCounts] = useState<Record<CategoryKey, number>>({
    toddlers: 0, children: 0, pre_teens: 0, teens: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch open events
  useEffect(() => {
    api.get('/events/events/?status=published')
      .then(({ data }) => {
        const list: EventOption[] = Array.isArray(data) ? data : (data.results || []);
        const open = list.filter(e => e.registration_status === 'open');
        setEvents(open);
        if (open.length === 1) setSelectedEventId(open[0].id);
      })
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoadingEvents(false));
  }, []);

  const totalAttendees = Object.values(counts).reduce((a, b) => a + b, 0);
  const selectedEvent  = events.find(e => e.id === selectedEventId);

  const updateCount = (cat: CategoryKey, delta: number) =>
    setCounts(prev => ({ ...prev, [cat]: Math.max(0, prev[cat] + delta) }));

  const setManualCount = (cat: CategoryKey, val: string) =>
    setCounts(prev => ({ ...prev, [cat]: Math.max(0, parseInt(val) || 0) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId)        return toast.error('Please select an event');
    if (totalAttendees === 0)    return toast.error('Please add at least one attendee');
    if (!coordinatorName.trim()) return toast.error('Coordinator name is required');
    if (!coordinatorPhone.trim()) return toast.error('Coordinator phone is required');
    if (!coordinatorEmail.trim()) return toast.error('Coordinator email is required');
    if (!parish.trim())          return toast.error('Parish is required');
    if (!province)               return toast.error('Your account has no province assigned — contact admin.');

    setIsSubmitting(true);

    // Build registration payloads — each needs a unique email per event
    const ts = Date.now();
    const registrations: any[] = [];
    CATEGORIES.forEach(cat => {
      const count = counts[cat.id];
      for (let i = 1; i <= count; i++) {
        registrations.push({
          attendee_name:     `${parish} ${cat.prefix} ${i}`,
          attendee_email:    `bulk.${ts}.${cat.id}.${i}@noreply.rccg.ng`,
          attendee_phone:    coordinatorPhone,
          attendee_age:      cat.age,
          attendee_province: province,
          attendee_parish:   parish,
          attendee_department: 'Bulk Registration',
          guardian_name:         coordinatorName,
          guardian_phone:        coordinatorPhone,
          guardian_email:        coordinatorEmail,
          guardian_relationship: 'coordinator',
          guardian_consent:      true,
          medical_conditions:    'None',
          medications:           'None',
        });
      }
    });

    const loadingToast = toast.loading(`Registering ${totalAttendees} attendee${totalAttendees !== 1 ? 's' : ''}…`);
    let created = 0;
    let failed  = 0;

    for (const reg of registrations) {
      try {
        await api.post(`/events/events/${selectedEventId}/register/`, reg);
        created++;
      } catch {
        failed++;
      }
    }

    toast.dismiss(loadingToast);
    setIsSubmitting(false);

    if (created > 0) {
      toast.success(`${created} attendee${created !== 1 ? 's' : ''} registered!${failed > 0 ? ` (${failed} failed — check age limits or capacity)` : ''}`);
      navigate('/coordinator/dashboard');
    } else {
      toast.error('All registrations failed. The event may be full, closed, or outside the allowed age range.');
    }
  };

  // Capacity display for selected event
  const pct = selectedEvent?.max_attendees
    ? Math.min(((selectedEvent.registration_count || 0) / selectedEvent.max_attendees) * 100, 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />

      <div className="container mx-auto px-4 pt-28 pb-16 max-w-3xl">

        {/* Back */}
        <div className="mb-6">
          <Link
            to="/coordinator/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <FaArrowLeft size={12} /> Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1">
            Coordinator Portal
          </p>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Bulk Registration</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Register multiple attendees for your province
            {provinceLabel && <> — <span className="font-semibold">{provinceLabel}</span></>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. Event Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar size={17} className="text-primary-500" /> Select Event
            </h2>

            {loadingEvents ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <RefreshCw size={14} className="animate-spin" /> Loading events…
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No events are currently open for registration.
              </p>
            ) : (
              <div className="space-y-3">
                {events.map(ev => {
                  const evPct = ev.max_attendees
                    ? Math.min(((ev.registration_count || 0) / ev.max_attendees) * 100, 100)
                    : 0;
                  const isSelected = selectedEventId === ev.id;
                  return (
                    <label
                      key={ev.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="event"
                        value={ev.id}
                        checked={isSelected}
                        onChange={() => setSelectedEventId(ev.id)}
                        className="mt-0.5 accent-primary-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{ev.title}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(ev.start_datetime).toLocaleDateString(undefined, {
                              weekday: 'short', month: 'short', day: 'numeric'
                            })}
                          </span>
                          {ev.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin size={11} /> {ev.venue}
                            </span>
                          )}
                          {(ev.min_age || ev.max_age) && (
                            <span className="font-medium text-primary-600 dark:text-primary-400">
                              Ages {ev.min_age ?? '?'}–{ev.max_age ?? '?'}
                            </span>
                          )}
                        </div>
                        {ev.max_attendees ? (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">{ev.registration_count || 0}/{ev.max_attendees} registered</span>
                              <span className={evPct > 80 ? 'text-red-500 font-bold' : 'text-gray-500'}>
                                {Math.round(evPct)}% full
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${evPct > 80 ? 'bg-red-500' : 'bg-primary-500'}`}
                                style={{ width: `${evPct}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Coordinator Details */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users size={17} className="text-primary-500" /> Coordinator Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { label: 'Coordinator Name',     value: coordinatorName,  set: setCoordinatorName,  placeholder: 'Full name' },
                { label: 'Phone Number',          value: coordinatorPhone, set: setCoordinatorPhone, placeholder: '08012345678' },
                { label: 'Email',                 value: coordinatorEmail, set: setCoordinatorEmail, placeholder: 'coordinator@example.com' },
                { label: 'Parish / Local Church', value: parish,           set: setParish,           placeholder: 'e.g. RCCG Victory Parish' },
              ] as { label: string; value: string; set: (v: string) => void; placeholder: string }[]).map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                    {label}
                  </label>
                  <input
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                  Province
                </label>
                <div className="px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300">
                  {provinceLabel || <span className="text-red-500">Not assigned — contact admin</span>}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Category Counters */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ChevronRight size={17} className="text-primary-500" /> Attendee Categories
            </h2>

            {selectedEvent?.min_age || selectedEvent?.max_age ? (
              <div className="mb-4 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-xs text-yellow-800 dark:text-yellow-300 font-medium">
                This event accepts ages {selectedEvent.min_age ?? '?'}–{selectedEvent.max_age ?? '?'}. Registrations outside this range will fail.
              </div>
            ) : null}

            <div className="space-y-3">
              {CATEGORIES.map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{cat.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Typical age: {cat.age}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCount(cat.id, -1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30"
                      disabled={counts[cat.id] === 0}
                    >
                      <FaMinus size={11} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={counts[cat.id] || ''}
                      placeholder="0"
                      onChange={e => setManualCount(cat.id, e.target.value)}
                      className="w-14 h-9 text-center text-lg font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateCount(cat.id, 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      <FaPlus size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + Submit */}
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-0.5">Total Attendees</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">{totalAttendees}</p>
                {selectedEvent && (
                  <p className="text-xs text-gray-400 mt-1">
                    Event: <span className="font-semibold text-gray-600 dark:text-gray-300">{selectedEvent.title}</span>
                    {selectedEvent.max_attendees && (
                      <> · {pct.toFixed(0)}% capacity used</>
                    )}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || totalAttendees === 0 || !selectedEventId || loadingEvents}
                className="flex items-center gap-2 px-7 py-3 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? <RefreshCw size={15} className="animate-spin" />
                  : <Users size={15} />
                }
                {isSubmitting ? 'Registering…' : `Register ${totalAttendees || ''} Attendee${totalAttendees !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

        </form>
      </div>

      <Footer />
    </div>
  );
};

export default BulkRegister;
