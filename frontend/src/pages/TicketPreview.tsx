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
  FaChurch, 
  FaEnvelope, // Ensure this is imported if used
  FaMapMarkerAlt
} from "react-icons/fa";

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
  const state = location.state as { ticket?: Ticket };
  
  // Fallback sample ticket if accessed directly without state
  const ticket = state?.ticket || {
    ticketId: `R63T${Date.now()}`,
    fullName: "Sample User",
    age: "15",
    category: "teens",
    gender: "male",
    phone: "+234 800 123 4567",
    email: "sample@example.com",
    province: "Province 1",
    zone: "Zone 1",
    area: "Area 1",
    parish: "RCCG Glory Tabernacle",
    emergencyContact: "Parent Name",
    emergencyPhone: "08000000000",
    emergencyRelationship: "Parent",
    parentName: "Parent Name",
    parentEmail: "parent@example.com",
    parentPhone: "08000000000",
    status: "pending" as const,
    registeredAt: new Date().toISOString(),
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    await generatePDF('ticket-card-content', `RCCG-Ticket-${ticket.ticketId}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#2b0303]">
      <Navbar />
      
      <div className="pt-28 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              YOUR <span className="text-yellow-400">GOLDEN TICKET</span>
            </h1>
            <p className="text-red-200/70">Please present this at the registration desk.</p>
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
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <FaChurch className="text-[400px] text-[#2b0303]" />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-[#2b0303]/10 pb-6 mb-6">
                <div>
                  <h2 className="text-4xl font-black text-[#8B0000] uppercase tracking-tighter">
                    {EVENT_DETAILS.title}
                  </h2>
                  <p className="text-yellow-700 font-bold tracking-widest">{EVENT_DETAILS.theme}</p>
                </div>
                <div className={`mt-4 md:mt-0 px-6 py-2 rounded-full border-2 font-bold uppercase tracking-wider ${
                  ticket.status === 'approved' ? 'border-green-600 text-green-700 bg-green-100' : 'border-yellow-600 text-yellow-800 bg-yellow-100'
                }`}>
                  {ticket.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* QR Code Section */}
                <div className="bg-white p-4 rounded-xl shadow-inner border border-[#2b0303]/10 flex flex-col items-center justify-center">
                  <QRCodeSVG 
                    value={JSON.stringify({ id: ticket.ticketId })}
                    size={160}
                    level="H"
                    fgColor="#2b0303"
                  />
                  <p className="mt-3 font-mono font-bold text-lg text-[#8B0000] tracking-widest">
                    {ticket.ticketId}
                  </p>
                </div>

                {/* Details Section */}
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Attendee Name</p>
                      <p className="text-xl font-bold text-[#2b0303]">{ticket.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Category</p>
                      <p className="text-xl font-bold text-[#2b0303] capitalize">{ticket.category.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Church Parish</p>
                      <p className="text-lg font-semibold text-[#2b0303]">{ticket.parish}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Zone/Province</p>
                      <p className="text-lg font-semibold text-[#2b0303]">{ticket.zone} / {ticket.province}</p>
                    </div>
                  </div>

                  <div className="bg-[#8B0000] text-yellow-400 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs opacity-80 uppercase">Date</p>
                      <p className="font-bold">{EVENT_DETAILS.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-80 uppercase">Venue</p>
                      <p className="font-bold flex items-center justify-end gap-2">
                        <FaMapMarkerAlt /> Glory Arena
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <button onClick={handlePrint} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-bold flex items-center gap-2">
              <FaPrint /> Print
            </button>
            <button onClick={handleDownload} className="btn-primary py-3 px-8 rounded-xl flex items-center gap-2">
              <FaDownload /> Download Ticket
            </button>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default TicketPreview;