import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/react";
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';

// Auth / Public pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Auth3D = lazy(() => import('./pages/Auth3D'));
const TicketForm = lazy(() => import('./pages/TicketForm'));
const TicketPreview = lazy(() => import('./pages/TicketPreview'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const PaymentCallback = lazy(() => import('./pages/PaymentCallback'));
const UploadPayment = lazy(() => import('./pages/UploadPayment'));
const CheckTicketStatus = lazy(() => import('./pages/TicketNotFound'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Dashboard pages
const Overview = lazy(() => import('./pages/dashboard/Overview'));
const Devotionals = lazy(() => import('./pages/content/Devotionals'));
const Manuals = lazy(() => import('./pages/content/Manuals'));
const Podcasts = lazy(() => import('./pages/content/Podcasts'));
const DashboardEvents = lazy(() => import('./pages/dashboard/Events'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));

// Admin pages
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminRegister = lazy(() => import('./pages/AdminRegister'));
const AdminDevotionals = lazy(() => import('./pages/AdminDevotionals'));
const AdminManuals = lazy(() => import('./pages/AdminManuals'));
const AdminMedia = lazy(() => import('./pages/AdminMedia'));
const AdminEvents = lazy(() => import('./pages/AdminEvents'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const RegisterCoordinator = lazy(() => import('./pages/RegisterCoordinator'));

// Coordinator pages
const CoordinatorLogin = lazy(() => import('./pages/CoordinatorLogin'));
const CoordinatorDashboard = lazy(() => import('./pages/CoordinatorDashboard'));
const BulkRegister = lazy(() => import('./pages/BulkRegister'));
const CheckIn = lazy(() => import('./pages/CheckIn'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-primary-200 rounded-full animate-pulse"></div>
        <div className="absolute inset-0 border-t-4 border-primary-500 rounded-full animate-spin"></div>
      </div>
      <p className="text-primary-600 font-bold tracking-widest text-xs animate-pulse">LOADING...</p>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { background: '#064e3b', color: '#fff', border: '1px solid #059669', padding: '16px', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10B981', secondary: '#064e3b' }, style: { border: '1px solid #10B981' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' }, style: { border: '1px solid #ef4444' } },
        }}
      />

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public Routes with shared layout */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/get-ticket" element={<TicketForm />} />
            <Route path="/ticket-preview" element={<TicketPreview />} />
            <Route path="/ticket-not-found" element={<CheckTicketStatus />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
            <Route path="/upload-payment" element={<UploadPayment />} />
          </Route>

          {/* Auth */}
          <Route path="/login" element={<Auth3D />} />
          <Route path="/register" element={<Auth3D initialIsSignUp={true} />} />

          {/* Teen Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<Overview />} />
            <Route path="devotionals" element={<Devotionals />} />
            <Route path="manuals" element={<Manuals />} />
            <Route path="podcasts" element={<Podcasts />} />
            <Route path="events" element={<DashboardEvents />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Coordinator */}
          <Route path="/coordinator-login" element={<CoordinatorLogin />} />
          <Route
            path="/coordinator/dashboard"
            element={<ProtectedRoute allowedRoles={['coordinator']}><CoordinatorDashboard /></ProtectedRoute>}
          />
          <Route
            path="/coordinator/bulk-register"
            element={<ProtectedRoute allowedRoles={['coordinator']}><BulkRegister /></ProtectedRoute>}
          />
          <Route
            path="/coordinator/single-register"
            element={<ProtectedRoute allowedRoles={['coordinator']}><TicketForm /></ProtectedRoute>}
          />

          {/* Check-in — accessible to coordinators and admins */}
          <Route
            path="/check-in"
            element={<ProtectedRoute allowedRoles={['coordinator', 'admin']}><CheckIn /></ProtectedRoute>}
          />

          {/* Admin */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="devotionals" element={<AdminDevotionals />} />
            <Route path="manuals" element={<AdminManuals />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="register-admin" element={<AdminRegister />} />
            <Route path="register-coordinator" element={<RegisterCoordinator />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Analytics />
    </Router>
  );
}

export default App;
