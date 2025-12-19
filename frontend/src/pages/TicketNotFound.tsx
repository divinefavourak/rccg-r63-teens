import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FaCheckCircle,
    FaExclamationTriangle,
    FaClock,
    FaTimesCircle,
    FaTicketAlt,
    FaUpload
} from 'react-icons/fa';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ticketService } from '../services/ticketService';

type TicketStatus = 'not_found' | 'pending' | 'approved' | 'rejected' | 'payment_pending';

const CheckTicketStatus = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ticketId = searchParams.get('ticket_id') || '';

    const [loading, setLoading] = useState(true);
    const [ticketStatus, setTicketStatus] = useState<TicketStatus>('not_found');
    const [ticketData, setTicketData] = useState<any>(null);

    useEffect(() => {
        const checkTicket = async () => {
            if (!ticketId) {
                setLoading(false);
                return;
            }

            try {
                const ticket = await ticketService.verifyTicket(ticketId);

                if (!ticket) {
                    setTicketStatus('not_found');
                } else {
                    setTicketData(ticket);

                    // Determine status based on ticket data
                    if (ticket.status === 'approved') {
                        setTicketStatus('approved');
                    } else if (ticket.status === 'rejected') {
                        setTicketStatus('rejected');
                    } else if (ticket.payment_status === 'unpaid' || ticket.payment_status === 'verification_pending') {
                        setTicketStatus('payment_pending');
                    } else {
                        setTicketStatus('pending');
                    }
                }
            } catch (error) {
                console.error('Error checking ticket:', error);
                setTicketStatus('not_found');
            } finally {
                setLoading(false);
            }
        };

        checkTicket();
    }, [ticketId]);

    // Auto-redirect to preview if ticket is approved
    useEffect(() => {
        if (ticketStatus === 'approved' && ticketData) {
            // Redirect to full ticket preview for approved tickets
            setTimeout(() => {
                navigate(`/ticket-preview?ticket_id=${ticketId}`);
            }, 1500); // Give user time to see the approved status
        }
    }, [ticketStatus, ticketData, ticketId, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#2b0303]">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-yellow-500"></div>
            </div>
        );
    }

    // Different status configurations
    const statusConfig = {
        not_found: {
            icon: FaExclamationTriangle,
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            title: 'TICKET NOT FOUND',
            titleColor: 'text-red-600 dark:text-red-400',
            message: `We couldn't find a ticket with ID: ${ticketId}`,
            description: 'This ticket may not exist or the ID might be incorrect.',
        },
        pending: {
            icon: FaClock,
            iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            title: 'PENDING VERIFICATION',
            titleColor: 'text-yellow-600 dark:text-yellow-400',
            message: 'Your ticket is awaiting admin approval',
            description: 'Your registration has been received and is currently being processed. You will be notified once approved.',
        },
        payment_pending: {
            icon: FaClock,
            iconBg: 'bg-orange-100 dark:bg-orange-900/30',
            iconColor: 'text-orange-600 dark:text-orange-400',
            title: 'PAYMENT VERIFICATION PENDING',
            titleColor: 'text-orange-600 dark:text-orange-400',
            message: 'Your payment is being verified',
            description: 'We have received your payment proof and our team is verifying it. This usually takes 24-48 hours.',
        },
        approved: {
            icon: FaCheckCircle,
            iconBg: 'bg-green-100 dark:bg-green-900/30',
            iconColor: 'text-green-600 dark:text-green-400',
            title: 'TICKET APPROVED',
            titleColor: 'text-green-600 dark:text-green-400',
            message: 'Your ticket has been approved!',
            description: 'You are all set for the event. Present this ticket at the registration desk.',
        },
        rejected: {
            icon: FaTimesCircle,
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            title: 'TICKET REJECTED',
            titleColor: 'text-red-600 dark:text-red-400',
            message: 'Your ticket application was not approved',
            description: 'Please contact the event organizers for more information.',
        },
    };

    const config = statusConfig[ticketStatus];
    const IconComponent = config.icon;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] transition-colors duration-500">
            <Navbar />

            <div className="pt-28 pb-16 px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                >
                    {/* Status Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="inline-block"
                        >
                            <div className={`w-24 h-24 ${config.iconBg} rounded-full flex items-center justify-center mb-4 mx-auto`}>
                                <IconComponent className={`text-5xl ${config.iconColor}`} />
                            </div>
                        </motion.div>
                        <h1 className={`text-3xl md:text-4xl font-black dark:text-white mb-2 font-['Impact'] tracking-wide`}>
                            <span className={config.titleColor}>{config.title}</span>
                        </h1>
                        <p className="text-gray-600 dark:text-red-200/70 text-lg mb-2">
                            {config.message}
                        </p>
                        <p className="text-gray-500 dark:text-red-200/50 text-sm">
                            {config.description}
                        </p>
                    </div>

                    {/* Ticket Details Card (if ticket exists) */}
                    {ticketData && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white dark:bg-[#1a0505] rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200 dark:border-yellow-600/20"
                        >
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Ticket Details</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Ticket ID</p>
                                    <p className="font-mono font-bold text-gray-800 dark:text-white">{ticketData.ticketId}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Name</p>
                                    <p className="font-bold text-gray-800 dark:text-white">{ticketData.fullName}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Status</p>
                                    <p className={`font-bold capitalize ${ticketData.status === 'approved' ? 'text-green-600' :
                                        ticketData.status === 'rejected' ? 'text-red-600' :
                                            'text-yellow-600'
                                        }`}>
                                        {ticketData.status}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Payment Status</p>
                                    <p className={`font-bold capitalize ${ticketData.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'
                                        }`}>
                                        {ticketData.payment_status || 'Unpaid'}
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons based on status */}
                            <div className="mt-6 space-y-3">
                                {ticketStatus === 'approved' && (
                                    <button
                                        onClick={() => navigate(`/ticket-preview?ticket_id=${ticketId}`)}
                                        className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all"
                                    >
                                        View Full Ticket
                                    </button>
                                )}

                                {(ticketStatus === 'pending' || ticketStatus === 'payment_pending') && ticketData.payment_status === 'unpaid' && (
                                    <button
                                        onClick={() => navigate('/upload-payment')}
                                        className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                                    >
                                        <FaUpload /> Upload Payment Proof
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Actions for Not Found */}
                    {ticketStatus === 'not_found' && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-4"
                        >
                            <div className="bg-white dark:bg-[#1a0505] rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-yellow-600/20 hover:border-yellow-500 transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                                        <FaTicketAlt className="text-2xl text-yellow-600 dark:text-yellow-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                                            Register for a ticket
                                        </h3>
                                        <p className="text-gray-600 dark:text-red-200/70 text-sm mb-4">
                                            Don't have a ticket yet? Register now for the event!
                                        </p>
                                        <button
                                            onClick={() => navigate('/get-ticket')}
                                            className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all"
                                        >
                                            Register Now
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#1a0505] rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-yellow-600/20">
                                <div className="bg-gray-50 dark:bg-[#2b0303] rounded-lg p-4">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 font-mono mb-2">
                                        Ticket ID Format: <span className="text-yellow-600 dark:text-yellow-400 font-bold">TKT-YYYYMM-XXXXX</span>
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Example: TKT-202512-00001
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Back to Home */}
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

export default CheckTicketStatus;
