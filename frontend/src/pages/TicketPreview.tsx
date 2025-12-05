import { motion } from "framer-motion";
import { useLocation, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { generatePDF } from "../utils/pdfGenerator";
import { 
  FaDownload, 
  FaPrint, 
  FaCheckCircle,
  FaMapMarkerAlt,
  FaUser,
  FaPhone
} from "react-icons/fa";
import rccgLogo from "../assets/logo.jpg";
import faithLogo from "../assets/faith_logo.jpg";

// Define interface for Ticket
interface Ticket {
  ticketId: string;
  fullName: string;
  age: string;
  category: string;
  gender: string;
  phone: string;
  email: string;
  province: string;
  zone: string;
  area: string;
  parish: string;
  department?: string;
  medicalConditions?: string;
  medications?: string;
  dietaryRestrictions?: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
}

const TicketPreview = () => {
  const location = useLocation();
  const state = location.state as { ticket?: any };
  const rawTicket = state?.ticket;

  // --- DATA NORMALIZATION ---
  // This converts backend snake_case to frontend camelCase
  const ticket: Ticket = rawTicket ? {
    ticketId: rawTicket.ticketId || rawTicket.ticket_id,
    fullName: rawTicket.fullName || rawTicket.full_name,
    age: rawTicket.age?.toString(),
    category: rawTicket.category,
    gender: rawTicket.gender,
    phone: rawTicket.phone,
    email: rawTicket.email,
    province: rawTicket.province,
    zone: rawTicket.zone,
    area: rawTicket.area,
    parish: rawTicket.parish,
    department: rawTicket.department,
    
    // Map complex fields
    medicalConditions: rawTicket.medicalConditions || rawTicket.medical_conditions,
    medications: rawTicket.medications,
    dietaryRestrictions: rawTicket.dietaryRestrictions || rawTicket.dietary_restrictions,
    
    // Emergency Contact
    emergencyContact: rawTicket.emergencyContact || rawTicket.emergency_contact,
    emergencyPhone: rawTicket.emergencyPhone || rawTicket.emergency_phone,
    emergencyRelationship: rawTicket.emergencyRelationship || rawTicket.emergency_relationship,
    
    // Parent Info
    parentName: rawTicket.parentName || rawTicket.parent_name,
    parentEmail: rawTicket.parentEmail || rawTicket.parent_email,
    parentPhone: rawTicket.parentPhone || rawTicket.parent_phone,
    
    status: rawTicket.status || 'pending',
    registeredAt: rawTicket.registeredAt || rawTicket.registered_at || new Date().toISOString(),
  } : {
    // Fallback Mock Data (Only used if no data passed)
    ticketId: `R63T${Date.now()}`,
    fullName: "Sample User",
    age: "15",
    category: "teens",
    gender: "male",
    phone: "+234 800 123 4567",
    email: "sample@example.com",
    province: "Lagos Province 9",
    zone: "Zone 1",
    area: "Area 1",
    parish: "RCCG Glory Tabernacle",
    emergencyContact: "Parent Name",
    emergencyPhone: "08000000000",
    emergencyRelationship: "Parent",
    parentName: "Parent Name",
    parentEmail: "parent@example.com",
    parentPhone: "08000000000",
    status: "pending",
    registeredAt: new Date().toISOString(),
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    await generatePDF('ticket-card-content', `RCCG-Ticket-${ticket.ticketId}.pdf`);
  };

  const getCategoryLabel = (cat: string) => {
    return cat ? cat.replace(/_/g, ' ').toUpperCase() : '';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] transition-colors duration-500">
      <Navbar />
      
      <div className="pt-28 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-white mb-2 font-['Impact'] tracking-wide">
              YOUR <span className="text-yellow-600 dark:text-yellow-400">GOLDEN TICKET</span>
            </h1>
            <p className="text-gray-600 dark:text-red-200/70">Please present this at the registration desk.</p>
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            id="ticket-card-content" 
            className="relative bg-gradient-to-br from-[#fffbeb] to-[#f3e5ab] text-[#2b0303] rounded-3xl overflow-hidden shadow-2xl border-4 border-yellow-600/50 p-8 max-w-4xl mx-auto"
          >
            {/* Ornate Corner Designs (CSS only) */}
            <div className="absolute top-0 left-0 w-24 h-24 border-t-[8px] border-l-[8px] border-yellow-600/30 rounded-tl-3xl"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 border-b-[8px] border-r-[8px] border-yellow-600/30 rounded-br-3xl"></div>
            
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <img src={rccgLogo} alt="" className="w-96 h-96 grayscale opacity-50" />
            </div>

            <div className="relative z-10">
              {/* Header Section with Dual Logos */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-[#2b0303]/10 pb-6 mb-6">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="flex -space-x-3">
                    <img src={rccgLogo} alt="RCCG" className="w-16 h-16 rounded-full border-2 border-yellow-600 shadow-md bg-white object-cover" />
                    <img src={faithLogo} alt="Faith Tribe" className="w-16 h-16 rounded-full border-2 border-yellow-600 shadow-md bg-white object-cover" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-[#8B0000] uppercase tracking-tighter leading-none">
                      {EVENT_DETAILS.title}
                    </h2>
                    <p className="text-yellow-700 font-bold tracking-widest text-xs md:text-sm mt-1">{EVENT_DETAILS.theme}</p>
                  </div>
                </div>
                
                <div className={`px-6 py-2 rounded-full border-2 font-bold uppercase tracking-wider text-sm ${
                  ticket.status === 'approved' ? 'border-green-600 text-green-800 bg-green-100' : 'border-yellow-600 text-yellow-900 bg-yellow-100'
                }`}>
                  {ticket.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* QR Code Section */}
                <div className="bg-white p-4 rounded-xl shadow-inner border border-[#2b0303]/10 flex flex-col items-center justify-center order-2 md:order-1">
                  <QRCodeSVG 
                    value={JSON.stringify({ id: ticket.ticketId, name: ticket.fullName })}
                    size={160}
                    level="H"
                    fgColor="#2b0303"
                  />
                  <p className="mt-3 font-mono font-bold text-lg text-[#8B0000] tracking-widest">
                    {ticket.ticketId}
                  </p>
                </div>

                {/* Details Section */}
                <div className="md:col-span-2 space-y-6 order-1 md:order-2">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <FaUser className="text-yellow-600" /> Attendee Name
                      </p>
                      <p className="text-xl font-bold text-[#2b0303] truncate">{ticket.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Category</p>
                      <p className="text-xl font-bold text-[#2b0303]">{getCategoryLabel(ticket.category)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Church Parish</p>
                      <p className="text-lg font-semibold text-[#2b0303] truncate">{ticket.parish}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Emergency Contact</p>
                      <p className="text-lg font-semibold text-[#2b0303] flex items-center gap-2">
                        <FaPhone className="text-xs" /> {ticket.emergencyPhone}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#8B0000] text-yellow-400 p-4 rounded-xl flex items-center justify-between shadow-lg">
                    <div>
                      <p className="text-xs opacity-80 uppercase font-bold">Date</p>
                      <p className="font-bold text-white">{EVENT_DETAILS.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-80 uppercase font-bold">Venue</p>
                      <p className="font-bold text-white flex items-center justify-end gap-2">
                        <FaMapMarkerAlt /> Glory Arena
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Instructions Card (Outside PDF area) */}
          <div className="mt-8 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-500/30 rounded-xl p-6 shadow-sm">
            <h4 className="font-bold text-green-800 dark:text-green-400 mb-3 flex items-center gap-2">
              <span className="text-xl">📋</span> Important Instructions
            </h4>
            <ul className="text-sm text-green-700 dark:text-green-200/80 space-y-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <li className="flex items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                <FaCheckCircle className="mr-2 text-green-600 shrink-0" />
                <span>Payment via Coordinator</span>
              </li>
              <li className="flex items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                <FaCheckCircle className="mr-2 text-green-600 shrink-0" />
                <span>Valid ID Required</span>
              </li>
              <li className="flex items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                <FaCheckCircle className="mr-2 text-green-600 shrink-0" />
                <span>Parent Consent Verified</span>
              </li>
              <li className="flex items-center bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                <FaCheckCircle className="mr-2 text-green-600 shrink-0" />
                <span>Arrival: 9:00 AM</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
            <button 
              onClick={handlePrint} 
              className="px-8 py-3 bg-white dark:bg-white/10 text-gray-800 dark:text-white border border-gray-300 dark:border-white/20 rounded-xl hover:bg-gray-50 dark:hover:bg-white/20 transition-all font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <FaPrint /> Print Ticket
            </button>
            <button 
              onClick={handleDownload} 
              className="btn-primary py-3 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg"
            >
              <FaDownload /> Download PDF
            </button>
          </div>

          <div className="text-center mt-8">
            <Link to="/" className="text-sm font-bold text-gray-500 dark:text-white/40 hover:text-red-600 dark:hover:text-white transition-colors">
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