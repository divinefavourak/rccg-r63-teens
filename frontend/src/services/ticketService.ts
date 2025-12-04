import { api } from "./api";
import { Ticket } from "../types";

// Helper to map frontend camelCase to backend snake_case
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
  // Add any other fields if necessary
});

class TicketService {
  /**
   * Fetch all tickets (Admin/Coordinator view)
   */
  async getAllTickets(): Promise<Ticket[]> {
    const response = await api.get('/tickets/');
    return response.data.results || response.data; 
  }

  /**
   * Get a single ticket by ID
   */
  async getTicketById(ticketId: string): Promise<Ticket | undefined> {
    const response = await api.get(`/tickets/?search=${ticketId}`);
    const results = response.data.results || response.data;
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Create a ticket.
   * Maps frontend data to backend format before sending.
   */
  async createTicket(data: any): Promise<Ticket> {
    const payload = mapToBackend(data);
    const response = await api.post('/tickets/', payload);
    return response.data;
  }

  /**
   * Update ticket status (Admin only)
   */
  async updateTicketStatus(id: string | number, status: 'approved' | 'rejected' | 'pending'): Promise<Ticket> {
    const response = await api.post(`/tickets/${id}/update-status/`, { status });
    return response.data;
  }
}

export const ticketService = new TicketService();