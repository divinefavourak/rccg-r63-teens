import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { ticketService } from "../services/ticketService";
import { Ticket } from "../types";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { 
  FaUserPlus, FaDownload, FaSignOutAlt, FaUsers, FaSearch, 
  FaCheckCircle, FaExclamationTriangle, FaTimes, FaLayerGroup 
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import jsPDF from "jspdf";

const CoordinatorDashboard = () => {
  const { user, logout } = useAuth();
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'coordinator') return;

    const fetchMyData = async () => {
      try {
        const allTickets = await ticketService.getAllTickets();
        const normalize = (str: string) => str.toLowerCase().replace(/\s/g, '');
        const userProv = normalize(user.province || '');
        
        const filtered = allTickets.filter(t => 
          normalize(t.province).includes(userProv) || userProv.includes(normalize(t.province))
        );
        
        setMyTickets(filtered);
      } catch (err) {
        toast.error("Failed to load records");
      } finally {
        setLoading(false);
      }
    };

    fetchMyData();
  }, [user]);

  const filteredList = myTickets.filter(t => 
    t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.ticketId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: myTickets.length,
    approved: myTickets.filter(t => t.status === 'approved').length,
    pending: myTickets.filter(t => t.status === 'pending').length,
  };

  const handleDownloadCSV = () => {
    if (myTickets.length === 0) return toast.error("No records to download");
    
    const headers = ["Ticket ID", "Name", "Age", "Gender", "Category", "Parish", "Status", "Registered At"];
    const csvContent = [
      headers.join(","),
      ...myTickets.map(t => [
        t.ticketId, 
        `"${t.fullName}"`,
        t.age, 
        t.gender, 
        t.category, 
        `"${t.parish}"`, 
        t.status,
        new Date(t.registeredAt).toLocaleDateString()
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${user?.province?.replace(/ /g, '_')}_List.csv`;
    a.click();
    toast.success("List downloaded successfully!");
  };

  const handleBulkDownload = () => {
    if (myTickets.length === 0) return toast.error("No tickets to download");

    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(16);
    doc.text(`RCCG R63 CAMP TICKETS - ${user?.province}`, 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 22, { align: "center" });

    myTickets.forEach((ticket, index) => {
      if (index > 0 && index % 5 === 0) {
        doc.addPage();
        yPos = 20;
      }

      doc.setDrawColor(200);
      doc.rect(10, yPos, 190, 45); 

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(`TICKET ID: ${ticket.ticketId}`, 15, yPos + 10);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Name: ${ticket.fullName}`, 15, yPos + 20);
      doc.text(`Category: ${ticket.category.toUpperCase()}`, 15, yPos + 30);
      doc.text(`Gender: ${ticket.gender}`, 100, yPos + 20);
      doc.text(`Status: ${ticket.status.toUpperCase()}`, 100, yPos + 30);
      
      doc.setTextColor(100);
      doc.text("Present this ID at the gate.", 15, yPos + 40);

      yPos += 55;
    });

    doc.save(`${user?.province}_Tickets.pdf`);
    toast.success("Tickets PDF downloaded successfully!");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-200 dark:border-white/10 pb-6">
            <div>
              <h4 className="text-sm font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest mb-1">PROVINCIAL PORTAL</h4>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase">{user?.province}</h1>
              <p className="text-gray-500 dark:text-white/60 mt-1">Manage your province's registrations</p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <button onClick={logout} className="px-4 py-2 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors">
                <FaSignOutAlt /> Logout
              </button>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FaUsers />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Total Registered</p>
                  <p className="text-2xl font-black">{stats.total}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs font-medium pt-4 border-t border-gray-100 dark:border-white/5">
                <span className="text-green-600 dark:text-green-400">{stats.approved} Approved</span>
                <span className="text-yellow-600 dark:text-yellow-400">{stats.pending} Pending</span>
              </div>
            </div>

            <Link to="/coordinator/bulk-register" className="card p-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-200 dark:bg-yellow-500/20 flex items-center justify-center text-yellow-700 dark:text-yellow-400 text-xl group-hover:scale-110 transition-transform">
                  <FaLayerGroup />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">Bulk Registration</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Upload multiple candidates at once</p>
                </div>
              </div>
            </Link>

            <Link to="/coordinator/single-register" className="card p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-200 dark:bg-green-500/20 flex items-center justify-center text-green-700 dark:text-green-400 text-xl group-hover:scale-110 transition-transform">
                  <FaUserPlus />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">Single Entry</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Register one candidate manually</p>
                </div>
              </div>
            </Link>
          </div>

          {/* List Table */}
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-white/10 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-white/5">
              <div className="relative w-full md:w-96">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search name or Ticket ID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleDownloadCSV} className="bg-gray-800 dark:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 dark:hover:bg-white/20 transition-colors">CSV</button>
                <button onClick={handleBulkDownload} className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-700 transition-colors shadow-sm"><FaDownload /> Tickets PDF</button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 dark:bg-black/20 text-gray-500 dark:text-gray-400 uppercase font-bold text-xs border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="p-4">Ticket ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Parish</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading records...</td></tr>
                  ) : filteredList.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center text-gray-500 flex flex-col items-center">
                      <FaUsers className="text-4xl mb-2 opacity-20" />
                      <p>No candidates found for {user?.province}</p>
                      <Link to="/coordinator/single-register" className="text-yellow-600 dark:text-yellow-400 underline mt-2">Start Registration</Link>
                    </td></tr>
                  ) : (
                    filteredList.map(ticket => (
                      <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-xs text-yellow-600 dark:text-yellow-500/70">{ticket.ticketId}</td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">{ticket.fullName}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">{ticket.age} yrs • <span className="capitalize">{ticket.gender}</span></td>
                        <td className="p-4 capitalize text-gray-600 dark:text-gray-300">{ticket.category.replace('_', ' ')}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{ticket.parish}</td>
                        <td className="p-4">
                          {ticket.status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold"><FaCheckCircle /> Approved</span>}
                          {ticket.status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold"><FaExclamationTriangle /> Pending</span>}
                          {ticket.status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold"><FaTimes /> Rejected</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CoordinatorDashboard;