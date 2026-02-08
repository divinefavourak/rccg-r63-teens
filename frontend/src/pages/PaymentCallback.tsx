import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { paymentService } from "../services/paymentService";
import toast from "react-hot-toast";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Verifying payment...");
  const { user } = useAuth();

  useEffect(() => {
    const verify = async () => {
      const reference = searchParams.get("reference");

      if (!reference) {
        setStatus("Invalid payment reference.");
        return;
      }

      try {
        let authToken = null;

        // Silent Login Logic
        if (user?.token) {
          authToken = user.token;
        } else {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          const publicUser = import.meta.env.VITE_PUBLIC_AGENT_USERNAME;
          const publicPass = import.meta.env.VITE_PUBLIC_AGENT_PASSWORD;

          if (publicUser && publicPass) {
            const authResponse = await axios.post(`${apiUrl}/auth/login/`, {
              username: publicUser,
              password: publicPass
            });
            authToken = authResponse.data.access;
          }
        }

        const response = await paymentService.verifyPayment(reference, authToken || undefined);
        const payment = response.payment;

        if (payment.status === "success") {
          setStatus("Payment Successful!");
          toast.success("Payment verified successfully!");

          // ✅ CHECK FOR BULK PAYMENT
          if (payment.metadata && payment.metadata.is_bulk) {
            setTimeout(() => {
              toast.success("Bulk registration completed!");
              navigate("/coordinator/dashboard"); // Redirect to Dashboard
            }, 1500);
          } else {
            // Single Ticket Redirect
            setTimeout(() => {
              navigate("/ticket-preview", {
                state: { ticket: payment.ticket_details }
              });
            }, 1500);
          }

        } else {
          setStatus("Payment failed or was not completed.");
          toast.error("Payment verification failed.");
        }
      } catch (error: any) {
        console.error(error);
        const errorMsg = error.response?.data?.error || "Error verifying payment.";
        setStatus(errorMsg);
        toast.error(errorMsg);
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 transition-colors duration-500">
      {status.includes("Successful") ? (
        <div className="text-center">
          <div className="text-6xl mb-4 text-green-500">🎉</div>
          <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">{status}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Finalizing registration...</p>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-bold text-primary-600 dark:text-primary-400">{status}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please do not close this window...</p>
        </>
      )}
    </div>
  );
};

export default PaymentCallback;