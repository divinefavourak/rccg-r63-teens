import { z } from "zod";

export const ticketSchema = z.object({
  // Step 1: Personal Information
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  
  // 'valueAsNumber' returns NaN for empty inputs. 
  age: z.number()
        .min(1, "Age is required")
        .max(25, "Age must be 25 or below"),

  category: z.string().min(1, "Please select a category"),
  gender: z.string().min(1, "Please select a gender"),
  phone: z.string().min(10, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email address"),

  // Step 2: Church Information
  province: z.string().min(1, "Province is required"),
  zone: z.string().min(1, "Zone is required"),
  area: z.string().min(1, "Area is required"),
  parish: z.string().min(1, "Parish is required"),
  department: z.string().optional(),

  // Step 3: Medical Information
  medicalConditions: z.string().optional(),
  medications: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  emergencyContact: z.string().min(3, "Emergency contact name is required"),
  emergencyPhone: z.string().min(10, "Emergency phone number is required"),
  emergencyRelationship: z.string().min(1, "Relationship is required"),

  // Step 4: Parent Information
  parentName: z.string().min(3, "Parent name is required"),
  parentEmail: z.string().email("Valid parent email is required"),
  parentPhone: z.string().min(10, "Parent phone is required"),
  parentRelationship: z.string().min(1, "Relationship is required"),
  
  // Consents
  parentConsent: z.boolean().refine(val => val === true, {
    message: "Parent consent is required to proceed"
  }),
  medicalConsent: z.boolean().refine(val => val === true, {
    message: "Medical consent is required"
  }),
  photoConsent: z.boolean().optional(),
});

export type TicketFormData = z.infer<typeof ticketSchema>;