import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { ticketService } from "../services/ticketService";
import { Ticket } from "../types";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  FaUserPlus, FaDownload, FaSignOutAlt, FaUsers, FaSearch,
  FaCheckCircle, FaExclamationTriangle, FaTimes, FaLayerGroup, FaSync,
  FaChevronLeft, FaChevronRight
} from "react-icons/fa";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import jsPDF from "jspdf";

const CoordinatorDashboard = () => {
  const { user, logout } = useAuth();
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchMyData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch paginated data from backend
      // Note: Backend handles province filtering automatically based on user role
      const response = await ticketService.getAllTickets(currentPage, searchTerm);

      setMyTickets(response.results);
      setTotalItems(response.count);
      setTotalPages(Math.ceil(response.count / 20)); // Assuming 20 items per page
    } catch (err) {
      console.error(err);
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search to prevent too many API calls
    const timer = setTimeout(() => {
      fetchMyData();
    }, 500);
    return () => clearTimeout(timer);
  }, [user, currentPage, searchTerm]);

  // Reset page when search term changes
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // ... (Keep handleDownloadCSV and handleBulkDownload) ...
  // Re-pasting them for completeness 
  const handleDownloadCSV = () => {
    if (myTickets.length === 0) return toast.error("No records to download (fetch more if needed)");
    // Note: This only downloads CURRENT PAGE unless we implement a "Download All" backend endpoint
    // For now, let's keep it as is, or warn user.
    // Better: Notify user this is current view only or implement full export.
    // Backend has export_pdf but not csv export endpoint yet?
    // Let's download current view for now.
    const headers = ["Ticket ID", "Name", "Age", "Gender", "Category", "Parish", "Status", "Registered At"];
    const csvContent = [headers.join(","), ...myTickets.map(t => [t.ticketId, `"${t.fullName}"`, t.age, t.gender, t.category, `"${t.parish}"`, t.status, new Date(t.registeredAt).toLocaleDateString()].join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${user?.province?.replace(/ /g, '_')}_List.csv`; a.click();
    toast.success("Current page list downloaded successfully!");
  };

  const handleBulkDownload = () => {
    // Warning: This only prints current page
    if (myTickets.length === 0) return toast.error("No tickets to download");
    const doc = new jsPDF();
    let yPos = 20;
    doc.setFontSize(16); doc.text(`JUNIOR CHURCH MEMBERS - ${user?.province} (Page ${currentPage})`, 105, 15, { align: "center" });
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 22, { align: "center" });
    myTickets.forEach((ticket, index) => {
      if (index > 0 && index % 5 === 0) { doc.addPage(); yPos = 20; }
      doc.setDrawColor(200); doc.rect(10, yPos, 190, 45);
      doc.setFontSize(12); doc.setTextColor(0); doc.setFont("helvetica", "bold");
      doc.text(`ID: ${ticket.ticketId}`, 15, yPos + 10);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`Name: ${ticket.fullName}`, 15, yPos + 20); doc.text(`Category: ${ticket.category}`, 15, yPos + 30);
      doc.text(`Gender: ${ticket.gender}`, 100, yPos + 20); doc.text(`Status: ${ticket.status.toUpperCase()}`, 100, yPos + 30);
      yPos += 55;
    });
    doc.save(`${user?.province}_Members_Page${currentPage}.pdf`); toast.success("List PDF downloaded successfully!");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
            <div>
              <h4 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1">PROVINCIAL PORTAL</h4>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase">{user?.province?.replace(/_/g, ' ')}</h1>
              <p className="text-gray-500 dark:text-white/60 mt-1">Manage registration records</p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <button onClick={() => fetchMyData()} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-2 transition-colors"><FaSync /> Refresh</button>
              <button onClick={logout} className="px-4 py-2 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"><FaSignOutAlt /> Logout</button>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400"><FaUsers /></div>
                <div><p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Total Registered</p><p className="text-2xl font-black">{totalItems}</p></div>
              </div>
              <div className="flex justify-between text-xs font-medium pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className="text-gray-500">Page {currentPage} of {totalPages}</span>
              </div>
            </div>
            <Link to="/coordinator/bulk-register" className="card p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-200 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 text-xl group-hover:scale-110 transition-transform"><FaLayerGroup /></div>
                <div><p className="font-bold text-lg text-gray-900 dark:text-white">Bulk Registration</p><p className="text-xs text-gray-500 dark:text-gray-400">Upload multiple candidates</p></div>
              </div>
            </Link>
            <Link to="/coordinator/single-register" className="card p-6 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-500/20 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-200 dark:bg-primary-500/20 flex items-center justify-center text-primary-700 dark:text-primary-400 text-xl group-hover:scale-110 transition-transform"><FaUserPlus /></div>
                <div><p className="font-bold text-lg text-gray-900 dark:text-white">Single Entry</p><p className="text-xs text-gray-500 dark:text-gray-400">Register one candidate</p></div>
              </div>
            </Link>
          </div>

          {/* List Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-gray-800">
              <div className="relative w-full md:w-96">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={handleSearch} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleDownloadCSV} className="bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">CSV</button>
                <button onClick={handleBulkDownload} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors shadow-sm"><FaDownload /> Members PDF</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase font-bold text-xs border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="p-4">ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Parish</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading records...</td></tr>
                  ) : myTickets.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center text-gray-500 flex flex-col items-center"><FaUsers className="text-4xl mb-2 opacity-20" /><p>No records found.</p></td></tr>
                  ) : (
                    myTickets.map(ticket => (
                      <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="p-4 font-mono text-xs text-primary-600 dark:text-primary-400">{ticket.ticketId}</td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">{ticket.fullName}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">{ticket.age} yrs • <span className="capitalize">{ticket.gender}</span></td>
                        <td className="p-4 capitalize text-gray-600 dark:text-gray-300">{ticket.category.replace('_', ' ')}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{ticket.parish}</td>
                        <td className="p-4">
                          {ticket.status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold"><FaCheckCircle /> Approved</span>}
                          {ticket.status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold"><FaExclamationTriangle /> Pending</span>}
                          {ticket.status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold"><FaTimes /> Rejected</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <FaChevronLeft /> Previous
                </button>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  Page <span className="text-gray-900 dark:text-white">{currentPage}</span> of <span className="text-gray-900 dark:text-white">{totalPages}</span>
                </div>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  Next <FaChevronRight />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CoordinatorDashboard;