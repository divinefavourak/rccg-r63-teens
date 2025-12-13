import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ticketService } from "../services/ticketService"; // Ensure this service method exists or use axios directly
import axios from "axios";

// Using a placeholder Bank Details constant
const BANK_DETAILS = {
    bankName: "Zenith Bank",
    accountNumber: "1310850769",
    accountName: "RCCG REGION 63 JUNIOR CHURCH",
    amount: "3,000"
};

const PaymentPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Get ticket data from navigation state
    const { ticket } = location.state || {}; // { ticket: { id: "...", ticketId: "...", ... } }

    useEffect(() => {
        if (!ticket) {
            toast.error("No ticket found. Please register first.");
            navigate("/register");
        }
    }, [ticket, navigate]);

    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = async (data: any) => {
        if (!ticket?.id) return;

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append("proof_of_payment", data.proof[0]);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

            // Use axios directly or add a method to ticketService
            await axios.post(`${apiUrl}/tickets/${ticket.id}/upload_proof/`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
                    setUploadProgress(percentCompleted);
                }
            });

            toast.success("Payment proof uploaded successfully!");
            // Redirect to preview with updated status context if needed (though backend verification takes time)
            navigate("/ticket-preview", { state: { ticket: { ...ticket, payment_status: 'verification_pending', status: 'pending' } } });

        } catch (error: any) {
            console.error("Upload error:", error);
            toast.error(error.response?.data?.detail || "Failed to upload payment proof. Please try again.");
        } finally {
            setIsSubmitting(false);
            setUploadProgress(0);
        }
    };

    if (!ticket) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
            <Navbar />
            <div className="pt-28 pb-16 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                >
                    <div className="text-center mb-10">
                        <h1 className="text-3xl md:text-5xl font-black mb-4 text-red-900 dark:text-white font-['Impact'] tracking-wide">
                            COMPLETE <span className="text-yellow-500">PAYMENT</span>
                        </h1>
                        <p className="text-gray-600 dark:text-red-100/80 text-lg">
                            Almost there! Please make a transfer to finalize your registration.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden p-8 md:p-12 relative">

                        {/* Ticket Summary */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-6 mb-8 text-center">
                            <p className="text-sm font-bold text-yellow-800 dark:text-yellow-400 uppercase tracking-widest mb-2">Registration for</p>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{ticket.full_name}</h2>
                            <p className="text-lg font-mono text-gray-600 dark:text-gray-300">Ticket ID: <span className="font-bold text-red-600 dark:text-red-400">{ticket.ticketId || ticket.ticket_id}</span></p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 mb-8">
                            {/* Bank Details */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold border-b border-gray-200 dark:border-white/10 pb-2 mb-4">🏦 Bank Details</h3>

                                <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-lg">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Bank Name</p>
                                    <p className="font-bold text-lg">{BANK_DETAILS.bankName}</p>
                                </div>

                                <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-lg">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Account Number</p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-2xl tracking-widest text-[#8B0000] dark:text-yellow-500">{BANK_DETAILS.accountNumber}</p>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(BANK_DETAILS.accountNumber); toast.success("Copied!"); }}
                                            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-lg">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Account Name</p>
                                    <p className="font-bold text-lg">{BANK_DETAILS.accountName}</p>
                                </div>

                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-4 rounded-lg">
                                    <p className="text-sm text-red-800 dark:text-red-300 font-bold mb-1">🚨 IMPORTANT:</p>
                                    <p className="text-sm text-red-700 dark:text-red-200/80">
                                        Use your Ticket ID <strong className="bg-white dark:bg-black/30 px-1 rounded">{ticket.ticketId || ticket.ticket_id}</strong> as the <span className="underline">Transfer Narration/Remark</span>.
                                    </p>
                                </div>
                            </div>

                            {/* Upload Section */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold border-b border-gray-200 dark:border-white/10 pb-2 mb-4">📤 Upload Proof</h3>

                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            Upload Receipt / Screenshot
                                        </label>
                                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors bg-gray-50/50 dark:bg-black/10">
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                {...register("proof", { required: "Payment proof is required" })}
                                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 dark:file:bg-yellow-900/30 dark:file:text-yellow-400"
                                            />
                                            <p className="text-xs text-gray-400 mt-2">Supports: JPG, PNG, PDF (Max 5MB)</p>
                                        </div>
                                        {errors.proof && <p className="text-red-500 text-sm mt-1">{String(errors.proof.message)}</p>}
                                    </div>

                                    {uploadProgress > 0 && uploadProgress < 100 && (
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-4">
                                            <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                    )}

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={isSubmitting}
                                        className="w-full btn-primary py-4 rounded-xl shadow-lg font-bold text-lg disabled:opacity-50 disabled:grayscale"
                                    >
                                        {isSubmitting ? "Uploading..." : "Submit Proof of Payment"}
                                    </motion.button>
                                </form>

                                <div className="text-center pt-4">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Having trouble? <Link to="/contact" className="text-yellow-600 hover:underline">Contact Support</Link>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
            <Footer />
        </div>
    );
};

export default PaymentPage;
