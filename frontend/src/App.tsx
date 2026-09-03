import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/react";
import ScrollToTop from './components/ScrollToTop';
import Loader from './components/Loader';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/layout/PublicLayout';

// DashboardLayout and AdminLayout were static imports, which pulled both shells
// — and framer-motion, the Sidebar and its icon set with them — into the entry
// chunk that every visitor downloads. Someone reading the landing page has no
// use for the admin shell, so both are now split out behind the Suspense
// boundary below. PublicLayout stays static: it renders the Navbar and Footer
// on the first paint of '/', so splitting it would only add a round trip.
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));

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
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Teen Dashboard Pages
const Overview = lazy(() => import('./pages/dashboard/Overview'));
const Devotionals = lazy(() => import('./pages/content/Devotionals'));
const Manuals = lazy(() => import('./pages/content/Manuals'));
const Podcasts = lazy(() => import('./pages/content/Podcasts'));
const DashboardEvents = lazy(() => import('./pages/dashboard/Events'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));

// The Console — the new admin panel. One lazy chunk: shell, permission context
// and every screen, so none of it reaches the bundle a teen downloads.
const ConsoleRoutes = lazy(() => import('./pages/console/ConsoleRoutes'));

// Admin Panel Pages (legacy). Still routed at /admin and still the working
// panel; the Console replaces it once its screens are ported.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminDevotionals = lazy(() => import('./pages/AdminDevotionals'));
const AdminManuals = lazy(() => import('./pages/AdminManuals'));
const AdminMedia = lazy(() => import('./pages/AdminMedia'));
const AdminEvents = lazy(() => import('./pages/AdminEvents'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

// One loader for every route transition. See components/Loader.tsx for why the
// three previous spinners were collapsed into it.
const Loading = () => <Loader />;

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { background: '#0F172A', color: '#fff', border: '1px solid rgba(245,158,11,0.25)', padding: '16px', borderRadius: '12px' },
          success: { iconTheme: { primary: '#F59E0B', secondary: '#0F172A' }, style: { border: '1px solid #F59E0B' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' }, style: { border: '1px solid #ef4444' } },
        }}
      />

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public Routes with layout (Navbar + Footer from PublicLayout) */}
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

          {/*
            The Console. Gated on being signed in only — what you can see inside
            is decided by the 21 permissions from /identity/me/, not by a role
            string. Someone holding no role gets a stated "you have no role yet"
            screen from ConsoleLayout rather than a redirect, because being
            authenticated with no authority is a real state, not an error.
          */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute loginPath="/admin-login">
                <ConsoleRoutes />
              </ProtectedRoute>
            }
          />

          {/* /console kept as an alias so any existing bookmark still lands. */}
          <Route
            path="/console/*"
            element={
              <ProtectedRoute loginPath="/admin-login">
                <ConsoleRoutes />
              </ProtectedRoute>
            }
          />

          {/*
            The previous admin panel, moved aside rather than deleted. Its pages
            are still the only working implementations of Devotionals, Manuals,
            Media, Events and Users against the live API, so they stay reachable
            until the Console screens that replace them are ported and verified.
            Delete this block — and pages/Admin*.tsx — once that is done.
          */}
          <Route
            path="/legacy-admin"
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Analytics />
    </Router>
  );
}

export default App;