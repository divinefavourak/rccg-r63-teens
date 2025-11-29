import { useState } from "react";
import { useAuth } from "../hooks/useAuth"; // Updated to direct import
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { FaTrash, FaPlus, FaSave } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import { ticketService } from "../services/ticketService";

const BulkRegister = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      candidates: [
        { 
          fullName: "", 
          age: "", 
          gender: "male", 
          category: "teens", 
          phone: "", 
          email: "", 
          parish: "",
          parentName: "", 
          parentPhone: "", 
          parentEmail: "",
          emergencyContact: "",
          emergencyPhone: "",
          emergencyRelationship: "Parent",
          medicalConditions: "None",
          medications: "None",
          dietaryRestrictions: "None"
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "candidates"
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // Process each candidate
      const promises = data.candidates.map(async (candidate: any) => {
        return ticketService.createTicket({
          ...candidate,
          age: parseInt(candidate.age),
          province: user?.province || "Unknown",
          zone: "Coordinator Upload", 
          area: "Coordinator Upload",
          // Ensure fallback if fields empty to satisfy types, though required validation handles emptiness
          emergencyRelationship: candidate.emergencyRelationship || "Parent",
          parentRelationship: "Parent",
          parentConsent: true, // Implied by coordinator
          medicalConsent: true,
          registeredBy: user?.username
        });
      });

      await Promise.all(promises);
      toast.success(`Successfully registered ${data.candidates.length} candidates!`);
      navigate('/coordinator/dashboard');
    } catch (error) {
      console.error(error);
      toast.error("Error submitting registrations");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black">BULK REGISTRATION</h1>
              <p className="text-gray-500 dark:text-white/60">Add multiple candidates for {user?.province}</p>
            </div>
            <button onClick={() => navigate('/coordinator/dashboard')} className="text-sm underline opacity-70 hover:opacity-100">Cancel & Return</button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
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
                    {/* Personal Info */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Full Name *</label>
                      <input 
                        {...register(`candidates.${index}.fullName`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                        placeholder="Surname Firstname"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Age *</label>
                      <input 
                        type="number"
                        {...register(`candidates.${index}.age`, { required: true, min: 1, max: 25 })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Gender *</label>
                      <select {...register(`candidates.${index}.gender`)} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none">
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Category *</label>
                      <select {...register(`candidates.${index}.category`)} className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none">
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
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                        placeholder="Candidate Phone"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Email</label>
                      <input 
                        type="email"
                        {...register(`candidates.${index}.email`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                        placeholder="candidate@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-100 dark:border-white/5">
                     {/* Church Info */}
                    <div className="col-span-1 md:col-span-3">
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parish *</label>
                      <input 
                        {...register(`candidates.${index}.parish`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                        placeholder="Local Parish Name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    {/* Parent Info */}
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parent Name *</label>
                      <input 
                        {...register(`candidates.${index}.parentName`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parent Phone *</label>
                      <input 
                        {...register(`candidates.${index}.parentPhone`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Parent Email *</label>
                      <input 
                        type="email"
                        {...register(`candidates.${index}.parentEmail`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    {/* Emergency & Medical (Simplified) */}
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Emergency Contact *</label>
                      <input 
                        {...register(`candidates.${index}.emergencyContact`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Emergency Phone *</label>
                      <input 
                        {...register(`candidates.${index}.emergencyPhone`, { required: true })}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                      />
                    </div>
                     <div>
                      <label className="text-xs uppercase font-bold opacity-60 mb-1 block">Medical Conditions</label>
                      <input 
                        {...register(`candidates.${index}.medicalConditions`)}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded focus:ring-2 focus:ring-yellow-500 outline-none"
                        placeholder="If any (Optional)"
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-8 pb-20">
              <button
                type="button"
                onClick={() => append({ 
                  fullName: "", age: "", gender: "male", category: "teens", phone: "", email: "", 
                  parish: "", parentName: "", parentPhone: "", parentEmail: "", 
                  emergencyContact: "", emergencyPhone: "", emergencyRelationship: "Parent",
                  medicalConditions: "None", medications: "None", dietaryRestrictions: "None"
                })}
                className="btn-secondary px-6 py-3 flex items-center gap-2 text-sm"
              >
                <FaPlus /> Add Another Candidate
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-8 py-3 rounded-xl shadow-xl flex items-center gap-2"
              >
                {isSubmitting ? "Uploading..." : <><FaSave /> Submit All Registrations</>}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BulkRegister;