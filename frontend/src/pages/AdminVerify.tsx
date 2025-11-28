import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBulkOperations } from "../hooks/useBulkOperations";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BulkEmailModal from "../components/BulkEmailModal";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { 
  FaSearch, 
  FaFilter, 
  FaCheck, 
  FaTimes, 
  FaEye, 
  FaDownload,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaChurch,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaEnvelopeOpen,
  FaUsers,
  FaCheckCircle,
  FaExclamationTriangle
} from "react-icons/fa";
import { 
  Users, 
  CheckCircle, 
  Clock, 
  XCircle,
  Mail,
  BarChart3,
  Send
} from "lucide-react";

const AdminVerify = () => {
  const { logout } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [sortField, setSortField] = useState("registeredAt");
  const [sortDirection, setSortDirection] = useState("desc");
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

  // Sample data for demonstration
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
        medications: "None",
        dietaryRestrictions: "none",
        emergencyContact: "Mrs. Adebayo",
        emergencyPhone: "+234 800 987 6543",
        emergencyRelationship: "Mother",
        parentName: "Mr. & Mrs. Adebayo",
        parentEmail: "parents@example.com",
        parentPhone: "+234 800 987 6543",
        parentRelationship: "parents",
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
        medicalConditions: "Asthma - uses inhaler",
        medications: "Ventolin inhaler",
        dietaryRestrictions: "none",
        emergencyContact: "Dr. Johnson",
        emergencyPhone: "+234 800 987 6544",
        emergencyRelationship: "Father",
        parentName: "Dr. Johnson",
        parentEmail: "dr.johnson@example.com",
        parentPhone: "+234 800 987 6544",
        parentRelationship: "father",
        status: "approved",
        registeredAt: "2024-01-14T14:20:00Z"
      },
      {
        id: 3,
        ticketId: "R63T123458",
        fullName: "Michael Brown",
        age: "17",
        category: "super_teens",
        gender: "male",
        phone: "+234 800 123 4569",
        email: "michael.b@example.com",
        province: "Province 1",
        zone: "Zone 3",
        area: "Area 1",
        parish: "RCCG Victory Cathedral",
        department: "Media",
        medicalConditions: "None",
        medications: "None",
        dietaryRestrictions: "vegetarian",
        emergencyContact: "Mrs. Brown",
        emergencyPhone: "+234 800 987 6545",
        emergencyRelationship: "Mother",
        parentName: "Mr. Brown",
        parentEmail: "brown.family@example.com",
        parentPhone: "+234 800 987 6545",
        parentRelationship: "father",
        status: "rejected",
        registeredAt: "2024-01-13T09:15:00Z"
      },
      {
        id: 4,
        ticketId: "R63T123459",
        fullName: "Grace Williams",
        age: "8",
        category: "children_6_8",
        gender: "female",
        phone: "+234 800 123 4570",
        email: "grace.w@example.com",
        province: "Province 3",
        zone: "Zone 1",
        area: "Area 3",
        parish: "RCCG Living Spring Parish",
        department: "Children Church",
        medicalConditions: "Peanut allergy",
        medications: "EpiPen",
        dietaryRestrictions: "allergies",
        emergencyContact: "Mr. Williams",
        emergencyPhone: "+234 800 987 6546",
        emergencyRelationship: "Father",
        parentName: "Mr. Williams",
        parentEmail: "williams@example.com",
        parentPhone: "+234 800 987 6546",
        parentRelationship: "father",
        status: "pending",
        registeredAt: "2024-01-16T11:45:00Z"
      },
      {
        id: 5,
        ticketId: "R63T123460",
        fullName: "David Thompson",
        age: "16",
        category: "teens",
        gender: "male",
        phone: "+234 800 123 4571",
        email: "david.t@example.com",
        province: "Province 1",
        zone: "Zone 2",
        area: "Area 1",
        parish: "RCCG King's Court",
        department: "Teens Church",
        medicalConditions: "None",
        medications: "None",
        dietaryRestrictions: "none",
        emergencyContact: "Mrs. Thompson",
        emergencyPhone: "+234 800 987 6547",
        emergencyRelationship: "Mother",
        parentName: "Mrs. Thompson",
        parentEmail: "thompson@example.com",
        parentPhone: "+234 800 987 6547",
        parentRelationship: "mother",
        status: "pending",
        registeredAt: "2024-01-17T08:20:00Z"
      }
    ];

    setTickets(sampleTickets);
    setFilteredTickets(sampleTickets);
    calculateStats(sampleTickets);
  }, []);

  const calculateStats = (ticketsList) => {
    const stats = {
      total: ticketsList.length,
      pending: ticketsList.filter(t => t.status === 'pending').length,
      approved: ticketsList.filter(t => t.status === 'approved').length,
      rejected: ticketsList.filter(t => t.status === 'rejected').length
    };
    setStats(stats);
  };

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    filterTickets(term, statusFilter, categoryFilter);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    filterTickets(searchTerm, status, categoryFilter);
  };

  const handleCategoryFilter = (category) => {
    setCategoryFilter(category);
    filterTickets(searchTerm, statusFilter, category);
  };

  const filterTickets = (search, status, category) => {
    let filtered = tickets;

    if (search) {
      filtered = filtered.filter(ticket =>
        ticket.fullName.toLowerCase().includes(search) ||
        ticket.ticketId.toLowerCase().includes(search) ||
        ticket.email.toLowerCase().includes(search) ||
        ticket.parish.toLowerCase().includes(search)
      );
    }

    if (status !== "all") {
      filtered = filtered.filter(ticket => ticket.status === status);
    }

    if (category !== "all") {
      filtered = filtered.filter(ticket => ticket.category === category);
    }

    setFilteredTickets(filtered);
    calculateStats(filtered);
  };

  const handleSort = (field) => {
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
    
    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const handleApprove = (ticketId) => {
    setTickets(prev => prev.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "approved" } : ticket
    ));
    setFilteredTickets(prev => prev.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "approved" } : ticket
    ));
    calculateStats(filteredTickets.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "approved" } : ticket
    ));
  };

  const handleReject = (ticketId) => {
    setTickets(prev => prev.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "rejected" } : ticket
    ));
    setFilteredTickets(prev => prev.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "rejected" } : ticket
    ));
    calculateStats(filteredTickets.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: "rejected" } : ticket
    ));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return "bg-green-100 text-green-800";
      case 'pending':
        return "bg-yellow-100 text-yellow-800";
      case 'rejected':
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getCategoryLabel = (category) => {
    const categories = {
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
  };

  const handleEmailSend = async (subject, message, recipients) => {
    await sendCustomEmail(subject, message, recipients);
    setShowEmailModal(false);
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
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
            <div className="text-center lg:text-left mb-4 lg:mb-0">
              <h1 className="text-4xl font-black text-gray-800 mb-2">
                Admin <span className="text-gradient">Dashboard</span>
              </h1>
              <p className="text-gray-600 max-w-2xl">
                Manage and verify participant registrations for {EVENT_DETAILS.title}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEmailModal(true)}
                disabled={selectedTickets.size === 0}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Email ({selectedTickets.size})</span>
              </motion.button>
              
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
          </div>

          {/* Operation Results */}
          {operationResults && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className={`mb-6 p-4 rounded-lg border ${
                operationResults.failed > 0 
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-green-50 border-green-200 text-green-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {operationResults.failed > 0 ? (
                    <FaExclamationTriangle className="text-red-600" />
                  ) : (
                    <FaCheckCircle className="text-green-600" />
                  )}
                  <div>
                    <h4 className="font-semibold">
                      {operationResults.action.replace('_', ' ').toUpperCase()} Completed
                    </h4>
                    <p className="text-sm">
                      {operationResults.successful} successful, {operationResults.failed} failed
                      {operationResults.error && ` - ${operationResults.error}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOperationResults(null)}
                  className="text-gray-400 hover:text-gray-600"
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
              className="card p-4 mb-6 bg-yellow-50 border border-yellow-200"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <FaUsers className="text-yellow-600" />
                  <span className="font-semibold text-yellow-800">
                    {selectedTickets.size} ticket(s) selected
                  </span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    disabled={isProcessing}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
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
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{isProcessing ? "Processing..." : "Apply"}</span>
                  </motion.button>
                  
                  <button
                    onClick={() => setSelectedTickets(new Set())}
                    disabled={isProcessing}
                    className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="card p-6 text-center"
            >
              <div className="flex items-center justify-center space-x-3 mb-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                  <div className="text-sm text-gray-600">Total Registrations</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="card p-6 text-center"
            >
              <div className="flex items-center justify-center space-x-3 mb-3">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-800">{stats.pending}</div>
                  <div className="text-sm text-gray-600">Pending Approval</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="card p-6 text-center"
            >
              <div className="flex items-center justify-center space-x-3 mb-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-800">{stats.approved}</div>
                  <div className="text-sm text-gray-600">Approved</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="card p-6 text-center"
            >
              <div className="flex items-center justify-center space-x-3 mb-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-800">{stats.rejected}</div>
                  <div className="text-sm text-gray-600">Rejected</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters and Search */}
          <div className="card p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ticket ID, email, or church..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <FaFilter className="text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-gray-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => handleCategoryFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <FaDownload />
                <span>Export CSV</span>
              </motion.button>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="card p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 w-12">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedTickets.size === filteredTickets.length && filteredTickets.length > 0}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </th>
                    <th 
                      className="text-left py-3 px-4 cursor-pointer"
                      onClick={() => handleSort("ticketId")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Ticket ID</span>
                        {sortField === "ticketId" && (
                          sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 cursor-pointer"
                      onClick={() => handleSort("fullName")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Participant</span>
                        {sortField === "fullName" && (
                          sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4">Category</th>
                    <th className="text-left py-3 px-4">Church</th>
                    <th 
                      className="text-left py-3 px-4 cursor-pointer"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {sortField === "status" && (
                          sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 cursor-pointer"
                      onClick={() => handleSort("registeredAt")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Registered</span>
                        {sortField === "registeredAt" && (
                          sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTickets.map((ticket) => (
                    <motion.tr
                      key={ticket.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedTickets.has(ticket.id)}
                          onChange={(e) => handleSelectTicket(ticket.id, e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-gray-600">
                        {ticket.ticketId}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-semibold text-gray-800">{ticket.fullName}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <FaUser className="mr-1" />
                            {ticket.age} yrs • {ticket.gender}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {getCategoryLabel(ticket.category)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-800">{ticket.parish}</div>
                          <div className="text-gray-500 text-xs">{ticket.area}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getStatusColor(ticket.status)}`}>
                          {getStatusIcon(ticket.status)}
                          <span className="capitalize">{ticket.status}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(ticket.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSelectedTicket(ticket)}
                            className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
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
                                className="p-1 text-green-600 hover:text-green-800 transition-colors"
                                title="Approve"
                              >
                                <FaCheck />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleReject(ticket.id)}
                                className="p-1 text-red-600 hover:text-red-800 transition-colors"
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

              {sortedTickets.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No tickets found matching your criteria.
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Ticket Details</h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">Personal Information</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Full Name:</span>
                    <span className="font-semibold">{selectedTicket.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Age:</span>
                    <span className="font-semibold">{selectedTicket.age} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Category:</span>
                    <span className="font-semibold">{getCategoryLabel(selectedTicket.category)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gender:</span>
                    <span className="font-semibold capitalize">{selectedTicket.gender}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">Contact Information</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-semibold">{selectedTicket.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-semibold">{selectedTicket.email}</span>
                  </div>
                </div>
              </div>

              {/* Church Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">Church Information</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Province:</span>
                    <span className="font-semibold">{selectedTicket.province}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Zone:</span>
                    <span className="font-semibold">{selectedTicket.zone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Area:</span>
                    <span className="font-semibold">{selectedTicket.area}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Parish:</span>
                    <span className="font-semibold">{selectedTicket.parish}</span>
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">Medical Information</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conditions:</span>
                    <span className="font-semibold">{selectedTicket.medicalConditions || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medications:</span>
                    <span className="font-semibold">{selectedTicket.medications || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dietary:</span>
                    <span className="font-semibold capitalize">{selectedTicket.dietaryRestrictions || "No restrictions"}</span>
                  </div>
                </div>
              </div>

              {/* Parent Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">Parent/Guardian</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-semibold">{selectedTicket.parentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-semibold">{selectedTicket.parentEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-semibold">{selectedTicket.parentPhone}</span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 border-b pb-2">Emergency Contact</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-semibold">{selectedTicket.emergencyContact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-semibold">{selectedTicket.emergencyPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Relationship:</span>
                    <span className="font-semibold capitalize">{selectedTicket.emergencyRelationship}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {selectedTicket.status === "pending" && (
              <div className="flex space-x-4 mt-6 pt-6 border-t border-gray-200">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleApprove(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold"
                >
                  Approve Registration
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleReject(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold"
                >
                  Reject Registration
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