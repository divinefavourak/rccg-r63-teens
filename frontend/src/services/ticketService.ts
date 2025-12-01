// src/services/ticketService.ts
import { Ticket } from "../types";
import { MOCK_TICKETS } from "../data/mockTickets";

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class TicketService {
  private tickets: Ticket[] = [...MOCK_TICKETS];

  async getAllTickets(): Promise<Ticket[]> {
    await delay(800); // Simulate API latency
    return [...this.tickets];
  }

  async getTicketById(ticketId: string): Promise<Ticket | undefined> {
    await delay(500);
    return this.tickets.find(t => t.ticketId === ticketId);
  }

  // Updated to allow any data input including payment refs
  async createTicket(data: any): Promise<Ticket> {
    await delay(1500);
    
    const newTicket: Ticket = {
      ...data,
      id: Date.now(), // Simple mock ID
      status: data.status || "pending", // Accept status if passed (e.g. 'approved' after payment)
      registeredAt: new Date().toISOString()
    };
    
    this.tickets.unshift(newTicket);
    return newTicket;
  }

  async updateTicketStatus(id: number, status: 'approved' | 'rejected' | 'pending'): Promise<Ticket> {
    await delay(600);
    
    const index = this.tickets.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Ticket not found");
    
    this.tickets[index] = { ...this.tickets[index], status };
    return this.tickets[index];
  }
}

export const ticketService = new TicketService();