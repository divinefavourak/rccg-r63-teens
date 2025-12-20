import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBulkOperations } from "../hooks/useBulkOperations";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BulkEmailModal from "../components/BulkEmailModal";
import TicketDetailsModal from "../components/TicketDetailsModal";
import { ticketService } from "../services/ticketService";
import { Ticket } from "../types";
import toast from "react-hot-toast";
import { CHURCH_INFO_FIELDS } from "../constants/formFields";
import {
  FaSearch, FaCheck, FaTimes, FaEye, FaDownload,
  FaUser, FaSignOutAlt, FaUsers,
  FaCheckCircle, FaExclamationTriangle, FaEnvelope, FaPaperPlane, FaChartPie, FaUserTie,
  FaChevronLeft, FaChevronRight
} from "react-icons/fa";

const AdminVerify = () => {
  console.log("AdminVerify updated version");
  const { user, logout, isAuthenticated } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [registeredByFilter, setRegisteredByFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [sortField, setSortField] = useState<keyof Ticket>("registeredAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [provinceStats, setProvinceStats] = useState<Record<string, { total: number; pending: number; approved: number; rejected: number }>>({});
  const [dashboardStats, setDashboardStats] = useState<{
    pending_tickets: number;
    approved_tickets: number;
    rejected_tickets: number;
  } | null>(null);


  const provinceOptions = CHURCH_INFO_FIELDS.find(field => field.name === 'province')?.options || [];

  // Helper to extract unique coordinator names from all loaded tickets for the filter dropdown
  // Note: ideally this should come from a distinct backend endpoint if the dataset is huge
  const uniqueCoordinators = Array.from(new Set(tickets.map(t => t.registeredBy || 'Self')))
    .filter(name => name !== 'Self')
    .sort();

  const {
    selectedTickets, setSelectedTickets, bulkAction, setBulkAction,
    isProcessing, operationResults, setOperationResults,
    handleSelectAll, handleSelectTicket, handleBulkAction, sendCustomEmail
  } = useBulkOperations(tickets, setTickets);

  // Fetch dashboard stats (province totals for ALL tickets)
  const fetchDashboardStats = async () => {
    try {
      const stats = await ticketService.getDashboardStats();
      setProvinceStats(stats.province_stats || {});
      setDashboardStats({
        pending_tickets: stats.pending_tickets,
        approved_tickets: stats.approved_tickets,
        rejected_tickets: stats.rejected_tickets,
      });
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    }
  };

  const fetchTickets = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      // Fetch paginated data with filters
      const response = await ticketService.getAllTickets(currentPage, searchTerm, {
        status: statusFilter,
        category: categoryFilter,
        province: provinceFilter,
        registered_by: registeredByFilter // Pass new filter to backend
      });

      setTickets(response.results);
      setTotalItems(response.count);
      setTotalPages(Math.ceil(response.count / 20));

    } catch (error) {
      console.error(error);
      toast.error("Failed to load tickets");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch dashboard stats on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardStats();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTickets();
    }, 500); // Debounce search/filter
    return () => clearTimeout(timer);
  }, [isAuthenticated, currentPage, searchTerm, statusFilter, categoryFilter, provinceFilter, registeredByFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter, provinceFilter, registeredByFilter]);


  const handleSort = (field: keyof Ticket) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Client-side sort of CURRENT PAGE
  const sortedTickets = [...tickets].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue === undefined || bValue === undefined) return 0;
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleApprove = async (id: string) => {
    try {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: "approved" } : t));
      toast.success("Ticket Approved");
      await ticketService.updateTicketStatus(id, "approved");
    } catch (err) {
      toast.error("Failed to approve ticket");
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Are you sure you want to reject this ticket?")) return;
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

  const handleTemplateSend = async (templateAction: string, recipients: string) => {
    try {
      // Determine which ticket IDs to send to based on recipients
      let ticketIds: string[] = [];

      if (recipients === 'selected') {
        ticketIds = Array.from(selectedTickets);
      } else {
        // For other recipient types, we need to send to the appropriate tickets
        // The backend bulk_action will handle all selected IDs
        ticketIds = Array.from(selectedTickets);
      }

      if (ticketIds.length === 0) {
        toast.error("No recipients selected");
        return;
      }

      // Call the bulk action API with the template action
      await ticketService.performBulkAction(ticketIds, templateAction);

      setShowEmailModal(false);
      toast.success(`${templateAction.replace('_', ' ')} sent to ${ticketIds.length} recipients!`);
    } catch (error) {
      console.error("Template send failed:", error);
      toast.error("Failed to send template email");
    }
  };

  const exportToCSV = () => {
    const headers = ["Ticket ID", "Name", "Source", "Age", "Category", "Province", "Church", "Status", "Registered By"];
    const csvData = tickets.map(ticket => [
      ticket.ticketId,
      `"${ticket.fullName}"`,
      ticket.registrationType || 'individual',
      ticket.age,
      ticket.category,
      `"${ticket.province}"`,
      `"${ticket.parish}"`,
      ticket.status,
      ticket.registeredBy || "Self"
    ]);

    const csvContent = [headers, ...csvData].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_page_${currentPage}.csv`;
    a.click();
    toast.success("Page Report Downloaded!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return "bg-green-100 text-green-800 border-green-200";
      case 'pending': return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'rejected': return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
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
              <h1 className="text-3xl font-black text-gray-900">ADMIN <span className="text-blue-600">DASHBOARD</span></h1>
              <p className="text-gray-500 mt-1">Overview of all Provinces</p>
            </div>
            <div className="flex gap-3 mt-4 lg:mt-0">
              <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowEmailModal(true)} disabled={selectedTickets.size === 0} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"><FaEnvelope /> <span>Broadcast ({selectedTickets.size})</span></motion.button>
              <motion.button whileHover={{ scale: 1.05 }} onClick={logout} className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors shadow-sm"><FaSignOutAlt /> <span>Logout</span></motion.button>
            </div>
          </div>

          {/* Key Metrics - From Dashboard API */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-3xl font-black text-blue-600 mb-1">{totalItems}</p>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Total Tickets</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-3xl font-black text-purple-600 mb-1">{Object.keys(provinceStats).length}</p>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Provinces</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-3xl font-black text-yellow-600 mb-1">{dashboardStats?.pending_tickets ?? '-'}</p>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Pending</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-3xl font-black text-green-600 mb-1">{dashboardStats?.approved_tickets ?? '-'}</p>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Approved</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-3xl font-black text-red-600 mb-1">{dashboardStats?.rejected_tickets ?? '-'}</p>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Rejected</p>
            </div>
          </div>

          {/* Province Breakdown */}
          {Object.keys(provinceStats).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FaChartPie className="text-purple-600" /> Province Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Object.entries(provinceStats)
                  .sort((a, b) => b[1].total - a[1].total) // Sort by total (highest first)
                  .map(([province, stats]) => {
                    const label = provinceOptions.find(p => p.value === province)?.label || province.replace(/_/g, ' ');
                    return (
                      <div key={province} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 hover:bg-gray-100 transition-colors">
                        <span className="text-sm font-medium text-gray-700 capitalize truncate" title={label}>{label}</span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold" title="Pending">{stats.pending}</span>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold" title="Approved">{stats.approved}</span>
                          <span className="text-lg font-black text-purple-600">{stats.total}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Filters & Actions */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search name, ID, province, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                <select value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none min-w-[160px]">
                  <option value="all">All Provinces</option>
                  {provinceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none">
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={registeredByFilter} onChange={(e) => setRegisteredByFilter(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none min-w-[200px]">
                  <option value="all">All Registrants</option>
                  <option value="Self">Self (Individual)</option>
                  {uniqueCoordinators.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button onClick={exportToCSV} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md transition-colors whitespace-nowrap"><FaDownload /> CSV</button>
              </div>
            </div>

            {selectedTickets.size > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-4 border-t border-gray-100 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-lg"><FaUsers className="text-blue-600" /><span className="font-bold text-blue-800 text-sm">{selectedTickets.size} selected</span></div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <button onClick={() => setBulkAction('approve')} className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors">Approve</button>
                    <button onClick={() => setBulkAction('reject')} className="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors">Reject</button>
                    <button onClick={() => setBulkAction('delete')} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">Delete</button>
                  </div>
                  {bulkAction && <button onClick={handleBulkAction} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-md ml-2">{isProcessing ? "..." : <><FaPaperPlane /> Confirm</>}</button>}
                  <button onClick={() => setSelectedTickets(new Set())} className="text-xs text-gray-500 hover:text-gray-800 ml-2 underline">Cancel</button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-12 text-center text-gray-500"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>Loading Regional Data...</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs border-b border-gray-200">
                    <tr>
                      <th className="p-4 w-10"><input type="checkbox" onChange={handleSelectAll} className="rounded border-gray-300" /></th>
                      <th className="p-4 cursor-pointer hover:text-gray-800" onClick={() => handleSort("ticketId")}>ID</th>
                      <th className="p-4 cursor-pointer hover:text-gray-800" onClick={() => handleSort("fullName")}>Name</th>
                      <th className="p-4">Source</th>
                      <th className="p-4">Province</th>
                      <th className="p-4">Category</th>
                      <th className="p-4 cursor-pointer hover:text-gray-800" onClick={() => handleSort("status")}>Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedTickets.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-500">No tickets found.</td></tr>
                    ) : (
                      sortedTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="p-4"><input type="checkbox" checked={selectedTickets.has(ticket.id)} onChange={(e) => handleSelectTicket(ticket.id, e.target.checked)} className="rounded border-gray-300" /></td>
                          <td className="p-4 font-mono text-xs text-gray-600">{ticket.ticketId}</td>
                          <td className="p-4 font-bold text-gray-900">{ticket.fullName}<div className="text-[10px] font-normal text-gray-500">By: {ticket.registeredBy || 'Self'}</div></td>
                          <td className="p-4">
                            {ticket.registrationType === 'coordinator' ?
                              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold border border-purple-200"><FaUserTie className="text-xs" /> Coordinator</span> :
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold border border-blue-200"><FaUser className="text-xs" /> Individual</span>
                            }
                          </td>
                          <td className="p-4 text-gray-600 capitalize">{ticket.province.replace(/_/g, ' ')}</td>
                          <td className="p-4 capitalize text-gray-600">{ticket.category}</td>
                          <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(ticket.status)}`}>{ticket.status}</span></td>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <FaChevronLeft /> Previous
                </button>
                <div className="text-sm text-gray-600 font-medium">
                  Page <span className="text-gray-900">{currentPage}</span> of <span className="text-gray-900">{totalPages}</span>
                </div>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  Next <FaChevronRight />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <BulkEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleEmailSend}
        onSendTemplate={handleTemplateSend}
        selectedCount={selectedTickets.size}
        totalCount={totalItems}
        pendingCount={dashboardStats?.pending_tickets ?? 0}
        approvedCount={dashboardStats?.approved_tickets ?? 0}
      />

      <TicketDetailsModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onApprove={async (id) => {
          await handleApprove(id);
          setSelectedTicket(null);
        }}
        onReject={async (id) => {
          await handleReject(id);
          setSelectedTicket(null);
        }}
      />
      <Footer />
    </div>
  );
};

export default AdminVerify;