import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from 'axios';
import { FaUpload, FaFileInvoice, FaCheckCircle } from 'react-icons/fa';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ticketService } from '../services/ticketService';

// Get API URL from environment variables, fallback to the render URL if missing
const API_URL = import.meta.env.VITE_API_URL || 'https://rccg-r63-teens-backend.onrender.com/api';

const UploadPayment = () => {
    const navigate = useNavigate();
    const [ticketId, setTicketId] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size must be less than 5MB');
                return;
            }

            setSelectedFile(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ticketId.trim()) {
            toast.error('Please enter your ticket ID');
            return;
        }

        if (!selectedFile) {
            toast.error('Please select a payment proof file');
            return;
        }

        setUploading(true);

        try {
            // Step 1: Verify/find the ticket to get its UUID
            const ticket = await ticketService.verifyTicket(ticketId.trim());

            if (!ticket || !ticket.id) {
                toast.error('Ticket not found. Please check the ticket ID and try again.');
                setUploading(false);
                return;
            }

            // Step 2: Upload using the same endpoint as PaymentPage (by UUID)
            const formData = new FormData();
            formData.append('proof_of_payment', selectedFile);

            await axios.post(`${API_URL}/tickets/${ticket.id}/upload_proof/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('✅ Payment proof uploaded successfully! Awaiting verification.');

            // Reset form
            const savedTicketId = ticketId.trim();
            setTicketId('');
            setSelectedFile(null);

            // Navigate to ticket preview after 2 seconds
            setTimeout(() => {
                navigate(`/ticket-preview?ticket_id=${savedTicketId}`);
            }, 2000);

        } catch (error: any) {
            console.error('Upload error:', error);
            if (error.response?.status === 404) {
                toast.error('Ticket not found. Please check the ticket ID.');
            } else {
                toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to upload payment proof. Please try again.');
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] transition-colors duration-500">
            <Navbar />

            <div className="pt-28 pb-16 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl mx-auto"
                >
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="inline-block"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                                <FaFileInvoice className="text-4xl text-white" />
                            </div>
                        </motion.div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-white mb-2 font-['Impact'] tracking-wide">
                            UPLOAD <span className="text-yellow-600 dark:text-yellow-400">PAYMENT PROOF</span>
                        </h1>
                        <p className="text-gray-600 dark:text-red-200/70">
                            Already made payment? Upload your receipt for verification.
                        </p>
                    </div>

                    {/* Upload Form */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white dark:bg-[#1a0505] rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-yellow-600/20"
                    >
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Ticket ID Input */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-yellow-400 mb-2">
                                    Ticket ID *
                                </label>
                                <input
                                    type="text"
                                    value={ticketId}
                                    onChange={(e) => setTicketId(e.target.value)}
                                    placeholder="Enter your ticket ID (e.g., TKT-202512-00001)"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-yellow-600/30 bg-white dark:bg-[#2b0303] text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                                    required
                                />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-yellow-400 mb-2">
                                    Payment Receipt *
                                </label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleFileChange}
                                        className="block w-full text-sm text-gray-700 dark:text-gray-200 
                      file:mr-4 file:py-3 file:px-6 
                      file:rounded-lg file:border-0 
                      file:text-sm file:font-bold 
                      file:bg-yellow-100 file:text-yellow-700 
                      hover:file:bg-yellow-200 
                      dark:file:bg-yellow-800 dark:file:text-yellow-100
                      dark:hover:file:bg-yellow-700
                      cursor-pointer transition-all"
                                        required
                                    />
                                </div>
                                {selectedFile && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                        <FaCheckCircle />
                                        <span>Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                                    </div>
                                )}
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Accepted formats: JPG, PNG, PDF (Max size: 5MB)
                                </p>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={!ticketId.trim() || !selectedFile || uploading}
                                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105 ${!ticketId.trim() || !selectedFile || uploading
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed scale-100'
                                    : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {uploading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <FaUpload /> Upload Payment Proof
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Info Box */}
                        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4">
                            <h4 className="font-bold text-blue-800 dark:text-blue-400 mb-2 text-sm">
                                ℹ️ Important Information
                            </h4>
                            <ul className="text-sm text-blue-700 dark:text-blue-200/80 space-y-1">
                                <li>• Your payment will be verified by our team</li>
                                <li>• You will receive confirmation once approved</li>
                                <li>• Keep your ticket ID safe for future reference</li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* Back Link */}
                    <div className="text-center mt-8">
                        <button
                            onClick={() => navigate('/')}
                            className="text-sm font-bold text-gray-500 dark:text-white/40 hover:text-red-600 dark:hover:text-white transition-colors"
                        >
                            ← Return to Home
                        </button>
                    </div>
                </motion.div>
            </div>

            <Footer />
        </div>
    );
};

export default UploadPayment;
