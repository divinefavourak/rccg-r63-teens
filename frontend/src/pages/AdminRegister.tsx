import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { FaUserShield, FaUserPlus, FaLock, FaEnvelope, FaPhone, FaArrowLeft } from "react-icons/fa";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { userService, UserData } from "../services/userService";

const AdminRegister = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset
  } = useForm<UserData>();

  const password = watch("password");

  const onSubmit: SubmitHandler<UserData> = async (data) => {
    setIsSubmitting(true);
    try {
      // Force role to admin for this specific page
      const payload = { ...data, role: 'admin' as const };
      
      await userService.createUser(payload);
      
      toast.success(`Admin "${data.username}" created successfully!`);
      reset();
      // Optional: Redirect to a user list or dashboard
      // navigate('/admin/users'); 
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.detail || 
                       JSON.stringify(error.response?.data) || 
                       "Failed to create admin.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white transition-colors duration-500">
      <Navbar />
      <div className="pt-28 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black text-red-900 dark:text-white flex items-center gap-3">
                <FaUserShield className="text-yellow-600" /> Register New Admin
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Create a new administrator account with full system access.
              </p>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-2 text-sm font-bold"
            >
              <FaArrowLeft /> Back
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Account Info Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-200 dark:border-white/10 pb-2">Account Credentials</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Username <span className="text-red-500">*</span></label>
                    <input 
                      {...register("username", { required: "Username is required", minLength: { value: 3, message: "Min 3 chars" } })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="admin_username"
                    />
                    {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Email <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="email"
                        {...register("email", { required: "Email is required" })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                        placeholder="admin@rccg63.org"
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="password"
                        {...register("password", { required: "Password is required", minLength: { value: 8, message: "Min 8 chars" } })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Confirm Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="password"
                        {...register("password_confirm", { 
                          required: "Please confirm password",
                          validate: val => val === password || "Passwords do not match"
                        })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                    {errors.password_confirm && <p className="text-red-500 text-xs mt-1">{errors.password_confirm.message}</p>}
                  </div>
                </div>
              </div>

              {/* Personal Info Section */}
              <div className="space-y-4 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-200 dark:border-white/10 pb-2">Personal Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">First Name <span className="text-red-500">*</span></label>
                    <input 
                      {...register("first_name", { required: "Required" })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="John"
                    />
                    {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Last Name <span className="text-red-500">*</span></label>
                    <input 
                      {...register("last_name", { required: "Required" })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="Doe"
                    />
                    {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Phone Number</label>
                  <div className="relative">
                    <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      {...register("phone")}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                      placeholder="+234..."
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary px-8 py-3 rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : <><FaUserPlus /> Create Admin</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminRegister;