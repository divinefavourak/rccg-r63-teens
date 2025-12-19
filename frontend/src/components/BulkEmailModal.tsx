import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FaTimes, FaEnvelope, FaGift, FaClock, FaClipboardList, FaPaperPlane } from "react-icons/fa";

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, message: string, recipients: string) => void;
  onSendTemplate: (templateAction: string, recipients: string) => void;
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
  onSendTemplate,
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
  const [showCustom, setShowCustom] = useState(false);

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

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailData.subject.trim() || !emailData.message.trim()) return;

    onSend(emailData.subject, emailData.message, emailData.recipients);
    setEmailData({ subject: "", message: "", recipients: "selected" });
    setShowCustom(false);
  };

  const handleTemplateClick = (templateAction: string) => {
    if (getRecipientsCount() === 0) return;
    onSendTemplate(templateAction, emailData.recipients);
  };

  const templateButtons = [
    {
      action: "welcome_email",
      name: "Welcome Email",
      description: "Send a welcome message with event details",
      icon: <FaGift className="text-2xl" />,
      color: "from-green-500 to-emerald-600"
    },
    {
      action: "payment_reminder",
      name: "Payment Reminder",
      description: "Remind to upload proof of payment",
      icon: <FaClock className="text-2xl" />,
      color: "from-yellow-500 to-orange-500"
    },
    {
      action: "final_instructions",
      name: "Final Instructions",
      description: "Send checklist and arrival info",
      icon: <FaClipboardList className="text-2xl" />,
      color: "from-blue-500 to-indigo-600"
    }
  ];

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
            <h3 className="text-2xl font-bold text-gray-800">📧 Send Bulk Email</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {/* Recipients Selector */}
          <div className="mb-6">
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
            <p className="text-sm text-gray-500 mt-1">
              Will send to <strong>{getRecipientsCount()}</strong> recipient(s)
            </p>
          </div>

          {!showCustom ? (
            <>
              {/* Template Buttons */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Quick Templates (Premium HTML Design)
                </label>
                <div className="grid gap-3">
                  {templateButtons.map((template) => (
                    <button
                      key={template.action}
                      type="button"
                      onClick={() => handleTemplateClick(template.action)}
                      disabled={getRecipientsCount() === 0}
                      className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${template.color} text-white hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        {template.icon}
                      </div>
                      <div className="text-left">
                        <p className="font-bold">{template.name}</p>
                        <p className="text-sm opacity-90">{template.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Email Option */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  <FaPaperPlane /> Write Custom Email
                </button>
              </div>
            </>
          ) : (
            /* Custom Email Form */
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← Back to Templates
              </button>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter email subject..."
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
                  placeholder="Enter email message..."
                  required
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  <FaEnvelope /> Send Custom Email
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
          )}

          {!showCustom && (
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-6 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BulkEmailModal;