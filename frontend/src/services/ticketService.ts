import { api } from "./api";
import { Ticket } from "../types";

// 1. Helper to map Frontend (camelCase) -> Backend (snake_case)
// Used when creating a ticket
const mapToBackend = (data: any) => ({
  full_name: data.fullName,
  age: data.age,
  category: data.category,
  gender: data.gender,
  phone: data.phone,
  email: data.email,
  province: data.province,
  zone: data.zone,
  area: data.area,
  parish: data.parish,
  department: data.department,
  medical_conditions: data.medicalConditions,
  medications: data.medications,
  dietary_restrictions: data.dietaryRestrictions,
  emergency_contact: data.emergencyContact,
  emergency_phone: data.emergencyPhone,
  emergency_relationship: data.emergencyRelationship,
  parent_name: data.parentName,
  parent_email: data.parentEmail,
  parent_phone: data.parentPhone,
  parent_relationship: data.parentRelationship,
  parent_consent: data.parentConsent,
  medical_consent: data.medicalConsent,
  // For bulk registrations - skip individual email, send consolidated email later
  skip_email: data.skipEmail || false,
});

// 2. Helper to map Backend (snake_case) -> Frontend (camelCase)
// Used when receiving data (Fixes the Admin Page issue)
const mapFromBackend = (data: any): Ticket => ({
  id: data.id,
  ticketId: data.ticket_id, // Fixes missing ID
  fullName: data.full_name, // Fixes missing Name
  age: data.age,
  category: data.category,
  gender: data.gender,
  phone: data.phone,
  email: data.email,
  province: data.province,
  zone: data.zone,
  area: data.area,
  parish: data.parish,
  department: data.department,

  // Optional / Complex fields
  medicalConditions: data.medical_conditions,
  medications: data.medications,
  dietaryRestrictions: data.dietary_restrictions,
  emergencyContact: data.emergency_contact,
  emergencyPhone: data.emergency_phone,
  emergencyRelationship: data.emergency_relationship,
  parentName: data.parent_name,
  parentEmail: data.parent_email,
  parentPhone: data.parent_phone,
  parentRelationship: data.parent_relationship,

  status: data.status,
  registeredAt: data.registered_at,
  // Backend serializer sends 'registered_by_name', fallback to 'Self'
  registeredBy: data.registered_by_name || 'Self',
  // Check both registered_by (user ID) and registered_by_name to determine type
  // If registered_by is set, it means a logged-in user (coordinator/admin) created this ticket
  registrationType: (data.registered_by && data.registered_by_name) ? 'coordinator' : 'individual',

  // Payment Proof Logic
  proof_of_payment: data.proof_of_payment,
  payment_status: data.payment_status
});

class TicketService {
  /**
   * Fetch all tickets (Admin/Coordinator view)
   */
  async getAllTickets(
    page = 1,
    search = '',
    filters?: { status?: string, category?: string, province?: string, registered_by?: string }
  ): Promise<{ results: Ticket[], count: number }> {
    let query = `/tickets/?page=${page}&search=${search}`;

    if (filters) {
      if (filters.status && filters.status !== 'all') query += `&status=${filters.status}`;
      if (filters.category && filters.category !== 'all') query += `&category=${filters.category}`;
      if (filters.province && filters.province !== 'all') query += `&province=${encodeURIComponent(filters.province)}`;
      if (filters.registered_by && filters.registered_by !== 'all') query += `&registered_by=${encodeURIComponent(filters.registered_by)}`;
    }

    const response = await api.get(query);

    // Handle paginated response
    if (response.data.results) {
      return {
        results: response.data.results.map(mapFromBackend),
        count: response.data.count
      };
    }

    // Handle non-paginated response (fallback)
    const data = Array.isArray(response.data) ? response.data : [];
    return {
      results: data.map(mapFromBackend),
      count: data.length
    };
  }

  /**
   * Fetch dashboard statistics (total counts by province, status, category)
   * This returns aggregate stats for ALL tickets, not just the current page.
   */
  async getDashboardStats(): Promise<{
    total_tickets: number;
    pending_tickets: number;
    approved_tickets: number;
    rejected_tickets: number;
    pre_teens_count: number;
    teens_count: number;
    male_count: number;
    female_count: number;
    province_stats: Record<string, { total: number; pending: number; approved: number; rejected: number }>;
  }> {
    const response = await api.get('/dashboard/');
    return response.data;
  }

  /**
   * Bulk create multiple tickets in a single request (OPTIMIZED).
   * This is much faster than creating tickets one by one.
   */
  async bulkCreateTickets(
    ticketsData: any[],
    coordinatorName: string,
    coordinatorEmail: string,
    token?: string
  ): Promise<{
    success: boolean;
    created_count: number;
    failed_count: number;
    tickets: Ticket[];
    failed: { index: number; error?: string; errors?: any }[];
  }> {
    // Map all tickets to backend format
    const payload = {
      tickets: ticketsData.map(mapToBackend),
      coordinator_name: coordinatorName,
      coordinator_email: coordinatorEmail
    };

    const config = token ? {
      headers: { Authorization: `Bearer ${token}` }
    } : {
      headers: { Authorization: '' }
    };

    const response = await api.post('/tickets/bulk_create/', payload, config);

    return {
      ...response.data,
      tickets: response.data.tickets.map(mapFromBackend)
    };
  }

  /**
   * Get a single ticket by ID
   */
  async getTicketById(ticketId: string): Promise<Ticket | undefined> {
    const response = await api.get(`/tickets/?search=${ticketId}`);
    const results = response.data.results || response.data;
    return results.length > 0 ? mapFromBackend(results[0]) : undefined;
  }

  /**
   * Create a ticket.
   * Maps frontend data to backend format before sending.
   */
  async createTicket(data: any, token?: string): Promise<Ticket> {
    const payload = mapToBackend(data);

    // If token is provided (for bulk upload/admin), use it.
    // If NOT provided, explicitly set Authorization to empty string to override the global interceptor
    // This prevents 401 errors when a public user has an expired token in localStorage.
    const config = token ? {
      headers: { Authorization: `Bearer ${token}` }
    } : {
      headers: { Authorization: '' }
    };

    const response = await api.post('/tickets/', payload, config);
    return mapFromBackend(response.data);
  }



  /**
   * Update ticket status (Admin only)
   */
  async updateTicketStatus(id: string | number, status: 'approved' | 'rejected' | 'pending'): Promise<Ticket> {
    const response = await api.post(`/tickets/${id}/update-status/`, { status });
    return mapFromBackend(response.data);
  }

  /**
   * Verify ticket status (Public)
   */
  async verifyTicket(ticketId: string): Promise<Ticket | null> {
    try {
      console.log('Verifying ticket:', ticketId);
      const response = await api.get(`/tickets/verify/?ticket_id=${ticketId}`);
      console.log('Verify response:', response.data);

      if (response.data && response.data.ticket) {
        // The verify endpoint structure is slightly different ({ valid: true, ticket: {...} })
        // So we need to normalize it to our internal Ticket type
        const t = response.data.ticket;
        console.log('Raw ticket data:', t);

        const normalizedTicket = {
          id: t.id || t.ticket_id,
          ticketId: t.ticket_id,
          fullName: t.full_name,
          age: t.age?.toString(),
          category: t.category,
          gender: t.gender,
          phone: t.phone,
          email: t.email,
          province: t.province,
          zone: t.zone,
          area: t.area,
          parish: t.parish,
          department: t.department,
          medicalConditions: t.medical_conditions,
          medications: t.medications,
          dietaryRestrictions: t.dietary_restrictions,
          emergencyContact: t.emergency_contact,
          emergencyPhone: t.emergency_phone,
          emergencyRelationship: t.emergency_relationship,
          parentName: t.parent_name,
          parentEmail: t.parent_email,
          parentPhone: t.parent_phone,
          parentRelationship: t.parent_relationship,
          status: t.status || 'pending',
          registeredAt: t.registered_at,
          registeredBy: t.registered_by || 'Self',
          payment_status: t.payment_status || 'unpaid',
          proof_of_payment: t.proof_of_payment
        } as Ticket;

        console.log('Normalized ticket:', normalizedTicket);
        return normalizedTicket;
      }

      console.log('No ticket in response');
      return null;
    } catch (error) {
      console.error("Verification error:", error);
      return null;
    }
  }

  /**
   * Perform bulk action on tickets
   */
  async performBulkAction(ticketIds: string[], action: 'approve' | 'reject' | 'send_email' | 'delete' | 'welcome_email' | 'payment_reminder' | 'final_instructions', subject?: string, message?: string) {
    const payload = {
      ticket_ids: ticketIds,
      action,
      subject,
      message
    };
    const response = await api.post('/tickets/bulk_action/', payload);
    return response.data;
  }

  /**
   * Send a single consolidated confirmation email for bulk registrations.
   * Used by coordinators to receive one email with all their ticket IDs.
   */
  async sendBulkConfirmation(ticketIds: string[], coordinatorName: string, coordinatorEmail: string): Promise<{ success: boolean; message: string; ticket_count: number }> {
    const payload = {
      ticket_ids: ticketIds,
      coordinator_name: coordinatorName,
      coordinator_email: coordinatorEmail
    };
    const response = await api.post('/tickets/send_bulk_confirmation/', payload);
    return response.data;
  }
}


export const ticketService = new TicketService();