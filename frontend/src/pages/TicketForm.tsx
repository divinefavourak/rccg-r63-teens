import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  PERSONAL_INFO_FIELDS,
  CHURCH_INFO_FIELDS,
  MEDICAL_INFO_FIELDS,
  PARENT_INFO_FIELDS
} from "../constants/formFields";
import { ticketSchema, type TicketFormData } from "../schemas/ticketSchema";
import { useTicketStore } from "../store/ticketStore";
import { useAuth } from "../hooks/useAuth";

const STEP_FIELDS = {
  1: ['fullName', 'age', 'category', 'gender', 'phone', 'email'],
  2: ['province', 'zone', 'area', 'parish', 'department'],
  3: ['medicalConditions', 'medications', 'dietaryRestrictions', 'emergencyContact', 'emergencyPhone', 'emergencyRelationship'],
  4: ['parentName', 'parentEmail', 'parentPhone', 'parentRelationship', 'parentConsent', 'medicalConsent', 'photoConsent']
} as const;

interface EventOption {
  id: string;
  title: string;
  start_datetime: string;
  venue: string;
  registration_status: string;
  min_age: number | null;
  max_age: number | null;
}

const TicketForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);

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
      province: (user as any)?.province || "",
      zone: (user as any)?.zone || "",
      area: (user as any)?.area || "",
      parish: (user as any)?.parish || "",
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

  useEffect(() => {
    api.get('/events/events/?status=published')
      .then(({ data }) => {
        const list: EventOption[] = Array.isArray(data) ? data : (data.results || []);
        const open = list.filter(e => e.registration_status === 'open');
        setEvents(open);
        if (open.length === 1) setSelectedEventId(open[0].id);
      })
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoadingEvents(false));
  }, []);

  const nextStep = async () => {
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

  const onSubmit: SubmitHandler<TicketFormData> = async (data) => {
    if (!selectedEventId) {
      toast.error('Please select an event before submitting');
      setCurrentStep(1);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(`/events/events/${selectedEventId}/register/`, {
        attendee_name:     data.fullName,
        attendee_email:    data.email,
        attendee_phone:    data.phone,
        attendee_age:      data.age,
        attendee_gender:   data.gender,
        attendee_province: data.province,
        attendee_zone:     data.zone,
        attendee_area:     data.area,
        attendee_parish:   data.parish,
        attendee_department: data.department,
        attendee_category: data.category,
        medical_conditions:   data.medicalConditions,
        medications:          data.medications,
        dietary_restrictions: data.dietaryRestrictions,
        emergency_contact_name:         data.emergencyContact,
        emergency_contact_phone:        data.emergencyPhone,
        emergency_contact_relationship: data.emergencyRelationship,
        guardian_name:         data.parentName,
        guardian_email:        data.parentEmail,
        guardian_phone:        data.parentPhone,
        guardian_relationship: data.parentRelationship,
        guardian_consent:      data.parentConsent,
      });

      resetForm();
      toast.success('Registration successful! A confirmation has been sent.');

      if ((user as any)?.role === 'coordinator') {
        navigate('/coordinator/dashboard');
      } else {
        navigate('/ticket-preview', { state: { registration: response.data } });
      }
    } catch (error: any) {
      const detail = error?.response?.data;
      const errorMsg = detail
        ? (typeof detail === 'string' ? detail : JSON.stringify(detail))
        : 'Registration failed. Please try again.';
      toast.error(errorMsg.length < 200 ? errorMsg : 'Registration failed. Please check your details.');
      setIsSubmitting(false);
    }
  };

  const getErrorMessage = (fieldName: string) => {
    return errors[fieldName as keyof TicketFormData]?.message;
  };

  const renderFormField = (field: any) => {
    const hasError = !!errors[field.name as keyof TicketFormData];
    const inputClasses = `w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-xl 
      focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all 
      text-gray-900 dark:text-white 
      placeholder-gray-400 dark:placeholder-gray-500 
      ${hasError ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-700'}`;

    const registerOptions = field.name === 'age' ? { valueAsNumber: true } : {};

    switch (field.type) {
      case 'select':
        return (
          <select {...register(field.name as keyof TicketFormData, registerOptions)} className={inputClasses}>
            <option value="">Select...</option>
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
            <input type="checkbox" {...register(field.name as keyof TicketFormData, registerOptions)} className="mt-1 w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-gray-300 dark:border-gray-600" />
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
      case 1: title = "Basic Information"; fields = PERSONAL_INFO_FIELDS; break;
      case 2: title = "Church Information"; fields = CHURCH_INFO_FIELDS; break;
      case 3: title = "Health & Emergency"; fields = MEDICAL_INFO_FIELDS; break;
      case 4: title = "Parental Consent"; fields = PARENT_INFO_FIELDS; break;
    }

    return (
      <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 font-sans tracking-wide">{title}</h3>

        {currentStep === 4 && (
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-500/30 rounded-xl p-6 mb-6">
            <h4 className="font-bold text-primary-800 dark:text-primary-400 mb-2 flex items-center gap-2">Registration Info:</h4>
            <p className="text-primary-700 dark:text-primary-200/80 text-sm">Please review all details before submitting.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => (
            <div key={field.name} className={field.type === 'textarea' || field.type === 'checkbox' ? 'md:col-span-2' : ''}>
              {field.type !== 'checkbox' && (
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      {(user as any)?.role === 'coordinator' && (
        <div className="pt-20 px-6 max-w-4xl mx-auto">
          <Link to="/coordinator/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      )}
      <div className="pt-28 pb-16 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary-100/50 dark:from-primary-900/20 to-transparent pointer-events-none transition-colors duration-500"></div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black mb-4 text-gray-900 dark:text-white">
              <span className="text-primary-600">JUNIOR CHURCH</span> REGISTRATION
            </h1>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto text-lg">Join us on the Teen Digital Platform.</p>
          </div>

          {/* Event picker */}
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              📅 <span>Select Event <span className="text-red-500">*</span></span>
            </label>
            {loadingEvents ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading events…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No events are currently open for registration.
              </p>
            ) : (
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all"
              >
                <option value="">Choose an event…</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                    {ev.start_datetime
                      ? ` — ${new Date(ev.start_datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : ''}
                    {ev.venue ? ` · ${ev.venue}` : ''}
                  </option>
                ))}
              </select>
            )}
            {!selectedEventId && !loadingEvents && events.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                Please pick an event to continue.
              </p>
            )}
          </div>

          <div className="mb-10">
            <div className="flex items-center justify-between mb-4 px-4">
              {[1, 2, 3, 4].map(step => (
                <div key={step} className="flex flex-col items-center z-10">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 border-4 ${step === currentStep ? 'bg-primary-600 text-white border-primary-400 shadow-lg scale-110' : step < currentStep ? 'bg-green-600 text-white border-green-500' : 'bg-gray-200 text-gray-400 border-gray-300 dark:bg-gray-800 dark:text-gray-600 dark:border-gray-700'}`}>{step < currentStep ? '✓' : step}</div>
                  <span className={`text-xs mt-2 font-bold uppercase tracking-wider transition-colors duration-300 ${step === currentStep ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-600'}`}>{step === 1 ? 'Bio' : step === 2 ? 'Church' : step === 3 ? 'Health' : 'Consent'}</span>
                </div>
              ))}
            </div>
            <div className="relative w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full -mt-8 mb-8 z-0 mx-4 max-w-[calc(100%-2rem)]">
              <motion.div className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 h-full rounded-full shadow-md" initial={{ width: "0%" }} animate={{ width: `${((currentStep - 1) / 3) * 100}%` }} transition={{ duration: 0.5, ease: "easeInOut" }} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 md:p-10 rounded-3xl relative border border-gray-100 dark:border-gray-700 shadow-xl">
            <form onSubmit={handleSubmit(onSubmit)}>
              {renderStepContent()}
              <div className="flex justify-between mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                {currentStep > 1 ? <button type="button" onClick={prevStep} disabled={isSubmitting} className="px-8 py-3 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-bold disabled:opacity-50">← BACK</button> : <div></div>}
                {currentStep < 4 ? <button type="button" onClick={nextStep} className="btn-primary px-10 py-3 rounded-xl shadow-lg flex items-center gap-2">NEXT STEP →</button> :
                  <motion.button type="submit" disabled={isSubmitting} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-primary px-12 py-3 rounded-xl shadow-xl disabled:opacity-70 disabled:grayscale flex items-center gap-2">
                    {isSubmitting ? "PROCESSING..." : "COMPLETE REGISTRATION"}
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