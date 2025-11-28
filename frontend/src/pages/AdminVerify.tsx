import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { 
  FaSearch, 
  FaCheck, 
  FaTimes, 
  FaEye, 
  FaUser,
  FaSignOutAlt
} from "react-icons/fa";

const AdminVerify = () => {
  const { logout } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Sample data
  useEffect(() => {
    const sampleTickets = [
      {
        id: 1,
        ticketId: "R63T123456",
        fullName: "John Adebayo",
        age: "15",
        category: "teens",
        gender: "male",
        phone: "+234 800 123 4567",
        email: "john.adebayo@example.com",
        province: "Province 1",
        zone: "Zone 1",
        area: "Area 1",
        parish: "RCCG Jesus Palace Parish",
        department: "Teens Church",
        medicalConditions: "None",
        emergencyContact: "Mrs. Adebayo",
        emergencyPhone: "+234 800 987 6543",
        parentName: "Mr. & Mrs. Adebayo",
        parentEmail: "parents@example.com",
        parentPhone: "+234 800 987 6543",
        status: "pending",
        registeredAt: "2024-01-15T10:30:00Z"
      },
      {
        id: 2,
        ticketId: "R63T123457",
        fullName: "Sarah Johnson",
        age: "12",
        category: "pre_teens",
        gender: "female",
        phone: "+234 800 123 4568",
        email: "sarah.j@example.com",
        province: "Province 2",
        zone: "Zone 2",
        area: "Area 2",
        parish: "RCCG Grace Tabernacle",
        department: "Children Church",
        medicalConditions: "Asthma",
        emergencyContact: "Dr. Johnson",
        emergencyPhone: "+234 800 987 6544",
        parentName: "Dr. Johnson",
        parentEmail: "dr.johnson@example.com",
        parentPhone: "+234 800 987 6544",
        status: "approved",
        registeredAt: "2024-01-14T14:20:00Z"
      }
    ];
    setTickets(sampleTickets);
  }, []);

  const filteredTickets = tickets.filter(ticket =>
    ticket.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.parish.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApprove = (ticketId) => {
    setTickets(prev => prev.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "approved" } : ticket
    ));
  };

  const handleReject = (ticketId) => {
    setTickets(prev => prev.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "rejected" } : ticket
    ));
  };

  const stats = {
    total: tickets.length,
    pending: tickets.filter(t => t.status === 'pending').length,
    approved: tickets.filter(t => t.status === 'approved').length,
    rejected: tickets.filter(t => t.status === 'rejected').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header with Logout */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
            <div className="text-center lg:text-left mb-4 lg:mb-0">
              <h1 className="text-4xl font-black text-gray-800 mb-2">
                🎉 Admin Dashboard Loaded!
              </h1>
              <p className="text-gray-600">
                Successfully authenticated and redirected to admin panel
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <FaSignOutAlt />
              <span>Logout</span>
            </motion.button>
          </div>

          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-green-800">Authentication Successful!</h3>
                <p className="text-green-700 text-sm">You have been successfully redirected to the admin dashboard.</p>
              </div>
            </div>
          </div>

          {/* Rest of the admin dashboard content... */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div whileHover={{ scale: 1.05 }} className="card p-6 text-center">
              <div className="text-3xl font-bold text-gray-800 mb-2">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Registrations</div>
            </motion.div>
            {/* ... other stat cards */}
          </div>

          {/* Search and table content... */}
          <div className="card p-6 mb-8">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search registrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Sample Registrations ({filteredTickets.length})</h3>
            <div className="space-y-4">
              {filteredTickets.map(ticket => (
                <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold">{ticket.fullName}</h4>
                      <p className="text-sm text-gray-600">{ticket.ticketId} • {ticket.category}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      ticket.status === 'approved' ? 'bg-green-100 text-green-800' :
                      ticket.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default AdminVerify;