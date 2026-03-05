import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/react";
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import AdminLayout from './components/AdminLayout';

// Lazy Load Pages — Public (layout pages, rendered under PublicLayout)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const TicketForm = lazy(() => import('./pages/TicketForm'));
const TicketPreview = lazy(() => import('./pages/TicketPreview'));
const PaymentCallback = lazy(() => import('./pages/PaymentCallback'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const UploadPayment = lazy(() => import('./pages/UploadPayment'));
const CheckTicketStatus = lazy(() => import('./pages/TicketNotFound'));

// Standalone public pages (have own Navbar/Footer)
const DevotionalList = lazy(() => import('./pages/DevotionalList'));
const DevotionalDetail = lazy(() => import('./pages/DevotionalDetail'));
const EventList = lazy(() => import('./pages/EventList'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const ManualList = lazy(() => import('./pages/ManualList'));
const MediaList = lazy(() => import('./pages/MediaList'));

// Auth pages
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminRegister = lazy(() => import('./pages/AdminRegister'));
const RegisterCoordinator = lazy(() => import('./pages/RegisterCoordinator'));
const AdminVerify = lazy(() => import('./pages/AdminVerify'));
const CoordinatorLogin = lazy(() => import('./pages/CoordinatorLogin'));
const CoordinatorDashboard = lazy(() => import('./pages/CoordinatorDashboard'));
const BulkRegister = lazy(() => import('./pages/BulkRegister'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Teen Dashboard Pages
const Overview = lazy(() => import('./pages/dashboard/Overview'));
const Devotionals = lazy(() => import('./pages/content/Devotionals'));
const Manuals = lazy(() => import('./pages/content/Manuals'));
const Podcasts = lazy(() => import('./pages/content/Podcasts'));
const DashboardEvents = lazy(() => import('./pages/dashboard/Events'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));

// Admin Panel Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminDevotionals = lazy(() => import('./pages/AdminDevotionals'));
const AdminManuals = lazy(() => import('./pages/AdminManuals'));
const AdminMedia = lazy(() => import('./pages/AdminMedia'));
const AdminEvents = lazy(() => import('./pages/AdminEvents'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#2b0303] dark:bg-[#1a0505] transition-colors duration-500">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-yellow-500/30 rounded-full animate-pulse"></div>
        <div className="absolute inset-0 border-t-4 border-yellow-500 rounded-full animate-spin"></div>
      </div>
      <p className="text-yellow-500 font-bold tracking-widest text-xs animate-pulse">LOADING...</p>
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
          style: { background: '#1a0505', color: '#fff', border: '1px solid #8B0000', padding: '16px', borderRadius: '12px' },
          success: { iconTheme: { primary: '#FFD700', secondary: '#1a0505' }, style: { border: '1px solid #FFD700' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' }, style: { border: '1px solid #ef4444' } },
        }}
      />

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public Routes with layout (Navbar + Footer from PublicLayout, plus Snowfall decorations) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/get-ticket" element={<TicketForm />} />
            <Route path="/ticket-preview" element={<TicketPreview />} />
            <Route path="/ticket-not-found" element={<CheckTicketStatus />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
            <Route path="/upload-payment" element={<UploadPayment />} />
          </Route>

          {/* Standalone public content pages (have their own Navbar/Footer) */}
          <Route path="/devotionals" element={<DevotionalList />} />
          <Route path="/devotionals/:id" element={<DevotionalDetail />} />
          <Route path="/events" element={<EventList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/manuals" element={<ManualList />} />
          <Route path="/media" element={<MediaList />} />

          {/* Teen Dashboard Routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="devotionals" element={<Devotionals />} />
            <Route path="manuals" element={<Manuals />} />
            <Route path="podcasts" element={<Podcasts />} />
            <Route path="events" element={<DashboardEvents />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Admin Panel Routes (AdminLayout with full sidebar) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="devotionals" element={<AdminDevotionals />} />
            <Route path="manuals" element={<AdminManuals />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Standalone Admin Routes (self-contained pages with own Navbar/Footer) */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route
            path="/admin/verify"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminVerify /></ProtectedRoute>}
          />
          <Route
            path="/admin/register-admin"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminRegister /></ProtectedRoute>}
          />
          <Route
            path="/admin/register-coordinator"
            element={<ProtectedRoute allowedRoles={['admin']}><RegisterCoordinator /></ProtectedRoute>}
          />

          {/* Coordinator Routes */}
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

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Analytics />
    </Router>
  );
}

export default App;