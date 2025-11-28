import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { PERSONAL_INFO_FIELDS, CHURCH_INFO_FIELDS, MEDICAL_INFO_FIELDS, PARENT_INFO_FIELDS } from "../constants/formFields";

const TicketForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Information
    fullName: "",
    age: "",
    category: "",
    gender: "",
    phone: "",
    email: "",
    
    // Church Information
    province: "",
    zone: "",
    area: "",
    parish: "",
    department: "",
    
    // Medical Information
    medicalConditions: "",
    medications: "",
    dietaryRestrictions: "",
    emergencyContact: "",
    emergencyPhone: "",
    emergencyRelationship: "",
    
    // Parent Information
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    parentRelationship: "",
    parentConsent: false,
    medicalConsent: false,
    photoConsent: false,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      PERSONAL_INFO_FIELDS.forEach(field => {
        if (field.required && !formData[field.name]) {
          newErrors[field.name] = `${field.label} is required`;
        }
      });
    } else if (step === 2) {
      CHURCH_INFO_FIELDS.forEach(field => {
        if (field.required && !formData[field.name]) {
          newErrors[field.name] = `${field.label} is required`;
        }
      });
    } else if (step === 3) {
      MEDICAL_INFO_FIELDS.forEach(field => {
        if (field.required && !formData[field.name]) {
          newErrors[field.name] = `${field.label} is required`;
        }
      });
    } else if (step === 4) {
      PARENT_INFO_FIELDS.forEach(field => {
        if (field.required && !formData[field.name]) {
          newErrors[field.name] = `${field.label} is required`;
        }
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateStep(currentStep)) {
      // Generate ticket data
      const ticketData = {
        ...formData,
        ticketId: `R63T${Date.now()}`,
        status: 'pending',
        registeredAt: new Date().toISOString(),
      };
      
      console.log('Ticket Data:', ticketData);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to ticket preview with ticket data
      navigate('/ticket-preview', { state: { ticket: ticketData } });
    }
  };

  const renderFormField = (field) => {
    switch (field.type) {
      case 'select':
        return (
          <select
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            required={field.required}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
              errors[field.name] ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            {field.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'textarea':
        return (
          <textarea
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            required={field.required}
            placeholder={field.placeholder}
            rows={4}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
              errors[field.name] ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        );
      
      case 'checkbox':
        return (
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              name={field.name}
              checked={formData[field.name]}
              onChange={handleChange}
              required={field.required}
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-gray-700">{field.label}</span>
          </label>
        );
      
      default:
        return (
          <input
            type={field.type}
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            required={field.required}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${
              errors[field.name] ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        );
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PERSONAL_INFO_FIELDS.map(field => (
                <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderFormField(field)}
                  {errors[field.name] && (
                    <p className="text-red-500 text-sm mt-1">{errors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      
      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Church Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CHURCH_INFO_FIELDS.map(field => (
                <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderFormField(field)}
                  {errors[field.name] && (
                    <p className="text-red-500 text-sm mt-1">{errors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      
      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Medical & Emergency Information</h3>
            <div className="space-y-6">
              {MEDICAL_INFO_FIELDS.map(field => (
                <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderFormField(field)}
                  {errors[field.name] && (
                    <p className="text-red-500 text-sm mt-1">{errors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      
      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Parent/Guardian Consent</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <h4 className="font-semibold text-yellow-800 mb-2">Important Notice:</h4>
              <p className="text-yellow-700 text-sm">
                A consent email will be sent to the parent/guardian email provided below. 
                The registration will only be confirmed after parental consent is received.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PARENT_INFO_FIELDS.map(field => (
                <div key={field.name} className={field.type === 'checkbox' ? 'md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-200' : ''}>
                  <label className={`block text-sm font-semibold ${field.type === 'checkbox' ? 'text-blue-800' : 'text-gray-700'} mb-2`}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderFormField(field)}
                  {errors[field.name] && (
                    <p className="text-red-500 text-sm mt-1">{errors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="pt-24 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Register for {EVENT_DETAILS.title}
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Complete this 4-step form to secure your spot. All fields marked with * are required.
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3, 4].map(step => (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step === currentStep 
                      ? 'bg-green-600 text-white' 
                      : step < currentStep 
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  <span className="text-sm mt-2 text-gray-600 text-center">
                    {step === 1 ? 'Personal' : step === 2 ? 'Church' : step === 3 ? 'Medical' : 'Parent'}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div 
                className="bg-green-600 h-2 rounded-full"
                initial={{ width: `${((currentStep - 1) / 4) * 100}%` }}
                animate={{ width: `${((currentStep - 1) / 4) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Form */}
          <div className="card p-8">
            <form onSubmit={handleSubmit}>
              {renderStep()}
              
              {/* Navigation Buttons */}
              <div className="flex justify-between mt-12 pt-6 border-t border-gray-200">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-8 py-3 border-2 border-gray-400 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  >
                    ← Previous
                  </button>
                ) : (
                  <div></div>
                )}
                
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="btn-primary px-8 py-3"
                  >
                    Next Step →
                  </button>
                ) : (
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary px-8 py-3 text-lg"
                  >
                    🎟️ Complete Registration
                  </motion.button>
                )}
              </div>
            </form>
          </div>

          {/* Event Details Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 card p-6"
          >
            <h3 className="font-bold text-lg mb-4 text-gray-800">Event Details</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p><span className="font-semibold">When:</span> {EVENT_DETAILS.date}</p>
              <p><span className="font-semibold">Where:</span> {EVENT_DETAILS.location}</p>
              <p><span className="font-semibold">Address:</span> {EVENT_DETAILS.address}</p>
              <p><span className="font-semibold">Theme:</span> "{EVENT_DETAILS.theme}"</p>
              <p><span className="font-semibold">Contact:</span> {EVENT_DETAILS.contact.email}</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
      
      <Footer />
    </div>
  );
};

export default TicketForm;