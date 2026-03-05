import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import {
  FaQrcode, FaKeyboard, FaCheckCircle, FaTimesCircle,
  FaCamera, FaStopCircle, FaSearch, FaUser, FaTag,
  FaMapMarkerAlt, FaBirthdayCake, FaExclamationTriangle
} from 'react-icons/fa';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

type Tab = 'qr' | 'manual';

interface TicketResult {
  id: string;
  ticket_id: string;
  full_name: string;
  age: number;
  category: string;
  category_display?: string;
  gender: string;
  status: string;
  province: string;
  zone: string;
  parish: string;
}

interface CheckInResult {
  success: boolean;
  message: string;
  check_in_time?: string;
  ticket?: {
    ticket_id: string;
    full_name: string;
    category: string;
  };
}

function getAuthHeader() {
  try {
    const stored = localStorage.getItem('rccg_user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u?.token) return { Authorization: `Bearer ${u.token}` };
    }
  } catch {}
  return {};
}

export default function CheckIn() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('qr');
  const [ticketInput, setTicketInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [barcodeSupported, setBarcodeSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedRef = useRef('');

  // Check BarcodeDetector support
  useEffect(() => {
    setBarcodeSupported('BarcodeDetector' in window);
  }, []);

  // Parse QR content — format: RCCG_TICKET:{ticket_id}:{name}:{status}
  const parseQR = (raw: string): string => {
    if (raw.startsWith('RCCG_TICKET:')) {
      const parts = raw.split(':');
      return parts[1] ?? raw;
    }
    return raw.trim();
  };

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setCameraError('');
    setTicket(null);
    setCheckInResult(null);
    lastScannedRef.current = '';

    if (!barcodeSupported) {
      setCameraError('QR scanning is not supported in this browser. Use Chrome or Edge, or enter the ticket ID manually.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);

      // Poll every 500ms
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue as string;
            const ticketId = parseQR(raw);
            if (ticketId && ticketId !== lastScannedRef.current) {
              lastScannedRef.current = ticketId;
              stopCamera();
              await lookupTicket(ticketId);
            }
          }
        } catch {}
      }, 500);
    } catch (err: any) {
      const msg = err?.message?.includes('Permission')
        ? 'Camera access denied. Please allow camera access and try again.'
        : 'Could not start camera. Use manual entry instead.';
      setCameraError(msg);
    }
  };

  const lookupTicket = async (ticketId: string) => {
    if (!ticketId.trim()) return;
    setIsLookingUp(true);
    setTicket(null);
    setCheckInResult(null);
    try {
      const res = await axios.get(`${API_URL}/tickets/`, {
        params: { search: ticketId.trim() },
        headers: getAuthHeader(),
      });
      const results: TicketResult[] = res.data?.results ?? res.data ?? [];
      // Exact match on ticket_id first, then first result
      const match = results.find(t => t.ticket_id === ticketId.trim()) ?? results[0];
      if (match) {
        setTicket(match);
      } else {
        toast.error('No ticket found with that ID.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to look up ticket.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    lookupTicket(ticketInput);
  };

  const handleCheckIn = async () => {
    if (!ticket) return;
    setIsCheckingIn(true);
    try {
      const res = await axios.post(
        `${API_URL}/tickets/${ticket.id}/check-in/`,
        { method: 'manual' },
        { headers: getAuthHeader() }
      );
      const data: CheckInResult = res.data;
      setCheckInResult(data);
      if (data.success) {
        toast.success(`${ticket.full_name} checked in!`);
      } else {
        toast(`${data.message}`, { icon: '⚠️' });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Check-in failed.';
      toast.error(msg);
      setCheckInResult({ success: false, message: msg });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const reset = () => {
    setTicket(null);
    setCheckInResult(null);
    setTicketInput('');
    lastScannedRef.current = '';
    stopCamera();
  };

  const statusColor: Record<string, string> = {
    approved: 'bg-green-500/20 text-green-400 border-green-500/40',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/40',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Event Check-In</h1>
            <p className="text-xs text-gray-400 mt-0.5">{user?.first_name} {user?.last_name}</p>
          </div>
          <div className="bg-primary-600 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {user?.role}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Tabs */}
        {!ticket && !checkInResult && (
          <div className="flex rounded-xl overflow-hidden border border-gray-800">
            {([['qr', FaQrcode, 'Scan QR'], ['manual', FaKeyboard, 'Enter ID']] as const).map(
              ([key, Icon, label]) => (
                <button
                  key={key}
                  onClick={() => { setTab(key as Tab); reset(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors
                    ${tab === key ? 'bg-primary-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
                >
                  <Icon className="text-base" /> {label}
                </button>
              )
            )}
          </div>
        )}

        {/* QR SCAN TAB */}
        {tab === 'qr' && !ticket && !checkInResult && (
          <div className="space-y-4">
            {!cameraActive ? (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 flex flex-col items-center gap-4">
                <FaQrcode className="text-6xl text-primary-400" />
                <p className="text-gray-300 text-center text-sm">
                  Point the camera at the attendee's QR code to check them in instantly.
                </p>
                {!barcodeSupported && (
                  <div className="flex items-start gap-2 bg-yellow-900/30 border border-yellow-700/40 rounded-xl p-3 text-xs text-yellow-300 w-full">
                    <FaExclamationTriangle className="mt-0.5 shrink-0" />
                    <span>QR scanning requires Chrome or Edge. Use the "Enter ID" tab on other browsers.</span>
                  </div>
                )}
                {cameraError && (
                  <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/40 rounded-xl p-3 text-xs text-red-300 w-full">
                    <FaTimesCircle className="mt-0.5 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
                <button
                  onClick={startCamera}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <FaCamera /> Start Camera
                </button>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-[4/3] object-cover"
                />
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 border-2 border-primary-400 rounded-2xl opacity-80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                  <span className="text-xs text-primary-300 animate-pulse">Scanning…</span>
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium"
                  >
                    <FaStopCircle /> Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MANUAL ENTRY TAB */}
        {tab === 'manual' && !ticket && !checkInResult && (
          <form onSubmit={handleManualLookup} className="space-y-3">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Ticket ID or Full Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticketInput}
                  onChange={e => setTicketInput(e.target.value)}
                  placeholder="e.g. TKT-202503-00001"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!ticketInput.trim() || isLookingUp}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 rounded-xl transition-colors"
                >
                  {isLookingUp
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <FaSearch />
                  }
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TICKET FOUND */}
        {ticket && !checkInResult && (
          <div className="space-y-4">
            {/* Person card */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-900/40 to-gray-900 px-5 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-700/40 flex items-center justify-center">
                      <FaUser className="text-primary-300" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">{ticket.full_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{ticket.ticket_id}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border uppercase ${statusColor[ticket.status] ?? 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                    {ticket.status}
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <FaTag className="text-primary-400 shrink-0" />
                  <span>{ticket.category_display ?? ticket.category}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaBirthdayCake className="text-primary-400 shrink-0" />
                  <span>Age {ticket.age}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300 col-span-2">
                  <FaMapMarkerAlt className="text-primary-400 shrink-0" />
                  <span className="truncate">{ticket.province?.replace(/_/g, ' ')}, {ticket.parish}</span>
                </div>
              </div>
            </div>

            {/* Warning if not approved */}
            {ticket.status !== 'approved' && (
              <div className="flex items-start gap-2 bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-4 py-3 text-sm text-yellow-300">
                <FaExclamationTriangle className="mt-0.5 shrink-0" />
                <span>This ticket is <strong>{ticket.status}</strong>. Only approved tickets can be checked in.</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckIn}
                disabled={isCheckingIn || ticket.status !== 'approved'}
                className="flex-2 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isCheckingIn
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Checking in…</>
                  : <><FaCheckCircle /> Check In</>
                }
              </button>
            </div>
          </div>
        )}

        {/* CHECK-IN RESULT */}
        {checkInResult && ticket && (
          <div className="space-y-4">
            {checkInResult.success ? (
              <div className="bg-green-900/30 border border-green-600/40 rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
                <FaCheckCircle className="text-5xl text-green-400" />
                <div>
                  <p className="text-xl font-bold text-white">{ticket.full_name}</p>
                  <p className="text-sm text-green-300 mt-1">Successfully checked in</p>
                  {checkInResult.check_in_time && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      {new Date(checkInResult.check_in_time).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div className="w-full border-t border-green-800/40 pt-3 mt-1 text-xs text-gray-400 space-y-1">
                  <p>{ticket.ticket_id} · {ticket.category_display ?? ticket.category}</p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
                <FaExclamationTriangle className="text-5xl text-yellow-400" />
                <div>
                  <p className="text-xl font-bold text-white">{ticket.full_name}</p>
                  <p className="text-sm text-yellow-300 mt-1">{checkInResult.message}</p>
                </div>
              </div>
            )}

            <button
              onClick={reset}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Check In Next Person
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
