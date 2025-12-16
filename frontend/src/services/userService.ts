import { api } from "./api";

export interface UserData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: 'admin' | 'coordinator';
  province?: string; // Optional, only for coordinators
  zone?: string;
  area?: string;
  parish?: string;
}

class UserService {
  /**
   * Create a new user (Admin or Coordinator).
   * Requires Admin privileges.yhh
   */
  async createUser(data: UserData) {
    // Backend validation: Admin cannot have a province
    if (data.role === 'admin') {
      delete data.province;
    }

    const response = await api.post('/auth/users/', data);
    return response.data;
  }

  /**
   * Get all users (for listing/management)
   */
  async getAllUsers() {
    const response = await api.get('/users/');
    return response.data;
  }
}

export const userService = new userService();
