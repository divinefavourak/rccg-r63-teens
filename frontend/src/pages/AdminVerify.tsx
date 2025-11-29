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
  FaSearch, 
  FaFilter, 
  FaCheck, 
  FaTimes, 
  FaEye, 
  FaDownload,
  FaUser,
  FaSignOutAlt,
  FaSortUp,
  FaSortDown,
  FaUsers,
  FaCheckCircle,
  FaExclamationTriangle,
  FaEnvelope,
  FaPaperPlane
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
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Bulk operations hook
  const {
    selectedTickets,
    setSelectedTickets,
    bulkAction,
    setBulkAction,
    isProcessing,
    operationResults,
    setOperationResults,
    handleSelectAll,
    handleSelectTicket,
    handleBulkAction,
    sendCustomEmail
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

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(ticket =>
        ticket.fullName.toLowerCase().includes(term) ||
        ticket.ticketId.toLowerCase().includes(term) ||
        ticket.email.toLowerCase().includes(term) ||
        ticket.parish.toLowerCase().includes(term)
      );
    }

    // Status Filter
    if (statusFilter !== "all") {
      result = result.filter(ticket => ticket.status === statusFilter);
    }

    // Category Filter
    if (categoryFilter !== "all") {
      result = result.filter(ticket => ticket.category === categoryFilter);
    }

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
    const headers = ["Ticket ID", "Name", "Age", "Category", "Church", "Status", "Registered"];
    const csvData = filteredTickets.map(ticket => [
      ticket.ticketId,
      ticket.fullName,
      ticket.age,
      getCategoryLabel(ticket.category),
      ticket.parish,
      ticket.status,
      new Date(ticket.registeredAt).toLocaleDateString()
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rccg-tickets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Export downloaded!");
  };

  // Helpers
  const getCategoryLabel = (category: string) => {
    const categories: Record<string, string> = {
      toddler: "Toddler",
      children_6_8: "Children 6-8",
      pre_teens: "Pre-Teens",
      teens: "Teens",
      super_teens: "Super Teens",
      alumni: "Alumni",
      teacher: "Teacher"
    };
    return categories[category] || category;
  };

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
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-end mb-8 border-b border-yellow-500/20 pb-6">
            <div>
              <h1 className="text-3xl font-black text-white">
                ADMIN <span className="text-yellow-500">DASHBOARD</span>
              </h1>
              <p className="text-red-200/60 mt-1">Manage registrations for The Priceless Gift</p>
            </div>
            
            <div className="flex gap-3 mt-4 lg:mt-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEmailModal(true)}
                disabled={selectedTickets.size === 0}
                className="flex items-center space-x-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50"
              >
                <FaEnvelope className="w-4 h-4" />
                <span>Broadcast ({selectedTickets.size})</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={logout}
                className="flex items-center space-x-2 bg-red-600/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <FaSignOutAlt />
                <span>Logout</span>
              </motion.button>
            </div>
          </div>

          {/* Operation Results */}
          {operationResults && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className={`mb-6 p-4 rounded-lg border ${
                operationResults.failed > 0 
                  ? "bg-red-900/20 border-red-500/30 text-red-200"
                  : "bg-green-900/20 border-green-500/30 text-green-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {operationResults.failed > 0 ? (
                    <FaExclamationTriangle className="text-red-400" />
                  ) : (
                    <FaCheckCircle className="text-green-400" />
                  )}
                  <div>
                    <h4 className="font-bold">
                      {operationResults.action.replace('_', ' ').toUpperCase()} COMPLETED
                    </h4>
                    <p className="text-sm opacity-80">
                      {operationResults.successful} successful, {operationResults.failed} failed
                      {operationResults.error && ` - ${operationResults.error}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOperationResults(null)}
                  className="text-white/40 hover:text-white"
                >
                  <FaTimes />
                </button>
              </div>
            </motion.div>
          )}

          {/* Bulk Actions Bar */}
          {selectedTickets.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <FaUsers className="text-yellow-500" />
                  <span className="font-bold text-yellow-100">
                    {selectedTickets.size} ticket(s) selected
                  </span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    disabled={isProcessing}
                    className="bg-[#1a0505] border border-yellow-500/30 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none"
                  >
                    <option value="">Bulk Actions</option>
                    <option value="approve">Approve Selected</option>
                    <option value="reject">Reject Selected</option>
                    <option value="send_reminder">Send Reminder</option>
                    <option value="delete">Delete Selected</option>
                  </select>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBulkAction}
                    disabled={!bulkAction || isProcessing}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 font-bold"
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FaPaperPlane className="w-3 h-3" />
                    )}
                    <span>Apply</span>
                  </motion.button>
                  
                  <button
                    onClick={() => setSelectedTickets(new Set())}
                    disabled={isProcessing}
                    className="text-white/60 hover:text-white transition-colors text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Total", value: stats.total, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { label: "Pending", value: stats.pending, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
              { label: "Approved", value: stats.approved, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
              { label: "Rejected", value: stats.rejected, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
            ].map((stat) => (
              <motion.div 
                key={stat.label}
                whileHover={{ scale: 1.02 }}
                className={`${stat.bg} ${stat.border} border rounded-2xl p-6 backdrop-blur-sm shadow-lg`}
              >
                <div className={`text-3xl font-black ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-white/60 text-xs uppercase font-bold tracking-widest">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Filters and Search */}
          <div className="glass-effect p-6 mb-8 rounded-2xl border border-white/5">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Search by name, ID, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-[#0f0202]/50 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white ..."
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <FaFilter className="text-white/40" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white dark:bg-[#0f0202]/50 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white ..."
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center space-x-2">
                <FaUsers className="text-white/40" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-[#0f0202]/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500/50 outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="toddler">Toddler</option>
                  <option value="children_6_8">Children 6-8</option>
                  <option value="pre_teens">Pre-Teens</option>
                  <option value="teens">Teens</option>
                  <option value="super_teens">Super Teens</option>
                  <option value="alumni">Alumni</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>

              {/* Export Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportToCSV}
                className="flex items-center space-x-2 bg-green-700/80 hover:bg-green-600 text-white px-6 py-3 rounded-xl transition-colors font-bold shadow-lg"
              >
                <FaDownload />
                <span>Export</span>
              </motion.button>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="glass-effect rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-8 space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 bg-white/5 rounded-lg w-full"></div>
                  ))}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-[#0f0202]/80 text-gray-500 dark:text-white/50 ...">
                  <tr className="hover:bg-gray-50 dark:hover:bg-white/5 ...">
                      <th className="py-4 px-6 w-12">
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={selectedTickets.size === filteredTickets.length && filteredTickets.length > 0}
                          className="rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-yellow-500"
                        />
                      </th>
                      <th className="text-left py-4 px-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("ticketId")}>
                        <div className="flex items-center space-x-1"><span>ID</span>{sortField === "ticketId" && (sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />)}</div>
                      </th>
                      <th className="text-left py-4 px-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("fullName")}>
                        <div className="flex items-center space-x-1"><span>Participant</span>{sortField === "fullName" && (sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />)}</div>
                      </th>
                      <th className="text-left py-4 px-6">Category</th>
                      <th className="text-left py-4 px-6">Church</th>
                      <th className="text-left py-4 px-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("status")}>
                        <div className="flex items-center space-x-1"><span>Status</span>{sortField === "status" && (sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />)}</div>
                      </th>
                      <th className="text-right py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                    {sortedTickets.map((ticket) => (
                      <motion.tr
                        key={ticket.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <input
                            type="checkbox"
                            checked={selectedTickets.has(ticket.id)}
                            onChange={(e) => handleSelectTicket(ticket.id, e.target.checked)}
                            className="rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-yellow-500"
                          />
                        </td>
                        <td className="py-4 px-6 font-mono text-sm text-yellow-500/70">{ticket.ticketId}</td>
                        <td className="py-4 px-6">
                          <div>
                            <div className="font-bold text-white">{ticket.fullName}</div>
                            <div className="text-xs text-white/40 flex items-center mt-1">
                              <FaUser className="mr-1" />
                              {ticket.age} yrs • {ticket.gender}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-block px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full text-xs font-medium">
                            {getCategoryLabel(ticket.category)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-white/80">
                            <div className="font-medium">{ticket.parish}</div>
                            <div className="text-white/40 text-xs">{ticket.area}</div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold uppercase border ${getStatusColor(ticket.status)}`}>
                            {getStatusIcon(ticket.status)}
                            <span className="capitalize">{ticket.status}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setSelectedTicket(ticket)}
                              className="p-2 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <FaEye />
                            </motion.button>
                            
                            {ticket.status === "pending" && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleApprove(ticket.id)}
                                  className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                                  title="Approve"
                                >
                                  <FaCheck />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleReject(ticket.id)}
                                  className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                  title="Reject"
                                >
                                  <FaTimes />
                                </motion.button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!isLoading && sortedTickets.length === 0 && (
                <div className="text-center py-12 text-white/30">
                  <p className="text-lg">No tickets found matching your criteria.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bulk Email Modal */}
      <BulkEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleEmailSend}
        selectedCount={selectedTickets.size}
        totalCount={stats.total}
        pendingCount={stats.pending}
        approvedCount={stats.approved}
      />

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1a0505] border border-yellow-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
          >
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
              <h3 className="text-2xl font-black text-white">TICKET <span className="text-yellow-500">DETAILS</span></h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-white">
              {/* Personal Information */}
              <div className="space-y-4">
                <h4 className="font-bold text-yellow-500/80 uppercase text-xs tracking-wider border-b border-white/10 pb-2">Personal Information</h4>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Full Name:</span>
                    <span className="font-semibold text-right">{selectedTicket.fullName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Age:</span>
                    <span className="font-semibold text-right">{selectedTicket.age} years</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Category:</span>
                    <span className="font-semibold text-right">{getCategoryLabel(selectedTicket.category)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Gender:</span>
                    <span className="font-semibold text-right capitalize">{selectedTicket.gender}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="font-bold text-yellow-500/80 uppercase text-xs tracking-wider border-b border-white/10 pb-2">Contact Information</h4>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Phone:</span>
                    <span className="font-semibold text-right">{selectedTicket.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Email:</span>
                    <span className="font-semibold text-right truncate max-w-[200px]">{selectedTicket.email}</span>
                  </div>
                </div>
              </div>

              {/* Church Information */}
              <div className="space-y-4">
                <h4 className="font-bold text-yellow-500/80 uppercase text-xs tracking-wider border-b border-white/10 pb-2">Church Information</h4>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Province:</span>
                    <span className="font-semibold text-right">{selectedTicket.province}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Zone:</span>
                    <span className="font-semibold text-right">{selectedTicket.zone}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Area:</span>
                    <span className="font-semibold text-right">{selectedTicket.area}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Parish:</span>
                    <span className="font-semibold text-right">{selectedTicket.parish}</span>
                  </div>
                </div>
              </div>

              {/* Parent Information */}
              <div className="space-y-4">
                <h4 className="font-bold text-yellow-500/80 uppercase text-xs tracking-wider border-b border-white/10 pb-2">Parent/Guardian</h4>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Name:</span>
                    <span className="font-semibold text-right">{selectedTicket.parentName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/50">Phone:</span>
                    <span className="font-semibold text-right">{selectedTicket.parentPhone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {selectedTicket.status === "pending" && (
              <div className="flex space-x-4 mt-8 pt-6 border-t border-white/10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleApprove(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 px-6 rounded-xl transition-colors font-bold shadow-lg"
                >
                  APPROVE
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleReject(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 px-6 rounded-xl transition-colors font-bold shadow-lg"
                >
                  REJECT
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AdminVerify;