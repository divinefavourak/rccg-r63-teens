import { api } from "./api";

interface InitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
  payment: any;
}

class PaymentService {
  /**
   * Initialize payment via Backend.
   * The backend talks to Paystack and returns the authorization URL.
   * @param ticketId - The ID (UUID) of the created ticket
   */
  async initializePayment(ticketId: string | number): Promise<InitializeResponse> {
    const response = await api.post('/payments/payments/initialize/', {
      ticket_id: ticketId
    });
    return response.data;
  }

  /**
   * Verify payment status (Optional: usually handled via callback page)
   */
  async verifyPayment(reference: string) {
    const response = await api.post('/payments/payments/verify/', { reference });
    return response.data;
  }
}

export const paymentService = new PaymentService();