import { motion } from "framer-motion";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { generatePDF, generateImage } from "../utils/pdfGenerator";
import { ticketService } from "../services/ticketService";
import toast from "react-hot-toast";
import {
  FaDownload,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaUser,
  FaPhone,
  FaFileImage,
  FaUpload
} from "react-icons/fa";
import rccgLogo from "../assets/logo.jpg";
import faithLogo from "../assets/faith_logo.jpg";

import { type Ticket } from "../types";

const TicketPreview = () => {
  const location = useLocation();
  // const navigate = useNavigate(); // Unused
  const [searchParams] = useSearchParams();
  const [ticketData, setTicketData] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const init = async () => {
      const stateTicket = location.state?.ticket;

      if (stateTicket) {
        setTicketData(normalizeTicket(stateTicket));
        setLoading(false);
      } else {
        const ticketIdFromUrl = searchParams.get('ticket_id') || searchParams.get('id');

        if (ticketIdFromUrl) {
          try {
            const fetchedTicket = await ticketService.verifyTicket(ticketIdFromUrl);
            if (fetchedTicket) {
              setTicketData(fetchedTicket); // Assuming verifyTicket returns normalized data or handles it
            } else {
              toast.error("Registration not found. Check ID.");
            }
          } catch (error) {
            console.error("Fetch error:", error);
            toast.error("Could not fetch registration details.");
          }
        }
        setLoading(false);
      }
    };

    init();
  }, [location.state, searchParams]);

  const ticket: Ticket = ticketData || {
    ticketId: "DEMO-USER",
    fullName: "Loading...",
    age: "0",
    category: "",
    gender: "",
    phone: "",
    email: "",
    province: "",
    zone: "",
    area: "",
    parish: "",
    emergencyContact: "",
    emergencyPhone: "",
    emergencyRelationship: "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    parentRelationship: "",
    status: 'pending',
    registeredAt: new Date().toISOString(),
    id: "temp-id-fallback",
    payment_status: 'unpaid'
  };

  const normalizeTicket = (raw: any): Ticket => {
    if (raw.ticketId) return raw;
    return {
      ticketId: raw.ticketId || raw.ticket_id,
      fullName: raw.fullName || raw.full_name,
      age: raw.age?.toString(),
      category: raw.category,
      gender: raw.gender,
      phone: raw.phone,
      email: raw.email,
      province: raw.province,
      zone: raw.zone,
      area: raw.area,
      parish: raw.parish,
      medicalConditions: raw.medicalConditions || raw.medical_conditions,
      medications: raw.medications,
      dietaryRestrictions: raw.dietaryRestrictions || raw.dietary_restrictions,
      emergencyContact: raw.emergencyContact || raw.emergency_contact,
      emergencyPhone: raw.emergencyPhone || raw.emergency_phone,
      emergencyRelationship: raw.emergencyRelationship || raw.emergency_relationship,
      parentName: raw.parentName || raw.parent_name,
      parentEmail: raw.parentEmail || raw.parent_email,
      parentPhone: raw.parentPhone || raw.parent_phone,
      parentRelationship: raw.parentRelationship || raw.parent_relationship || "Parent",
      status: raw.status || 'pending',
      registeredAt: raw.registeredAt || raw.registered_at || new Date().toISOString(),
      id: raw.id || raw._id || "temp-id-normalized",
      payment_status: raw.payment_status || 'unpaid'
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-500"></div>
      </div>
    );
  }

  const handleDownloadPDF = async () => {
    await generatePDF('ticket-card-content', `RCCG-Member-${ticket.ticketId}.pdf`);
  };

  const handleDownloadImage = async () => {
    await generateImage('ticket-card-content', `RCCG-Member-${ticket.ticketId}.png`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadPayment = async () => {
    if (!selectedFile || !ticket.ticketId) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploadingPayment(true);
    try {
      const formData = new FormData();
      formData.append('ticket_id', ticket.ticketId);
      formData.append('proof_of_payment', selectedFile);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://rccg-r63-teens-backend.onrender.com/api'}/tickets/upload_proof_by_ticket_id/`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const updatedTicket = await response.json();
        setTicketData(normalizeTicket(updatedTicket));
        toast.success("Payment proof uploaded successfully! Awaiting verification.");
        setSelectedFile(null);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to upload payment proof");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload payment proof");
    } finally {
      setUploadingPayment(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    return cat ? cat.replace(/_/g, ' ').toUpperCase() : '';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
      <Navbar />

      <div className="pt-28 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 font-sans tracking-wide">
              YOUR <span className="text-primary-600 dark:text-primary-400">ACCESS PASS</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-300">Please present this ID at the venue.</p>
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            id="ticket-card-content"
            className="relative bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 p-8 max-w-4xl mx-auto"
          >
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <img src={rccgLogo} alt="" className="w-96 h-96 grayscale opacity-20" />
            </div>

            {/* Visual Verified Overlay - Only for Approved Tickets */}
            {ticket.status === 'approved' && (
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <div className="opacity-10 transform -rotate-12">
                  <FaCheckCircle className="text-[300px] text-primary-600" />
                </div>
              </div>
            )}


            <div className="relative z-10">
              {/* Header Section with Dual Logos */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 dark:border-gray-700 pb-6 mb-6">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="flex -space-x-3">
                    <img src={rccgLogo} alt="RCCG" className="w-16 h-16 rounded-full border-2 border-white shadow-md bg-white object-cover" />
                    <img src={faithLogo} alt="Faith Tribe" className="w-16 h-16 rounded-full border-2 border-white shadow-md bg-white object-cover" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">
                      {EVENT_DETAILS.title}
                    </h2>
                    <p className="text-primary-600 dark:text-primary-400 font-bold tracking-widest text-xs md:text-sm mt-1">{EVENT_DETAILS.theme}</p>
                  </div>
                </div>

                <div className={`px-6 py-2 rounded-full border font-bold uppercase tracking-wider text-sm ${ticket.status === 'approved'
                  ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400'
                  }`}>
                  {ticket.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* QR Code Section */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center order-2 md:order-1">
                  <QRCodeSVG
                    value={JSON.stringify({ id: ticket.ticketId, name: ticket.fullName })}
                    size={160}
                    level="H"
                    fgColor="#1fa055"
                  />
                  <p className="mt-3 font-mono font-bold text-lg text-gray-900 tracking-widest">
                    {ticket.ticketId}
                  </p>
                </div>

                {/* Details Section */}
                <div className="md:col-span-2 space-y-6 order-1 md:order-2">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <FaUser className="text-primary-500" /> Attendee Name
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{ticket.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Category</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{getCategoryLabel(ticket.category)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Church Parish</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">{ticket.parish}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contact</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FaPhone className="text-xs" /> {ticket.phone || ticket.parentPhone}
                      </p>
                    </div>
                  </div>

                  <div className="bg-primary-600 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
                    <div>
                      <p className="text-xs opacity-80 uppercase font-bold">Date</p>
                      <p className="font-bold text-white">{EVENT_DETAILS.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-80 uppercase font-bold">Venue</p>
                      <p className="font-bold text-white flex items-center justify-end gap-2">
                        <FaMapMarkerAlt /> {EVENT_DETAILS.location || "Glory Arena"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Instructions Card */}
          <div className="mt-8 bg-blue-50 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-500/20 rounded-xl p-6 shadow-sm">
            <h4 className="font-bold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
              <span className="text-xl">ℹ️</span> Registration Info
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-200/80 space-y-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <li className="flex items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                <FaCheckCircle className="mr-2 text-blue-600 shrink-0" />
                <span>Keep ID Safe</span>
              </li>
              <li className="flex items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                <FaCheckCircle className="mr-2 text-blue-600 shrink-0" />
                <span>Present at Entry</span>
              </li>
              <li className="flex items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                <FaCheckCircle className="mr-2 text-blue-600 shrink-0" />
                <span>Verify Status</span>
              </li>
            </ul>
          </div>

          {/* Payment Upload Section - Only show if payment is unpaid/pending and not demo */}
          {(ticket.payment_status === 'unpaid' || !ticket.payment_status) && ticket.ticketId !== "DEMO-USER" && (
            <div className="mt-8 bg-amber-50 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-500/20 rounded-xl p-6 shadow-sm">
              <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                <FaUpload className="text-xl" /> Upload Payment Proof
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-200/80 mb-4">
                Registration pending payment verification? Upload your receipt here.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 dark:file:bg-amber-900/30 dark:file:text-amber-400"
                />
                <button
                  onClick={handleUploadPayment}
                  disabled={!selectedFile || uploadingPayment}
                  className={`px-6 py-2 rounded-lg font-bold whitespace-nowrap flex items-center gap-2 ${!selectedFile || uploadingPayment
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                >
                  {uploadingPayment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FaUpload /> Upload
                    </>
                  )}
                </button>
              </div>
              {selectedFile && (
                <p className="text-sm text-amber-700 dark:text-amber-200/80 mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
            <button
              onClick={handleDownloadImage}
              className="px-8 py-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <FaFileImage /> Download Image
            </button>
            <button
              onClick={handleDownloadPDF}
              className="btn-primary py-3 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg"
            >
              <FaDownload /> Download PDF
            </button>
          </div>

          <div className="text-center mt-8">
            <Link to="/" className="text-sm font-bold text-gray-500 dark:text-white/40 hover:text-primary-600 dark:hover:text-white transition-colors">
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