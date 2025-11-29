// src/store/ticketStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TicketFormData } from '../schemas/ticketSchema';

interface TicketState {
  formData: Partial<TicketFormData>;
  currentStep: number;
  setFormData: (data: Partial<TicketFormData>) => void;
  setCurrentStep: (step: number) => void;
  resetForm: () => void;
}

export const useTicketStore = create<TicketState>()(
  persist(
    (set) => ({
      formData: {},
      currentStep: 1,
      setFormData: (data) => 
        set((state) => ({ 
          formData: { ...state.formData, ...data } 
        })),
      setCurrentStep: (step) => set({ currentStep: step }),
      resetForm: () => set({ formData: {}, currentStep: 1 }),
    }),
    {
      name: 'rccg-ticket-storage', // name of the item in localStorage
    }
  )
);