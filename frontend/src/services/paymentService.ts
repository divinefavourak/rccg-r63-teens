import { api } from "./api";

interface InitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
  payment: any;
}

class PaymentService {
  /**
   * Initialize SINGLE payment via Backend.
   */
  async initializePayment(ticketId: string | number, token?: string): Promise<InitializeResponse> {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    const response = await api.post('/payments/payments/initialize/', {
      ticket_id: ticketId
    }, config);
    
    return response.data;
  }

  /**
   * Initialize BULK payment via Backend.
   */
  async initializeBulkPayment(ticketIds: string[], token?: string): Promise<InitializeResponse> {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    
    const response = await api.post('/payments/payments/initialize/', {
      ticket_ids: ticketIds 
    }, config);
    
    return response.data;
  }

  /**
   * Verify payment.
   */
  async verifyPayment(reference: string, token?: string) {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    const response = await api.post('/payments/payments/verify/', { reference }, config);
    return response.data;
  }
}

export const paymentService = new PaymentService();