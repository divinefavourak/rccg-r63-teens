export interface Ticket {
    id: number;
    ticketId: string;
    fullName: string;
    age: string;
    category: string;
    gender: string;
    phone: string;
    email: string;
    province: string;
    zone: string;
    area: string;
    parish: string;
    department: string;
    medicalConditions: string;
    medications: string;
    dietaryRestrictions: string;
    emergencyContact: string;
    emergencyPhone: string;
    emergencyRelationship: string;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
    parentRelationship: string;
    status: string;
    registeredAt: string;
  }
  
  export interface OperationResult {
    action: string;
    total: number;
    successful: number;
    failed: number;
    error?: string;
    details: any[];
  }