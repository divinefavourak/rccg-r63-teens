import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { ticketService } from "../services/ticketService";
import { Ticket } from "../types";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { FaUserPlus, FaDownload, FaSignOutAlt, FaUsers, FaSearch } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const CoordinatorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'coordinator') {
      navigate('/coordinator-login');
      return;
    }

    const fetchMyData = async () => {
      // In a real app, backend filters this. Here we filter locally.
      const allTickets = await ticketService.getAllTickets();
      // Normalize province names for comparison (remove spaces, lowercase)
      const normalize = (str: string) => str.toLowerCase().replace(/\s/g, '');
      
      const filtered = allTickets.filter(t => 
        normalize(t.province) === normalize(user.province || '')
      );
      setMyTickets(filtered);
      setLoading(false);
    };

    fetchMyData();
  }, [user, navigate]);

  const filteredList = myTickets.filter(t => 
    t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.ticketId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownloadCSV = () => {
    if (myTickets.length === 0) return toast.error("No records to download");
    
    const headers = ["Ticket ID", "Name", "Age", "Gender", "Category", "Parish", "Status"];
    const csvContent = [
      headers.join(","),
      ...myTickets.map(t => [t.ticketId, t.fullName, t.age, t.gender, t.category, t.parish, t.status].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${user?.province?.replace(/ /g, '_')}_Registration_List.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-200 dark:border-white/10 pb-6">
            <div>
              <h4 className="text-sm font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest mb-1">PROVINCIAL PORTAL</h4>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white">{user?.province}</h1>
              <p className="text-gray-500 dark:text-white/60 mt-1">Manage your province's registrations</p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <button onClick={logout} className="px-4 py-2 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors">
                <FaSignOutAlt /> Logout
              </button>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-500/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl">
                <FaUsers />
              </div>
              <div>
                <p className="text-2xl font-black text-blue-900 dark:text-white">{myTickets.length}</p>
                <p className="text-xs uppercase font-bold text-blue-600/60 dark:text-blue-300/60">Registered Candidates</p>
              </div>
            </div>

            <Link to="/coordinator/bulk-register" className="card p-6 hover:shadow-xl transition-all group cursor-pointer border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center text-yellow-600 dark:text-yellow-400 text-xl group-hover:scale-110 transition-transform">
                  <FaUserPlus />
                </div>
                <div>
                  <p className="font-bold text-lg group-hover:text-yellow-600 dark:group-hover:text-yellow-400">New Registration</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Add individual or bulk entries</p>
                </div>
              </div>
            </Link>

            <button onClick={handleDownloadCSV} className="card p-6 hover:shadow-xl transition-all group cursor-pointer border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-900/10 text-left">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 text-xl group-hover:scale-110 transition-transform">
                  <FaDownload />
                </div>
                <div>
                  <p className="font-bold text-lg group-hover:text-green-600 dark:group-hover:text-green-400">Download List</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Export as CSV file</p>
                </div>
              </div>
            </button>
          </div>

          {/* List Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-white/10 flex gap-4">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search name or Ticket ID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 dark:text-white"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 uppercase font-bold text-xs">
                  <tr>
                    <th className="p-4">Ticket ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Age / Gender</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Parish</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center">Loading...</td></tr>
                  ) : filteredList.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">No registrations found. Click "New Registration" to start.</td></tr>
                  ) : (
                    filteredList.map(ticket => (
                      <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-xs">{ticket.ticketId}</td>
                        <td className="p-4 font-bold">{ticket.fullName}</td>
                        <td className="p-4">{ticket.age} / {ticket.gender}</td>
                        <td className="p-4 capitalize">{ticket.category.replace('_', ' ')}</td>
                        <td className="p-4 truncate max-w-[200px]">{ticket.parish}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            ticket.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {ticket.status}
                          </span>
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