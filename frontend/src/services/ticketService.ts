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
  registrationType: data.registered_by ? 'coordinator' : 'individual'
});

class TicketService {
  /**
   * Fetch all tickets (Admin/Coordinator view)
   */
  async getAllTickets(): Promise<Ticket[]> {
    const response = await api.get('/tickets/');
    const results = response.data.results || response.data;
    // Map every ticket in the list to the correct format
    return results.map(mapFromBackend); 
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
    
    const config = token ? {
      headers: { Authorization: `Bearer ${token}` }
    } : {};

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
}

export const ticketService = new TicketService();