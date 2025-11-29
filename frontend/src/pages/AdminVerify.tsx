import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth"; // Changed from useAuthContext to useAuth hook which uses context
import { useBulkOperations } from "../hooks/useBulkOperations";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BulkEmailModal from "../components/BulkEmailModal";
import { ticketService } from "../services/ticketService";
import { Ticket } from "../types";
import toast from "react-hot-toast";
import { CHURCH_INFO_FIELDS } from "../constants/formFields"; // Import form fields
import { 
  FaSearch, FaFilter, FaCheck, FaTimes, FaEye, FaDownload, 
  FaUser, FaSignOutAlt, FaSortUp, FaSortDown, FaUsers, 
  FaCheckCircle, FaExclamationTriangle, FaEnvelope, FaPaperPlane, FaChartPie
} from "react-icons/fa";

const AdminVerify = () => {
  const { logout } = useAuth();
  
  // State Management
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  
  // UI State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [sortField, setSortField] = useState<keyof Ticket>("registeredAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // Statistics
  const [stats, setStats] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0
  });
  const [provinceStats, setProvinceStats] = useState<Record<string, number>>({});

  // Get Province Options from constants
  const provinceOptions = CHURCH_INFO_FIELDS.find(field => field.name === 'province')?.options || [];

  // Bulk Operations Hook
  const {
    selectedTickets, setSelectedTickets, bulkAction, setBulkAction,
    isProcessing, operationResults, setOperationResults,
    handleSelectAll, handleSelectTicket, handleBulkAction, sendCustomEmail
  } = useBulkOperations(tickets, setTickets);

  // 1. Fetch Initial Data
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setIsLoading(true);
        const data = await ticketService.getAllTickets();
        setTickets(data);
        
        // Calculate Initial Province Stats
        const pStats: Record<string, number> = {};
        data.forEach(t => {
          const p = t.province || "Unknown";
          pStats[p] = (pStats[p] || 0) + 1;
        });
        setProvinceStats(pStats);

      } catch (error) {
        toast.error("Failed to load tickets");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, []);

  // 2. Filtering Logic
  useEffect(() => {
    let result = tickets;

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(ticket =>
        ticket.fullName.toLowerCase().includes(term) ||
        ticket.ticketId.toLowerCase().includes(term) ||
        ticket.email.toLowerCase().includes(term) ||
        ticket.parish.toLowerCase().includes(term) ||
        ticket.province.toLowerCase().includes(term)
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

    // Province Filter (Admin Specific)
    if (provinceFilter !== "all") {
      const normalize = (str: string) => str.toLowerCase().replace(/_/g, ' ').replace(/\s/g, '');
      const filter = normalize(provinceFilter);
      
      result = result.filter(ticket => {
         // Normalize ticket province (handle both "Lagos Province 9" and "lagos_province_9")
         const pName = normalize(ticket.province);
         return pName.includes(filter);
      });
    }

    setFilteredTickets(result);

    // Update Stats based on current global data (tickets), not filtered view
    setStats({
      total: tickets.length,
      pending: tickets.filter(t => t.status === 'pending').length,
      approved: tickets.filter(t => t.status === 'approved').length,
      rejected: tickets.filter(t => t.status === 'rejected').length
    });

  }, [tickets, searchTerm, statusFilter, categoryFilter, provinceFilter]);

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
    // @ts-ignore - Dynamic sort field access
    const aValue = a[sortField];
    // @ts-ignore
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
    const headers = ["Ticket ID", "Name", "Age", "Category", "Province", "Church", "Status", "Registered By"];
    const csvData = filteredTickets.map(ticket => [
      ticket.ticketId,
      `"${ticket.fullName}"`,
      ticket.age,
      ticket.category,
      `"${ticket.province}"`,
      `"${ticket.parish}"`,
      ticket.status,
      ticket.registeredBy || "Self"
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `regional-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Regional Report Downloaded!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return "bg-green-100 text-green-800 border-green-200";
      case 'pending': return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'rejected': return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      
      <div className="pt-28 pb-16 px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-end mb-8 border-b border-gray-200 pb-6">
            <div>
              <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">REGIONAL HEADQUARTERS</h4>
              <h1 className="text-3xl font-black text-gray-900">
                ADMIN <span className="text-blue-600">DASHBOARD</span>
              </h1>
              <p className="text-gray-500 mt-1">Overview of all Provinces</p>
            </div>
            
            <div className="flex gap-3 mt-4 lg:mt-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowEmailModal(true)}
                disabled={selectedTickets.size === 0}
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
              >
                <FaEnvelope /> <span>Broadcast ({selectedTickets.size})</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={logout}
                className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
              >
                <FaSignOutAlt /> <span>Logout</span>
              </motion.button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Total Registered", value: stats.total, color: "text-blue-600", bg: "bg-white", border: "border-gray-200" },
              { label: "Pending Review", value: stats.pending, color: "text-yellow-600", bg: "bg-white", border: "border-gray-200" },
              { label: "Approved", value: stats.approved, color: "text-green-600", bg: "bg-white", border: "border-gray-200" },
              { label: "Provinces Active", value: Object.keys(provinceStats).length, color: "text-purple-600", bg: "bg-white", border: "border-gray-200" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-xl p-6 shadow-sm`}>
                <p className={`text-3xl font-black ${stat.color} mb-1`}>{stat.value}</p>
                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Province Breakdown (Mini Table) */}
          <div className="mb-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaChartPie className="text-blue-500" /> Province Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(provinceStats).map(([province, count]) => (
                <div key={province} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-600 truncate mr-2 font-medium capitalize">{province.replace(/_/g, ' ')}</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operation Results Banner */}
          {operationResults && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className={`mb-6 p-4 rounded-lg border flex justify-between items-center ${
                operationResults.failed > 0 
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-green-50 border-green-200 text-green-800"
              }`}
            >
              <div className="flex items-center space-x-3">
                {operationResults.failed > 0 ? <FaExclamationTriangle /> : <FaCheckCircle />}
                <div>
                  <h4 className="font-bold">{operationResults.action.toUpperCase()} COMPLETED</h4>
                  <p className="text-sm opacity-80">{operationResults.successful} successful, {operationResults.failed} failed</p>
                </div>
              </div>
              <button onClick={() => setOperationResults(null)} className="opacity-60 hover:opacity-100"><FaTimes /></button>
            </motion.div>
          )}

          {/* Filters & Bulk Actions Container */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
            
            {/* Top Row: Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search name, ID, province, email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                <select 
                  value={provinceFilter}
                  onChange={(e) => setProvinceFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none min-w-[160px]"
                >
                  <option value="all">All Provinces</option>
                  {provinceOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                <button 
                  onClick={exportToCSV} 
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md transition-colors whitespace-nowrap"
                >
                  <FaDownload /> CSV
                </button>
              </div>
            </div>

            {/* Bottom Row: Bulk Actions (Conditional) */}
            {selectedTickets.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: "auto" }}
                className="pt-4 border-t border-gray-100 flex flex-wrap gap-4 justify-between items-center"
              >
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-lg">
                  <FaUsers className="text-blue-600" />
                  <span className="font-bold text-blue-800 text-sm">{selectedTickets.size} selected</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase text-gray-400 hidden sm:inline">Apply to selected:</span>
                  <div className="flex gap-2">
                    <button onClick={() => setBulkAction('approve')} className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors">Approve</button>
                    <button onClick={() => setBulkAction('reject')} className="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors">Reject</button>
                    <button onClick={() => setBulkAction('delete')} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">Delete</button>
                  </div>
                  
                  {bulkAction && (
                    <button
                      onClick={handleBulkAction}
                      disabled={isProcessing}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-md ml-2"
                    >
                      {isProcessing ? "..." : <><FaPaperPlane /> Confirm</>}
                    </button>
                  )}
                  <button onClick={() => setSelectedTickets(new Set())} className="text-xs text-gray-500 hover:text-gray-800 ml-2 underline">Cancel</button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  Loading Regional Data...
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs border-b border-gray-200">
                    <tr>
                      <th className="p-4 w-10"><input type="checkbox" onChange={handleSelectAll} className="rounded border-gray-300" /></th>
                      <th className="p-4 cursor-pointer hover:text-gray-800" onClick={() => handleSort("ticketId")}>ID</th>
                      <th className="p-4 cursor-pointer hover:text-gray-800" onClick={() => handleSort("fullName")}>Name</th>
                      <th className="p-4">Province</th>
                      <th className="p-4">Category</th>
                      <th className="p-4 cursor-pointer hover:text-gray-800" onClick={() => handleSort("status")}>Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedTickets.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-500">No tickets found.</td></tr>
                    ) : (
                      sortedTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="p-4"><input type="checkbox" checked={selectedTickets.has(ticket.id)} onChange={(e) => handleSelectTicket(ticket.id, e.target.checked)} className="rounded border-gray-300" /></td>
                          <td className="p-4 font-mono text-xs text-gray-600">{ticket.ticketId}</td>
                          <td className="p-4 font-bold text-gray-900">
                            {ticket.fullName}
                            <div className="text-[10px] font-normal text-gray-500">By: {ticket.registeredBy || 'Self'}</div>
                          </td>
                          <td className="p-4 text-gray-600 capitalize">{ticket.province.replace(/_/g, ' ')}</td>
                          <td className="p-4 capitalize text-gray-600">{ticket.category}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(ticket.status)}`}>
                              {ticket.status}
                            </span>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleApprove(ticket.id)} className="text-green-600 hover:text-green-800 p-1" title="Approve"><FaCheck /></button>
                            <button onClick={() => handleReject(ticket.id)} className="text-red-600 hover:text-red-800 p-1" title="Reject"><FaTimes /></button>
                            <button onClick={() => setSelectedTicket(ticket)} className="text-blue-600 hover:text-blue-800 p-1" title="View"><FaEye /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full relative shadow-xl">
            <button onClick={() => setSelectedTicket(null)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><FaTimes /></button>
            
            <div className="text-center mb-6">
              <h3 className="text-2xl font-black text-gray-900 uppercase">Candidate <span className="text-blue-600">Details</span></h3>
              <p className="text-sm text-gray-500 font-mono mt-1">{selectedTicket.ticketId}</p>
            </div>
            
            <div className="space-y-3 text-gray-700 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Full Name:</span> <span className="font-bold text-gray-900">{selectedTicket.fullName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Province:</span> <span className="font-bold text-gray-900">{selectedTicket.province}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Parish:</span> <span>{selectedTicket.parish}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Age/Gender:</span> <span>{selectedTicket.age} / {selectedTicket.gender}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Contact:</span> <span>{selectedTicket.phone}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span>Emergency:</span> <span className="text-red-600">{selectedTicket.emergencyPhone} ({selectedTicket.emergencyRelationship})</span>
              </div>
              <div className="flex justify-between pt-2">
                <span>Registered By:</span> <span className="italic opacity-70">{selectedTicket.registeredBy || 'Individual'}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { handleApprove(selectedTicket.id); setSelectedTicket(null); }} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg">Approve</button>
              <button onClick={() => { handleReject(selectedTicket.id); setSelectedTicket(null); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg">Reject</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AdminVerify;