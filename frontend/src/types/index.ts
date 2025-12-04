export interface Ticket {
  id: number;
  ticketId: string;
  fullName: string;
  age: number;
  category: string;
  gender: string;
  phone: string;
  email: string;
  province: string;
  zone: string;
  area: string;
  parish: string;
  department?: string;
  medicalConditions?: string;
  medications?: string;
  dietaryRestrictions?: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelationship: string;
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
  registeredBy?: string; // e.g., "Self" or "Coordinator Name"
  registrationType: 'individual' | 'coordinator'; // New field for Admin tracking
  paymentRef?: string; // New field for payment confirmation
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'coordinator';
  province?: string; // Only for coordinators
  name: string;
}

export interface OperationResult {
  action: string;
  total: number;
  successful: number;
  failed: number;
  error?: string;
  details: any[];
}