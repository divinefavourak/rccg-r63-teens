import { motion } from "framer-motion";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { generatePDF, generateImage } from "../utils/pdfGenerator";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  FaDownload,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaUser,
  FaPhone,
  FaFileImage,
  FaCalendar,
} from "react-icons/fa";
import rccgLogo from "../assets/logo.jpg";
import faithLogo from "../assets/faith_logo.jpg";

// ── Normalised shape used by the card ─────────────────────────────────────────
interface DisplayReg {
  id: string;
  registrationId: string;
  attendeeName: string;
  category: string;
  parish: string;
  province: string;
  phone: string;
  status: string;
  paymentStatus: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending:    'border-amber-200  bg-amber-50  text-amber-700  dark:bg-amber-900/30  dark:border-amber-800  dark:text-amber-400',
  confirmed:  'border-green-200  bg-green-50  text-green-700  dark:bg-green-900/30  dark:border-green-800  dark:text-green-400',
  checked_in: 'border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400',
  waitlisted: 'border-blue-200   bg-blue-50   text-blue-700   dark:bg-blue-900/30   dark:border-blue-800   dark:text-blue-400',
  cancelled:  'border-red-200    bg-red-50    text-red-700    dark:bg-red-900/30    dark:border-red-800    dark:text-red-400',
  // legacy ticket statuses
  approved:   'border-green-200  bg-green-50  text-green-700  dark:bg-green-900/30  dark:border-green-800  dark:text-green-400',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Attended',
  waitlisted: 'Waitlisted', cancelled: 'Cancelled',
  approved: 'Approved', rejected: 'Rejected',
};

// Maps any incoming data (new EventRegistration or old Ticket) → DisplayReg
const normalize = (raw: any): DisplayReg => {
  // ── New EventRegistration shape ──────────────────────────────────────────
  if (raw.registration_id || raw.attendee_name) {
    const ed = raw.event_detail;
    return {
      id:             raw.id,
      registrationId: raw.registration_id ?? raw.id,
      attendeeName:   raw.attendee_name ?? '',
      category:       raw.attendee_category ?? '',
      parish:         raw.attendee_parish ?? '',
      province:       raw.attendee_province ?? '',
      phone:          raw.attendee_phone ?? raw.guardian_phone ?? '',
      status:         raw.status ?? 'pending',
      paymentStatus:  raw.payment_status ?? '',
      eventTitle: ed?.title ?? EVENT_DETAILS.title,
      eventDate: ed?.start_datetime
        ? new Date(ed.start_datetime).toLocaleDateString(undefined, {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          })
        : EVENT_DETAILS.date,
      eventVenue: ed?.venue
        ? `${ed.venue}${ed.city ? `, ${ed.city}` : ''}`
        : EVENT_DETAILS.location,
    };
  }

  // ── Old Ticket shape (backward compat) ───────────────────────────────────
  return {
    id:             raw.id ?? '',
    registrationId: raw.ticketId ?? raw.ticket_id ?? raw.id ?? '',
    attendeeName:   raw.fullName  ?? raw.full_name ?? '',
    category:       raw.category  ?? '',
    parish:         raw.parish    ?? '',
    province:       raw.province  ?? '',
    phone:          raw.phone     ?? raw.parentPhone ?? '',
    status:         raw.status    ?? 'pending',
    paymentStatus:  raw.payment_status ?? '',
    eventTitle: EVENT_DETAILS.title,
    eventDate:  EVENT_DETAILS.date,
    eventVenue: EVENT_DETAILS.location,
  };
};

// ── Component ──────────────────────────────────────────────────────────────────
const TicketPreview = () => {
  const location    = useLocation();
  const [searchParams] = useSearchParams();
  const [reg, setReg]  = useState<DisplayReg | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Try router state first (fastest path — no network round-trip)
    const stateData = location.state?.registration ?? location.state?.ticket;
    if (stateData) {
      setReg(normalize(stateData));
      setLoading(false);
      return;
    }

    // 2. URL param lookup — ?id= / ?registration_id= / ?ticket_id=
    const idParam =
      searchParams.get('id') ??
      searchParams.get('registration_id') ??
      searchParams.get('ticket_id');

    if (idParam) {
      api.get(`/events/registrations/?search=${encodeURIComponent(idParam)}`)
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : (data.results ?? []);
          if (list.length > 0) {
            setReg(normalize(list[0]));
          } else {
            toast.error('Registration not found.');
          }
        })
        .catch(() => toast.error('Could not fetch registration details.'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [location.state, searchParams]);

  const handleDownloadPDF   = () =>
    generatePDF('ticket-card-content', `RCCG-Pass-${reg?.registrationId ?? 'ticket'}.pdf`);
  const handleDownloadImage = () =>
    generateImage('ticket-card-content', `RCCG-Pass-${reg?.registrationId ?? 'ticket'}.png`);

  const getCategoryLabel = (cat: string) =>
    cat ? cat.replace(/_/g, ' ').toUpperCase() : '';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-primary-500" />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!reg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-5 px-4">
        <p className="text-gray-600 dark:text-gray-400 text-lg font-semibold">Registration not found.</p>
        <div className="flex gap-3">
          <Link to="/events"    className="btn-primary px-6 py-3">Browse Events</Link>
          <Link to="/dashboard" className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            My Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const statusClass = STATUS_COLOR[reg.status] ?? STATUS_COLOR.pending;
  const statusLabel = STATUS_LABEL[reg.status] ?? reg.status;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
      <Navbar />

      <div className="pt-28 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Page heading */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
              YOUR <span className="text-primary-600 dark:text-primary-400">ACCESS PASS</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Present this pass at the venue entrance for check-in.
            </p>
          </div>

          {/* ── Ticket card (captured by html2canvas) ──────────────────────── */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1,    opacity: 1 }}
            transition={{ delay: 0.2 }}
            id="ticket-card-content"
            className="relative bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 p-8"
          >
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
              <img src={rccgLogo} alt="" className="w-80 h-80 object-contain" />
            </div>

            {/* Confirmation overlay */}
            {(reg.status === 'confirmed' || reg.status === 'checked_in') && (
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <div className="opacity-[0.06] transform -rotate-12">
                  <FaCheckCircle className="text-[280px] text-primary-600" />
                </div>
              </div>
            )}

            <div className="relative z-10">
              {/* Header row */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 dark:border-gray-700 pb-6 mb-6">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="flex -space-x-3">
                    <img src={rccgLogo}   alt="RCCG"       className="w-14 h-14 rounded-full border-2 border-white shadow-md bg-white object-cover z-10" />
                    <img src={faithLogo} alt="Faith Tribe" className="w-14 h-14 rounded-full border-2 border-white shadow-md bg-white object-cover" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                      {reg.eventTitle}
                    </h2>
                    <p className="text-primary-600 dark:text-primary-400 font-bold tracking-widest text-xs mt-1">
                      RCCG REGION 63 JUNIOR CHURCH
                    </p>
                  </div>
                </div>

                <div className={`px-5 py-1.5 rounded-full border font-bold uppercase tracking-wider text-sm shrink-0 ${statusClass}`}>
                  {statusLabel}
                </div>
              </div>

              {/* Body */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* QR code */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center order-2 md:order-1">
                  <QRCodeSVG
                    value={reg.registrationId}
                    size={155}
                    level="H"
                    fgColor="#1fa055"
                  />
                  <p className="mt-3 font-mono font-bold text-sm text-gray-900 tracking-widest text-center break-all">
                    {reg.registrationId}
                  </p>
                </div>

                {/* Attendee details */}
                <div className="md:col-span-2 space-y-5 order-1 md:order-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <FaUser className="text-primary-500" /> Attendee
                      </p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{reg.attendeeName}</p>
                    </div>
                    {reg.category && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Category</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{getCategoryLabel(reg.category)}</p>
                      </div>
                    )}
                    {reg.parish && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Parish</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{reg.parish}</p>
                      </div>
                    )}
                    {reg.phone && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contact</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                          <FaPhone className="text-xs text-gray-400" /> {reg.phone}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Event info bar */}
                  <div className="bg-primary-600 text-white p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <FaCalendar className="shrink-0 opacity-80 text-sm" />
                      <div>
                        <p className="text-[10px] opacity-70 uppercase font-bold tracking-wider">Date</p>
                        <p className="font-bold text-sm leading-tight">{reg.eventDate}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] opacity-70 uppercase font-bold tracking-wider">Venue</p>
                      <p className="font-bold text-sm flex items-center justify-end gap-1 leading-tight">
                        <FaMapMarkerAlt className="shrink-0" /> {reg.eventVenue}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Info strip */}
          <div className="mt-6 bg-blue-50 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-500/20 rounded-xl p-5">
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['Keep This Pass Safe', 'Present at Entry', 'QR Code Required', 'Non-Transferable'].map(item => (
                <li key={item} className="flex items-center gap-2 bg-white/50 dark:bg-black/20 p-2 rounded-lg text-sm text-blue-700 dark:text-blue-200/80">
                  <FaCheckCircle className="text-blue-600 shrink-0 text-xs" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Download buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <button
              onClick={handleDownloadImage}
              className="px-8 py-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <FaFileImage /> Save as Image
            </button>
            <button
              onClick={handleDownloadPDF}
              className="btn-primary py-3 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg"
            >
              <FaDownload /> Download PDF
            </button>
          </div>

          <div className="text-center mt-6">
            <Link
              to="/"
              className="text-sm font-bold text-gray-500 dark:text-white/40 hover:text-primary-600 dark:hover:text-white transition-colors"
            >
              ← Return to Home
            </Link>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default TicketPreview;
