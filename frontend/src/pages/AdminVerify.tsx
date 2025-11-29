import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBulkOperations } from "../hooks/useBulkOperations";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BulkEmailModal from "../components/BulkEmailModal";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { ticketService } from "../services/ticketService";
import { Ticket } from "../types";
import toast from "react-hot-toast";
import { 
  FaSearch, FaFilter, FaCheck, FaTimes, FaEye, FaDownload, 
  FaUser, FaSignOutAlt, FaSortUp, FaSortDown, FaUsers, 
  FaCheckCircle, FaExclamationTriangle, FaEnvelope, FaPaperPlane
} from "react-icons/fa";

const AdminVerify = () => {
  const { logout } = useAuth();
  
  // State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  const [sortField, setSortField] = useState<keyof Ticket>("registeredAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  const [stats, setStats] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0
  });

  // Bulk operations hook
  const {
    selectedTickets, setSelectedTickets, bulkAction, setBulkAction,
    isProcessing, operationResults, setOperationResults,
    handleSelectAll, handleSelectTicket, handleBulkAction, sendCustomEmail
  } = useBulkOperations(tickets, setTickets);

  // 1. Fetch Data
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setIsLoading(true);
        const data = await ticketService.getAllTickets();
        setTickets(data);
      } catch (error) {
        toast.error("Failed to load tickets");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, []);

  // 2. Filter & Stats Logic
  useEffect(() => {
    let result = tickets;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(ticket =>
        ticket.fullName.toLowerCase().includes(term) ||
        ticket.ticketId.toLowerCase().includes(term) ||
        ticket.email.toLowerCase().includes(term) ||
        ticket.parish.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") result = result.filter(ticket => ticket.status === statusFilter);
    if (categoryFilter !== "all") result = result.filter(ticket => ticket.category === categoryFilter);

    setFilteredTickets(result);

    setStats({
      total: tickets.length,
      pending: tickets.filter(t => t.status === 'pending').length,
      approved: tickets.filter(t => t.status === 'approved').length,
      rejected: tickets.filter(t => t.status === 'rejected').length
    });

  }, [tickets, searchTerm, statusFilter, categoryFilter]);

  // 3. Sorting Logic
  const handleSort = (field: keyof Ticket) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue === undefined || bValue === undefined) return 0;
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // 4. Action Handlers
  const handleApprove = async (id: number) => {
    try {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t));
      toast.success("Ticket Approved");
      await ticketService.updateTicketStatus(id, "approved");
    } catch (err) {
      toast.error("Failed to approve ticket");
    }
  };

  const handleReject = async (id: number) => {
    if(!window.confirm("Are you sure you want to reject this ticket?")) return;
    try {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: "rejected" } : t));
      toast.success("Ticket Rejected");
      await ticketService.updateTicketStatus(id, "rejected");
    } catch (err) {
      toast.error("Failed to reject ticket");
    }
  };

  const handleEmailSend = async (subject: string, message: string, recipients: string) => {
    await sendCustomEmail(subject, message, recipients);
    setShowEmailModal(false);
    toast.success("Emails sent successfully!");
  };

  const exportToCSV = () => {
    // ... csv logic (same as before) ...
    toast.success("Export downloaded!");
  };

  // Helpers
  const getCategoryLabel = (cat: string) => cat; // Simplified for brevity
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <FaCheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending': return <FaExclamationTriangle className="w-4 h-4 text-yellow-400" />;
      case 'rejected': return <FaTimes className="w-4 h-4 text-red-400" />;
      default: return <FaExclamationTriangle className="w-4 h-4 text-yellow-400" />;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return "bg-green-500/20 text-green-300 border-green-500/30";
      case 'pending': return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case 'rejected': return "bg-red-500/20 text-red-300 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-[#1a0505] text-white">
      <Navbar />
      <div className="pt-28 pb-16 px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-end mb-8 border-b border-yellow-500/20 pb-6">
            <div>
              <h1 className="text-3xl font-black">ADMIN <span className="text-yellow-500">DASHBOARD</span></h1>
              <p className="text-red-200/60 mt-1">Manage registrations</p>
            </div>
            <button onClick={logout} className="flex items-center gap-2 bg-red-600/20 text-red-300 px-4 py-2 rounded-lg hover:bg-red-600/30 transition-colors">
              <FaSignOutAlt /> Logout
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
             {/* ... Stats Cards (same as before) ... */}
          </div>

          {/* Table */}
          <div className="glass-effect rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-8 text-center text-white/40">Loading...</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-[#0f0202]/80 text-white/50 uppercase text-xs font-bold">
                    <tr>
                      <th className="p-4 w-12"><input type="checkbox" onChange={handleSelectAll} className="rounded bg-black/30" /></th>
                      <th className="p-4 cursor-pointer" onClick={() => handleSort("ticketId")}>ID</th>
                      <th className="p-4 cursor-pointer" onClick={() => handleSort("fullName")}>Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-white/5">
                        <td className="p-4"><input type="checkbox" checked={selectedTickets.has(ticket.id)} onChange={(e) => handleSelectTicket(ticket.id, e.target.checked)} className="rounded bg-black/30" /></td>
                        <td className="p-4 font-mono text-yellow-500/70">{ticket.ticketId}</td>
                        <td className="p-4 font-bold">{ticket.fullName}</td>
                        <td className="p-4 text-sm">{ticket.category}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => setSelectedTicket(ticket)} className="text-white/40 hover:text-white"><FaEye /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminVerify;