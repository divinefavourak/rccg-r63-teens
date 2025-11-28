import { motion } from "framer-motion";
import { useState } from "react";
import { FaTimes, FaEnvelope, FaUsers } from "react-icons/fa";

const BulkEmailModal = ({ isOpen, onClose, onSend, selectedCount, totalCount, pendingCount, approvedCount }) => {
  const [emailData, setEmailData] = useState({
    subject: "",
    message: "",
    recipients: "selected"
  });

  if (!isOpen) return null;

  const getRecipientsCount = () => {
    switch (emailData.recipients) {
      case "selected": return selectedCount;
      case "pending": return pendingCount;
      case "approved": return approvedCount;
      case "all": return totalCount;
      default: return 0;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!emailData.subject.trim() || !emailData.message.trim()) return;
    
    onSend(emailData.subject, emailData.message, emailData.recipients);
    setEmailData({ subject: "", message: "", recipients: "selected" });
  };

  const predefinedTemplates = [
    {
      name: "Welcome Email",
      subject: "Welcome to RCCG Region 63 Teens Camp!",
      message: `Dear {name},

Welcome to the RCCG Region 63 Teens Camp! We're excited to have you join us for this amazing experience.

Get ready for:
• Powerful worship sessions
• Engaging workshops
• Fun activities and games
• Life-changing encounters

See you at the camp!

Blessings,
RCCG Region 63 Team`
    },
    {
      name: "Payment Reminder",
      subject: "Payment Reminder - RCCG Teens Camp",
      message: `Dear {name},

This is a friendly reminder about your camp registration payment.

Please complete your payment at your earliest convenience to secure your spot.

Payment Details:
• Amount: ₦15,000
• Account: [Bank Details]

If you've already made payment, please disregard this message.

Thank you!
RCCG Region 63 Team`
    },
    {
      name: "Final Instructions",
      subject: "Final Instructions - Camp Preparation",
      message: `Dear {name},

The camp is almost here! Here are some final instructions:

What to Bring:
• Bible and notebook
• Comfortable clothing
• Toiletries
• Bedding (if required)
• Any medications

Arrival: Please arrive by 9:00 AM
Location: ${EVENT_DETAILS.location}

We can't wait to see you!

RCCG Region 63 Team`
    }
  ];

  const applyTemplate = (template) => {
    setEmailData(prev => ({
      ...prev,
      subject: template.subject,
      message: template.message
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">Send Bulk Email</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Recipients Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Recipients
            </label>
            <select
              value={emailData.recipients}
              onChange={(e) => setEmailData(prev => ({ ...prev, recipients: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="selected">Selected Tickets ({selectedCount})</option>
              <option value="pending">All Pending ({pendingCount})</option>
              <option value="approved">All Approved ({approvedCount})</option>
              <option value="all">All Participants ({totalCount})</option>
            </select>
          </div>

          {/* Email Templates */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quick Templates
            </label>
            <div className="grid grid-cols-1 gap-2">
              {predefinedTemplates.map((template, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-800">{template.name}</div>
                  <div className="text-sm text-gray-600 truncate">{template.subject}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={emailData.subject}
              onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Email subject..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={emailData.message}
              onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
              rows={8}
              placeholder="Type your message here... Use {name} for participant's name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          {/* Recipient Count */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-blue-700">
              <FaEnvelope />
              <span className="text-sm font-medium">
                This email will be sent to {getRecipientsCount()} recipient(s)
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4 border-t border-gray-200">
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold flex items-center justify-center space-x-2"
            >
              <FaEnvelope />
              <span>Send Email</span>
            </motion.button>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold"
            >
              Cancel
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default BulkEmailModal;