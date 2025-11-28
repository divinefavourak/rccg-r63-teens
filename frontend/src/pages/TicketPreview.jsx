import { motion } from "framer-motion";
import { useLocation, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { FaDownload, FaShare, FaPrint, FaCheckCircle, FaClock, FaExclamationTriangle, FaChurch, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";

const TicketPreview = () => {
  const location = useLocation();
  const ticket = location.state?.ticket || getSampleTicket();

  // Fallback sample ticket for development
  function getSampleTicket() {
    return {
      ticketId: `R63T${Date.now()}`,
      fullName: "John Doe",
      age: "15",
      category: "teens",
      gender: "male",
      phone: "+234 800 123 4567",
      email: "john.doe@example.com",
      province: "province_1",
      zone: "Zone 1",
      area: "Area 1",
      parish: "RCCG Jesus Palace Parish",
      department: "teens_church",
      medicalConditions: "None",
      medications: "None",
      dietaryRestrictions: "none",
      emergencyContact: "Jane Doe",
      emergencyPhone: "+234 800 987 6543",
      emergencyRelationship: "Mother",
      parentName: "Jane Doe",
      parentEmail: "jane.doe@example.com",
      parentPhone: "+234 800 987 6543",
      parentRelationship: "mother",
      status: "pending",
      registeredAt: new Date().toISOString(),
    };
  }

  const getCategoryLabel = (category) => {
    const categories = {
      toddler: "Toddler (1-5 years)",
      children_6_8: "Children (6-8 years)",
      pre_teens: "Pre-Teens (9-12 years)",
      teens: "Teens (13-19 years)",
      super_teens: "Super Teens",
      alumni: "Alumni",
      teacher: "Teacher/Volunteer"
    };
    return categories[category] || category;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <FaCheckCircle className="text-green-500 text-xl" />;
      case 'pending':
        return <FaClock className="text-yellow-500 text-xl" />;
      case 'rejected':
        return <FaExclamationTriangle className="text-red-500 text-xl" />;
      default:
        return <FaClock className="text-yellow-500 text-xl" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return "bg-green-100 text-green-800 border-green-200";
      case 'pending':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'rejected':
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real app, this would generate a PDF
    alert("PDF download feature will be implemented soon!");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My RCCG Camp Ticket',
        text: `Check out my ticket for ${EVENT_DETAILS.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Ticket link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-black text-gray-800 mb-4"
            >
              Your <span className="text-gradient">Ticket</span> is Ready!
            </motion.h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Present this ticket at the registration desk. A consent email has been sent to your parent/guardian for approval.
            </p>
          </div>

          {/* Ticket Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="card p-8 mb-8 relative overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/10 to-yellow-600/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-400/10 to-purple-400/10 rounded-full translate-y-12 -translate-x-12"></div>

            <div className="relative z-10">
              {/* Ticket Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-800 mb-2">
                    {EVENT_DETAILS.title}
                  </h2>
                  <p className="text-gray-600">{EVENT_DETAILS.theme}</p>
                </div>
                <div className={`px-4 py-2 rounded-full border ${getStatusColor(ticket.status)} flex items-center space-x-2 mt-4 md:mt-0`}>
                  {getStatusIcon(ticket.status)}
                  <span className="font-semibold capitalize">{ticket.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Personal & Church Info */}
                <div className="space-y-6">
                  {/* Ticket ID */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-sm text-gray-500 font-medium mb-1">Ticket ID</div>
                    <div className="text-xl font-mono font-bold text-gray-800">{ticket.ticketId}</div>
                  </div>

                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center">
                      <FaUser className="mr-2 text-yellow-600" />
                      Personal Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Full Name:</span>
                        <span className="font-semibold">{ticket.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age:</span>
                        <span className="font-semibold">{ticket.age} years</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Category:</span>
                        <span className="font-semibold">{getCategoryLabel(ticket.category)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gender:</span>
                        <span className="font-semibold capitalize">{ticket.gender}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center">
                      <FaPhone className="mr-2 text-blue-600" />
                      Contact Information
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-semibold">{ticket.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-semibold">{ticket.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Column - Church & Medical Info */}
                <div className="space-y-6">
                  {/* Church Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center">
                      <FaChurch className="mr-2 text-purple-600" />
                      Church Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Province:</span>
                        <span className="font-semibold">{ticket.province?.replace('_', ' ').toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Zone:</span>
                        <span className="font-semibold">{ticket.zone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Area:</span>
                        <span className="font-semibold">{ticket.area}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Parish:</span>
                        <span className="font-semibold">{ticket.parish}</span>
                      </div>
                      {ticket.department && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Department:</span>
                          <span className="font-semibold capitalize">{ticket.department.replace('_', ' ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Medical Information</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-gray-600">Conditions:</span>
                        <p className="font-semibold">{ticket.medicalConditions || "None reported"}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Medications:</span>
                        <p className="font-semibold">{ticket.medications || "None"}</p>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dietary:</span>
                        <span className="font-semibold capitalize">{ticket.dietaryRestrictions || "No restrictions"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - QR Code & Event Details */}
                <div className="flex flex-col items-center justify-center space-y-6">
                  {/* QR Code */}
                  <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-dashed border-yellow-400">
                    <QRCodeSVG 
                      value={JSON.stringify({
                        ticketId: ticket.ticketId,
                        name: ticket.fullName,
                        event: EVENT_DETAILS.title
                      })}
                      size={200}
                      level="H"
                      includeMargin
                    />
                  </div>

                  {/* Event Details */}
                  <div className="text-center space-y-3">
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white py-3 px-6 rounded-xl">
                      <div className="font-bold text-lg">{EVENT_DETAILS.date}</div>
                      <div className="text-sm opacity-90">{EVENT_DETAILS.location}</div>
                    </div>
                    <div className="text-sm text-gray-600 max-w-xs flex items-center justify-center">
                      <FaMapMarkerAlt className="mr-2" />
                      {EVENT_DETAILS.address}
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center w-full">
                    <h4 className="font-semibold text-red-800 mb-2 flex items-center justify-center">
                      <FaPhone className="mr-2" />
                      Emergency Contact
                    </h4>
                    <div className="text-sm text-red-700 space-y-1">
                      <div className="font-semibold">{ticket.emergencyContact}</div>
                      <div>{ticket.emergencyPhone}</div>
                      <div className="text-xs">({ticket.emergencyRelationship})</div>
                    </div>
                  </div>

                  {/* Parent Information */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center w-full">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center justify-center">
                      <FaUser className="mr-2" />
                      Parent/Guardian
                    </h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div className="font-semibold">{ticket.parentName}</div>
                      <div>{ticket.parentEmail}</div>
                      <div>{ticket.parentPhone}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 mb-2">Important Instructions</h4>
                <ul className="text-sm text-green-700 space-y-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  <li className="flex items-center">
                    <FaCheckCircle className="mr-2 text-green-600" />
                    Present this ticket at registration
                  </li>
                  <li className="flex items-center">
                    <FaCheckCircle className="mr-2 text-green-600" />
                    Bring valid ID card
                  </li>
                  <li className="flex items-center">
                    <FaCheckCircle className="mr-2 text-green-600" />
                    Parent consent required
                  </li>
                  <li className="flex items-center">
                    <FaCheckCircle className="mr-2 text-green-600" />
                    Arrive 30 minutes early
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 pt-6 border-t border-gray-200">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePrint}
                  className="flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold"
                >
                  <FaPrint />
                  <span>Print Ticket</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownload}
                  className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold"
                >
                  <FaDownload />
                  <span>Download PDF</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleShare}
                  className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold"
                >
                  <FaShare />
                  <span>Share Ticket</span>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Next Steps Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card p-6"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">What's Next?</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaEnvelope className="text-yellow-600 text-xl" />
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Parent Consent</h4>
                <p className="text-sm text-gray-600">
                  We've sent a consent email to {ticket.parentEmail}. They need to approve your registration.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaClock className="text-blue-600 text-xl" />
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Approval Process</h4>
                <p className="text-sm text-gray-600">
                  Your ticket status will update to "Approved" once parent consent is received.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaCheckCircle className="text-green-600 text-xl" />
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Get Ready</h4>
                <p className="text-sm text-gray-600">
                  Prepare for an amazing experience! Bring your ticket and valid ID to the event.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Back to Home */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center mt-8"
          >
            <Link
              to="/"
              className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-8 rounded-lg transition-colors font-semibold"
            >
              ← Back to Home
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default TicketPreview;