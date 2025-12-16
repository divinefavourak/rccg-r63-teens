import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaCheck, FaBan, FaDownload, FaFilePdf, FaImage } from "react-icons/fa";
import { Ticket } from "../types";

interface TicketDetailsModalProps {
    ticket: Ticket | null;
    onClose: () => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}

const TicketDetailsModal = ({ ticket, onClose, onApprove, onReject }: TicketDetailsModalProps) => {
    if (!ticket) return null;

    const isPdf = ticket.proof_of_payment?.toLowerCase().endsWith(".pdf");

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900">Ticket Details</h2>
                            <p className="text-sm text-gray-500 font-mono">{ticket.ticketId}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                            <FaTimes className="text-gray-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto flex-1">
                        <div className="grid md:grid-cols-2 gap-6 mb-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 border-b pb-2">Personal Info</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-gray-500">Name:</span> <span className="font-medium">{ticket.fullName}</span>
                                    <span className="text-gray-500">Age:</span> <span className="font-medium">{ticket.age}</span>
                                    <span className="text-gray-500">Gender:</span> <span className="font-medium capitalize">{ticket.gender}</span>
                                    <span className="text-gray-500">Category:</span> <span className="font-medium capitalize">{ticket.category}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 border-b pb-2">Church Info</h3>
                                <div className="grid grid-cols-1 gap-2 text-sm">
                                    <span className="text-gray-500">Province:</span> <span className="font-medium capitalize">{ticket.province?.replace(/_/g, ' ')}</span>
                                    <span className="text-gray-500">Parish:</span> <span className="font-medium capitalize">{ticket.parish}</span>
                                </div>
                            </div>
                        </div>

                        {/* Proof of Payment */}
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                Payment Proof
                                <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${ticket.payment_status === 'verified' ? 'bg-green-100 text-green-700' :
                                        ticket.payment_status === 'verification_pending' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {ticket.payment_status?.replace(/_/g, ' ')}
                                </span>
                            </h3>

                            {ticket.proof_of_payment ? (
                                <div className="space-y-3">
                                    <div className="border rounded-lg overflow-hidden bg-white h-64 flex items-center justify-center">
                                        {isPdf ? (
                                            <div className="text-center">
                                                <FaFilePdf className="text-red-500 text-5xl mx-auto mb-2" />
                                                <p className="text-sm text-gray-500">PDF Document</p>
                                            </div>
                                        ) : (
                                            <img
                                                src={ticket.proof_of_payment}
                                                alt="Proof of Payment"
                                                className="w-full h-full object-contain"
                                            />
                                        )}
                                    </div>
                                    <a
                                        href={ticket.proof_of_payment}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-bold text-sm"
                                    >
                                        <FaDownload /> View / Download Proof
                                    </a>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                                    <FaImage className="mx-auto text-3xl mb-2 opacity-50" />
                                    No payment proof uploaded yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4 justify-end">
                        <button
                            onClick={() => onReject(ticket.id)}
                            className="px-6 py-2 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 transition-colors flex items-center gap-2"
                        >
                            <FaBan /> Reject
                        </button>
                        <button
                            onClick={() => onApprove(ticket.id)}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-500 transition-colors shadow-lg flex items-center gap-2"
                        >
                            <FaCheck /> Approve Ticket
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TicketDetailsModal;
