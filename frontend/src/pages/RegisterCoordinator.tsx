import { useState } from "react";
import { useForm } from "react-hook-form";
import { userService, UserData } from "../services/userService";
import { CHURCH_INFO_FIELDS } from "../constants/formFields"; // Re-use province list
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const RegisterCoordinator = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset } = useForm<UserData>();
  
  // Get province options from your constants
  const provinceOptions = CHURCH_INFO_FIELDS.find(f => f.name === 'province')?.options || [];

  const onSubmit = async (data: UserData) => {
    setIsSubmitting(true);
    try {
      await userService.createUser({
        ...data,
        role: 'coordinator', // Force role
      });
      toast.success(`Coordinator for ${data.province} created!`);
      reset();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to create coordinator");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-32 px-6">
      <Navbar />
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Register New Coordinator</h1>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Username</label>
            <input {...register("username", { required: true })} className="w-full p-3 border rounded-xl bg-gray-50" placeholder="lp9_coord" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">First Name</label>
              <input {...register("first_name", { required: true })} className="w-full p-3 border rounded-xl bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Last Name</label>
              <input {...register("last_name", { required: true })} className="w-full p-3 border rounded-xl bg-gray-50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Email</label>
            <input type="email" {...register("email", { required: true })} className="w-full p-3 border rounded-xl bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Province</label>
            <select {...register("province", { required: true })} className="w-full p-3 border rounded-xl bg-gray-50">
              <option value="">Select Province...</option>
              {provinceOptions.map((opt: any) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Password</label>
            <input type="password" {...register("password", { required: true })} className="w-full p-3 border rounded-xl bg-gray-50" />
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-1">Confirm Password</label>
            <input type="password" {...register("password_confirm", { required: true })} className="w-full p-3 border rounded-xl bg-gray-50" />
          </div>

          <button disabled={isSubmitting} className="w-full btn-primary py-3 rounded-xl font-bold mt-4">
            {isSubmitting ? "Creating..." : "Create Coordinator"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterCoordinator;