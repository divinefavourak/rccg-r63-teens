import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { FaTrash, FaPlus, FaCreditCard, FaCalculator } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import { ticketService } from "../services/ticketService";
import { usePaystackPayment } from 'react-paystack'; 
import CoordinatorDashboard from "./CoordinatorDashboard";

const BulkRegister = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      candidates: [
        { 
          fullName: "", age: "", gender: "male", category: "teens", 
          phone: "", email: "", parish: "", 
          parentName: "", parentPhone: "", parentEmail: "",
          emergencyContact: "", emergencyPhone: "",
          medicalConditions: "None"
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "candidates"
  });

  const candidates = watch("candidates");
  const totalAmount = candidates.length * 3000; // ₦3,000 per person

  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.username || "coordinator@faithtribe.org",
    amount: totalAmount * 100, // in kobo
    publicKey: 'pk_test_241ed76659d67e941a1008604b95645d80db23a8', // REPLACE WITH REAL KEY
    metadata: {
      custom_fields: [
        { display_name: "Coordinator", variable_name: "coordinator", value: user?.province },
        { display_name: "Quantity", variable_name: "quantity", value: candidates.length }
      ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = (reference: any) => {
    processBulkRegistration(reference);
  };

  const onClose = () => {
    toast.error("Payment cancelled. Candidates were not registered.");
    setIsSubmitting(false);
  };

  const processBulkRegistration = async (paymentRef: any) => {
    try {
      const promises = candidates.map(async (candidate: any) => {
        return ticketService.createTicket({
          ...candidate,
          age: parseInt(candidate.age),
          province: user?.province || "Unknown",
          zone: "Coordinator Upload", 
          area: "Coordinator Upload",
          emergencyRelationship: "Parent",
          parentRelationship: "Parent",
          parentConsent: true,
          medicalConsent: true,
          registeredBy: user?.name || "Coordinator",
          registrationType: 'coordinator',
          paymentRef: paymentRef.reference,
          status: 'approved'
        });
      });

      await Promise.all(promises);
      toast.success(`Successfully registered ${candidates.length} candidates!`);
      navigate('/coordinator/dashboard');
    } catch (error) {
      console.error(error);
      toast.error("Error submitting registrations. Please contact support.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFormSubmit = (data: any) => {
    if (candidates.length === 0) return toast.error("Add at least one candidate");
    setIsSubmitting(true);
    initializePayment({ onSuccess, onClose });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-200 dark:border-white/10 pb-6">
            <div>
              <h1 className="text-3xl font-black uppercase">Bulk Registration</h1>
              <p className="text-gray-500 dark:text-white/60">Province: <span className="text-yellow-600 font-bold">{user?.province}</span></p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 font-bold flex items-center gap-2 transition-colors"
            >
              Cancel Registration
            </button>
            <div className="bg-yellow-100 dark:bg-yellow-900/30 px-6 py-3 rounded-xl border border-yellow-500/30 mt-4 md:mt-0">
              <p className="text-xs font-bold uppercase  text-yellow-700 dark:text-yellow-400">Total To Pay (₦3,000/head)</p>
              <p className="text-2xl font-black flex items-center gap-2">
                <FaCalculator className="text-lg" /> ₦{totalAmount.toLocaleString()}
                
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onFormSubmit)}>
            <div className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="card p-6 relative group border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                  <div className="absolute top-4 right-4">
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 p-2 transition-colors">
                        <FaTrash />
                      </button>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-yellow-600 dark:text-yellow-400 mb-6 text-sm border-b border-gray-100 dark:border-white/10 pb-2">CANDIDATE #{index + 1}</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Full Name *</label>
                      <input 
                        {...register(`candidates.${index}.fullName`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none"
                        placeholder="Surname Firstname"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Age *</label>
                      <input type="number" {...register(`candidates.${index}.age`, { required: true })} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Gender *</label>
                      <select {...register(`candidates.${index}.gender`)} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none">
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Category *</label>
                      <select {...register(`candidates.${index}.category`)} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none">
                        <option value="toddler">Toddler (1-5)</option>
                        <option value="children_6_8">Children (6-8)</option>
                        <option value="pre_teens">Pre-Teens (9-12)</option>
                        <option value="teens">Teens (13-19)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Phone</label>
                      <input 
                        {...register(`candidates.${index}.phone`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Email</label>
                      <input 
                        type="email"
                        {...register(`candidates.${index}.email`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <div className="col-span-1 md:col-span-3">
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parish *</label>
                      <input 
                        {...register(`candidates.${index}.parish`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parent Name *</label>
                      <input {...register(`candidates.${index}.parentName`, { required: true })} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parent Phone *</label>
                      <input {...register(`candidates.${index}.parentPhone`, { required: true })} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parent Email *</label>
                      <input type="email" {...register(`candidates.${index}.parentEmail`, { required: true })} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Emergency Contact *</label>
                      <input {...register(`candidates.${index}.emergencyContact`, { required: true })} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Emergency Phone *</label>
                      <input {...register(`candidates.${index}.emergencyPhone`, { required: true })} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none" />
                    </div>
                     <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Medical Conditions</label>
                      <input {...register(`candidates.${index}.medicalConditions`)} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded outline-none" placeholder="Optional" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-[#1a0505] border-t border-gray-200 dark:border-white/10 p-4 z-40 shadow-2xl">
              <div className="max-w-7xl mx-auto flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => append({ fullName: "", age: "", gender: "male", category: "teens", phone: "", email: "", parish: "", parentName: "", parentPhone: "", parentEmail: "", emergencyContact: "", emergencyPhone: "", medicalConditions: "None" })}
                  className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-100 font-bold flex items-center gap-2"
                >
                  <FaPlus /> Add Candidate
                </button>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-gray-500">Candidates: {candidates.length}</p>
                    <p className="font-bold text-lg">Total: ₦{totalAmount.toLocaleString()}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary px-8 py-3 rounded-xl shadow-xl flex items-center gap-2"
                  >
                    {isSubmitting ? "Processing..." : <><FaCreditCard /> Pay & Register All</>}
                  </button>
                </div>
              </div>
            </div>
            <div className="h-24"></div> 
          </form>
        </div>
      </div>
    </div>
  );
};

export default BulkRegister;