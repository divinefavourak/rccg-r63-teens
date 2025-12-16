export interface Ticket {
  id: string; // ✅ Changed from number to string (Backend uses UUIDs)
  ticketId: string;
  fullName: string;
  age: string | number; // ✅ Allow string to handle form inputs before conversion
  category: string;
  gender: string;
  phone: string;
  email: string;
  province: string;
  zone: string;
  area: string;
  parish: string;
  department?: string;

  // Medical & Emergency
  medicalConditions?: string;
  medications?: string;
  dietaryRestrictions?: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelationship: string;

  // Parent
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelationship: string;

  status: 'pending' | 'approved' | 'rejected';
  registeredAt: string;
  registeredBy?: string;
  registrationType?: 'individual' | 'coordinator';
  paymentRef?: string;
  proof_of_payment?: string;
  payment_status?: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'coordinator';
  province?: string;
  name?: string; // Optional because backend sometimes sends 'first_name'/'last_name' instead
  email?: string;
  token?: string; // ✅ Added to fix the "Property token does not exist" error
}

export interface OperationResult {
  action: string;
  total: number;
  successful: number;
  failed: number;
  error?: string;
  details: any[];
}