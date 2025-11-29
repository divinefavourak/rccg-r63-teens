import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FaTimes, FaEnvelope } from "react-icons/fa";
import { EVENT_DETAILS } from "../constants/eventDetails";

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, message: string, recipients: string) => void;
  selectedCount: number;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
}

interface EmailData {
  subject: string;
  message: string;
  recipients: string;
}

const BulkEmailModal = ({ 
  isOpen, 
  onClose, 
  onSend, 
  selectedCount, 
  totalCount, 
  pendingCount, 
  approvedCount 
}: BulkEmailModalProps) => {
  const [emailData, setEmailData] = useState<EmailData>({
    subject: "",
    message: "",
    recipients: "selected"
  });

  // Early return must be AFTER all hooks (useState)
  // However, for a modal that conditionally renders, we usually put the condition inside the return
  // or use AnimatePresence. Moving hooks above the if(!isOpen) check is safer.
  
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailData.subject.trim() || !emailData.message.trim()) return;
    
    onSend(emailData.subject, emailData.message, emailData.recipients);
    setEmailData({ subject: "", message: "", recipients: "selected" });
  };

  const predefinedTemplates = [
    {
      name: "Welcome Email",
      subject: "Welcome to RCCG Region 63 Teens Camp!",
      message: `Dear {name},\n\nWelcome to the RCCG Region 63 Teens Camp! We're excited to have you join us for this amazing experience.\n\nSee you at the camp!\n\nBlessings,\nRCCG Region 63 Team`
    },
    {
      name: "Payment Reminder",
      subject: "Payment Reminder - RCCG Teens Camp",
      message: `Dear {name},\n\nThis is a friendly reminder about your camp registration payment.\n\nThank you!\nRCCG Region 63 Team`
    }
  ];

  const applyTemplate = (template: { subject: string; message: string }) => {
    setEmailData(prev => ({
      ...prev,
      subject: template.subject,
      message: template.message
    }));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">Send Bulk Email</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Recipients</label>
              <select
                value={emailData.recipients}
                onChange={(e) => setEmailData(prev => ({ ...prev, recipients: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="selected">Selected Tickets ({selectedCount})</option>
                <option value="pending">All Pending ({pendingCount})</option>
                <option value="approved">All Approved ({approvedCount})</option>
                <option value="all">All Participants ({totalCount})</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Quick Templates</label>
              <div className="flex gap-2">
                {predefinedTemplates.map((template, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded border border-gray-300"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
              <input
                type="text"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
              <textarea
                value={emailData.message}
                onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div className="flex space-x-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <FaEnvelope /> Send Email
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-6 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BulkEmailModal;