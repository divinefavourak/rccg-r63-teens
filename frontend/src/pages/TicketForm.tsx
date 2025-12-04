import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast"; 
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { 
  PERSONAL_INFO_FIELDS, 
  CHURCH_INFO_FIELDS, 
  MEDICAL_INFO_FIELDS, 
  PARENT_INFO_FIELDS 
} from "../constants/formFields";
import { ticketSchema, TicketFormData } from "../schemas/ticketSchema";
import { useTicketStore } from "../store/ticketStore";

const STEP_FIELDS = {
  1: ['fullName', 'age', 'category', 'gender', 'phone', 'email'],
  2: ['province', 'zone', 'area', 'parish', 'department'],
  3: ['medicalConditions', 'medications', 'dietaryRestrictions', 'emergencyContact', 'emergencyPhone', 'emergencyRelationship'],
  4: ['parentName', 'parentEmail', 'parentPhone', 'parentRelationship', 'parentConsent', 'medicalConsent', 'photoConsent']
} as const;

const TicketForm = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentStep = useTicketStore((state) => state.currentStep);
  const setCurrentStep = useTicketStore((state) => state.setCurrentStep);
  const setFormData = useTicketStore((state) => state.setFormData);
  const resetForm = useTicketStore((state) => state.resetForm);
  const savedData = useTicketStore.getState().formData;

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors }
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      age: undefined,
      category: "",
      gender: "",
      phone: "",
      email: "",
      province: "",
      zone: "",
      area: "",
      parish: "",
      department: "",
      medicalConditions: "",
      medications: "",
      dietaryRestrictions: "",
      emergencyContact: "",
      emergencyPhone: "",
      emergencyRelationship: "",
      parentName: "",
      parentEmail: "",
      parentPhone: "",
      parentRelationship: "",
      parentConsent: false,
      medicalConsent: false,
      photoConsent: false,
      ...savedData 
    } as any
  });

  const watchedValues = watch();
  useEffect(() => {
    setFormData(watchedValues);
  }, [watchedValues, setFormData]);

  // --- PAYSTACK CONFIGURATION ---
  const config = {
    reference: (new Date()).getTime().toString(),
    email: watchedValues.email || "user@example.com",
    amount: 3000 * 100, // ₦3,000 in kobo
    publicKey: 'pk_test_241ed76659d67e941a1008604b95645d80db23a8', // REPLACE WITH YOUR PUBLIC KEY
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = (reference: any) => {
    completeRegistration(reference);
  };

  const onClose = () => {
    setIsSubmitting(false);
    toast.error("Payment cancelled. Registration not complete.");
  };

  const completeRegistration = async (paymentReference: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const ticketData = {
        ...watchedValues,
        ticketId: `R63T${Date.now()}`,
        status: 'approved', // Auto-approve
        registeredAt: new Date().toISOString(),
        paymentRef: paymentReference.reference,
        registeredBy: 'Self',
        registrationType: 'individual', // Mark as individual
        province: watchedValues.province
      };

      resetForm();
      navigate('/ticket-preview', { state: { ticket: ticketData } });
      toast.success("Registration Successful! See you at camp.");
    } catch (error) {
      toast.error("Error saving ticket details.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    // /@ts-expect-error - Keys are valid
    const fields = STEP_FIELDS[currentStep as keyof typeof STEP_FIELDS];
    const isStepValid = await trigger(fields);
    
    if (isStepValid) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
    window.scrollTo(0, 0);
  };

  const onSubmit: SubmitHandler<TicketFormData> = (data) => {
    setIsSubmitting(true);
    initializePayment({ onSuccess, onClose });
  };

  const getErrorMessage = (fieldName: string) => {
    return errors[fieldName as keyof TicketFormData]?.message;
  };

  const renderFormField = (field: any) => {
    const hasError = !!errors[field.name as keyof TicketFormData];
    const inputClasses = `w-full px-4 py-3 bg-white dark:bg-[#1a0505]/50 border rounded-xl 
      focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all 
      text-gray-900 dark:text-white 
      placeholder-gray-400 dark:placeholder-white/30 
      ${hasError ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-red-900/50'}`;

    const registerOptions = field.name === 'age' ? { valueAsNumber: true } : {};

    switch (field.type) {
      case 'select':
        return (
          <select {...register(field.name as keyof TicketFormData, registerOptions)} className={inputClasses}>
            {field.options.map((option: any) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        );
      case 'textarea':
        return <textarea {...register(field.name as keyof TicketFormData, registerOptions)} placeholder={field.placeholder} rows={4} className={inputClasses} />;
      case 'checkbox':
        return (
          <label className="flex items-start space-x-3 cursor-pointer">
            <input type="checkbox" {...register(field.name as keyof TicketFormData, registerOptions)} className="mt-1 w-5 h-5 text-yellow-600 rounded focus:ring-yellow-500 border-gray-300 dark:border-red-900" />
            <span className={`text-sm ${hasError ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{field.label}</span>
          </label>
        );
      default:
        return <input type={field.type} {...register(field.name as keyof TicketFormData, registerOptions)} placeholder={field.placeholder} className={inputClasses} />;
    }
  };

  const renderStepContent = () => {
    let title = "";
    let fields: any[] = [];

    switch (currentStep) {
      case 1: title = "Participant Details"; fields = PERSONAL_INFO_FIELDS; break;
      case 2: title = "Church Information"; fields = CHURCH_INFO_FIELDS; break;
      case 3: title = "Medical & Emergency"; fields = MEDICAL_INFO_FIELDS; break;
      case 4: title = "Parent/Guardian Consent"; fields = PARENT_INFO_FIELDS; break;
    }

    return (
      <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 font-['Impact'] tracking-wide">{title}</h3>
        
        {currentStep === 4 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-6 mb-6">
            <h4 className="font-bold text-yellow-800 dark:text-yellow-400 mb-2 flex items-center gap-2"><span className="text-xl">⚠️</span> Payment Required:</h4>
            <p className="text-yellow-700 dark:text-yellow-200/80 text-sm">A fee of <strong>₦3,000</strong> is required. You will be redirected to a secure payment gateway.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => (
            <div key={field.name} className={field.type === 'textarea' || field.type === 'checkbox' ? 'md:col-span-2' : ''}>
              {field.type !== 'checkbox' && (
                <label className="block text-sm font-bold text-gray-700 dark:text-red-100/80 mb-2 uppercase tracking-wider">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
              )}
              {renderFormField(field)}
              {getErrorMessage(field.name) && <p className="text-red-500 text-xs mt-2 font-medium flex items-center animate-pulse">⚠️ {getErrorMessage(field.name)}</p>}
            </div>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      <div className="pt-28 pb-16 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-red-100/50 dark:from-red-900/20 to-transparent pointer-events-none transition-colors duration-500"></div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4 text-red-900 dark:text-white"><span className="text-gold-3d">GET YOUR</span> TICKET</h1>
            <p className="text-gray-600 dark:text-red-100/80 max-w-2xl mx-auto text-lg">Secure your spot for The Priceless Gift Camp 2025.</p>
          </div>

          <div className="mb-10">
            <div className="flex items-center justify-between mb-4 px-4">
              {[1, 2, 3, 4].map(step => (
                <div key={step} className="flex flex-col items-center z-10">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 border-4 ${step === currentStep ? 'bg-yellow-500 text-red-900 border-yellow-300 shadow-lg scale-110' : step < currentStep ? 'bg-green-600 text-white border-green-500' : 'bg-gray-200 text-gray-400 border-gray-300 dark:bg-red-950 dark:text-red-700 dark:border-red-900'}`}>{step < currentStep ? '✓' : step}</div>
                  <span className={`text-xs mt-2 font-bold uppercase tracking-wider transition-colors duration-300 ${step === currentStep ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-red-800'}`}>{step === 1 ? 'Bio' : step === 2 ? 'Church' : step === 3 ? 'Health' : 'Consent'}</span>
                </div>
              ))}
            </div>
            <div className="relative w-full h-1 bg-gray-200 dark:bg-red-950 rounded-full -mt-8 mb-8 z-0 mx-4 max-w-[calc(100%-2rem)]">
              <motion.div className="bg-gradient-to-r from-green-600 via-yellow-500 to-yellow-400 h-full rounded-full shadow-md" initial={{ width: "0%" }} animate={{ width: `${((currentStep - 1) / 3) * 100}%` }} transition={{ duration: 0.5, ease: "easeInOut" }} />
            </div>
          </div>

          <div className="glass-effect p-8 md:p-10 rounded-3xl relative bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-2xl backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-yellow-500/30 rounded-tl-3xl"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-yellow-500/30 rounded-br-3xl"></div>

            <form onSubmit={handleSubmit(onSubmit)}>
              {renderStepContent()}
              <div className="flex justify-between mt-12 pt-8 border-t border-gray-200 dark:border-white/10">
                {currentStep > 1 ? <button type="button" onClick={prevStep} disabled={isSubmitting} className="px-8 py-3 border border-gray-300 dark:border-white/20 text-gray-600 dark:text-white/70 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-bold disabled:opacity-50">← BACK</button> : <div></div>}
                {currentStep < 4 ? <button type="button" onClick={nextStep} className="btn-primary px-10 py-3 rounded-xl shadow-lg flex items-center gap-2">NEXT STEP →</button> : 
                  <motion.button type="submit" disabled={isSubmitting} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-primary px-12 py-3 rounded-xl shadow-xl disabled:opacity-70 disabled:grayscale flex items-center gap-2">
                    {isSubmitting ? "PROCESSING..." : "PAY ₦3,000 & REGISTER 💳"}
                  </motion.button>
                }
              </div>
            </form>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default TicketForm;