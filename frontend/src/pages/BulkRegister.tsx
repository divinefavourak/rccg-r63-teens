import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { FaPlus, FaMinus, FaCalculator, FaUsers, FaArrowRight } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import { ticketService } from "../services/ticketService";

type CategoryCount = {
  teens: number;
  pre_teens: number;
  teachers: number;
};

const CATEGORIES = [
  { id: 'teens', label: 'Teens (13-19yrs)', defaultPrice: 3000 },
  { id: 'pre_teens', label: 'Pre-Teens (10-12yrs)', defaultPrice: 3000 },
  { id: 'teachers', label: 'Coordinators / Teachers', defaultPrice: 3000 }
];

const BulkRegister = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counts, setCounts] = useState<CategoryCount>({ teens: 0, pre_teens: 0, teachers: 0 });

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      coordinatorName: user?.name || "",
      coordinatorPhone: user?.phone || "",
      parish: user?.parish || "",

      // Default bulk info to coordinator's known details where possible
      email: user?.email || "",
    }
  });

  const totalAttendees = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalAmount = totalAttendees * 3000;

  const updateCount = (category: keyof CategoryCount, delta: number) => {
    setCounts(prev => ({
      ...prev,
      [category]: Math.max(0, prev[category] + delta)
    }));
  };

  const onFormSubmit = async (data: any) => {
    if (totalAttendees === 0) return toast.error("Please add at least one attendee.");
    setIsSubmitting(true);

    try {
      // Create Generic Tickets
      const ticketsToCreate = [];

      // Helper to push tickets
      const pushTickets = (count: number, category: string, prefix: string, age: number) => {
        for (let i = 1; i <= count; i++) {
          ticketsToCreate.push({
            fullName: data.parish + " " + prefix + " Guest " + i, // e.g. "Glory Parish Teen Guest 1"
            age: age,
            gender: 'not_specified',
            category: category,
            phone: data.coordinatorPhone, // Use coordinator contact
            email: data.email,            // Use coordinator email
            parish: data.parish,
            department: "Bulk Registration",

            // Coordinator info as Parent/Emergency for safety/contact tracing
            parentName: data.coordinatorName,
            parentPhone: data.coordinatorPhone,
            parentEmail: data.email,
            parentRelationship: "Coordinator",
            emergencyContact: data.coordinatorName,
            emergencyPhone: data.coordinatorPhone,
            emergencyRelationship: "Coordinator",

            // Standard fields
            medicalConditions: "None",
            medications: "None",
            dietaryRestrictions: "None",
            province: user?.province || "lagos_province_9",
            zone: "Coordinator Upload",
            area: "Coordinator Upload",
            parentConsent: true,
            medicalConsent: true,
            photoConsent: true,
            registeredBy: user?.name || "Coordinator",
            registrationType: 'coordinator',
            status: 'pending'
          });
        }
      };

      if (counts.teens > 0) pushTickets(counts.teens, 'teens', 'Teen', 15);
      if (counts.pre_teens > 0) pushTickets(counts.pre_teens, 'pre_teens', 'Pre-Teen', 11);
      if (counts.teachers > 0) pushTickets(counts.teachers, 'teachers', 'Coordinator', 30);

      // Batch creation logic (could be optimized with a bulk_create endpoint later)
      const createdTickets = [];

      // We'll create the first one to establish the batch ID context if we were doing that,
      // but here we just loop. For 100+ this might be slow client-side.
      // Ideally backend supports bulk. But for now we stick to current service logic.
      // We will show a loading toast.
      const loadingToast = toast.loading("Generating " + totalAttendees + " tickets...");

      for (const ticketData of ticketsToCreate) {
        const ticket = await ticketService.createTicket(ticketData, user?.token);
        createdTickets.push(ticket);
      }

      toast.dismiss(loadingToast);

      if (createdTickets.length > 0) {
        toast.success("Generated " + createdTickets.length + " generic tickets!");
        navigate("/payment", { state: { tickets: createdTickets, isBulk: true } });
      } else {
        throw new Error("Ticket generation failed.");
      }

    } catch (error: any) {
      console.error(error);
      toast.error("Failed to generate tickets. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-4xl mx-auto">

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-5xl font-black uppercase text-red-900 dark:text-white mb-2">
              <span className="text-gold-3d">Bulk</span> Registration
            </h1>
            <p className="text-gray-600 dark:text-white/60 text-lg">
              Quickly register your group by category.
            </p>
          </div>

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8">

            {/* 1. Coordinator Details Section */}
            <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
              <h3 className="text-xl font-bold border-b border-gray-100 dark:border-white/10 pb-4 mb-6 flex items-center gap-2">
                <FaUsers className="text-yellow-600" /> Coordinator Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-white/40 mb-2">Coordinator Name</label>
                  <input
                    {...register("coordinatorName", { required: "Name is required" })}
                    className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl"
                    placeholder="Enter full name"
                  />
                  {errors.coordinatorName && <p className="text-red-500 text-xs mt-1">{errors.coordinatorName.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-white/40 mb-2">Phone Number</label>
                  <input
                    {...register("coordinatorPhone", { required: "Phone is required" })}
                    className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl"
                    placeholder="e.g. 08012345678"
                  />
                  {errors.coordinatorPhone && <p className="text-red-500 text-xs mt-1">{errors.coordinatorPhone.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-white/40 mb-2">Parish</label>
                  <input
                    {...register("parish", { required: "Parish is required" })}
                    className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl"
                    placeholder="e.g. Glory Parish"
                  />
                  {errors.parish && <p className="text-red-500 text-xs mt-1">{errors.parish.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-white/40 mb-2">Email (For Ticket Delivery)</label>
                  <input
                    {...register("email", { required: "Email is required" })}
                    type="email"
                    className="w-full p-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl"
                    placeholder="coordinator@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
                </div>
              </div>
            </div>

            {/* 2. Category Counters Section */}
            <div className="bg-red-900 text-white rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
              {/* Decorative background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

              <h3 className="text-xl font-bold border-b border-white/20 pb-4 mb-6 flex items-center gap-2 relative z-10">
                <FaCalculator className="text-yellow-400" /> Delegate Categories
              </h3>

              <div className="space-y-6 relative z-10">
                {CATEGORIES.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                    <div>
                      <p className="font-bold text-lg">{cat.label}</p>
                      <p className="text-white/50 text-sm">₦3,000 per head</p>
                    </div>

                    <div className="flex items-center gap-4 bg-black/40 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => updateCount(cat.id as keyof CategoryCount, -1)}
                        className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                      >
                        <FaMinus size={12} />
                      </button>
                      <span className="text-2xl font-bold w-12 text-center tabular-nums">
                        {counts[cat.id as keyof CategoryCount]}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCount(cat.id as keyof CategoryCount, 1)}
                        className="w-10 h-10 flex items-center justify-center bg-yellow-600 hover:bg-yellow-500 text-white rounded-md transition-colors shadow-lg"
                      >
                        <FaPlus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Section */}
              <div className="mt-8 pt-6 border-t border-white/20 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                  <p className="text-white/60 text-sm uppercase font-bold">Total Payable Amount</p>
                  <p className="text-4xl font-black text-yellow-400">₦{totalAmount.toLocaleString()}</p>
                  <p className="text-white/40 text-xs mt-1">{totalAttendees} Delegates</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || totalAttendees === 0}
                  className="bg-white text-red-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Generating Tickets..." : <>Proceed to Payment <FaArrowRight /></>}
                </button>
              </div>
            </div>

          </form>

        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BulkRegister;