import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/react"; // NEW: Analytics
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import Snowfall from './components/Snowfall';
import ChristmasDecorations from './components/ChristmasDecorations';
import { AuthProvider } from './context/AuthContext';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const TicketForm = lazy(() => import('./pages/TicketForm'));
const TicketPreview = lazy(() => import('./pages/TicketPreview'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminRegister = lazy(() => import('./pages/AdminRegister'));
const RegisterCoordinator = lazy(() => import('./pages/RegisterCoordinator'));
const AdminVerify = lazy(() => import('./pages/AdminVerify'));
const CoordinatorLogin = lazy(() => import('./pages/CoordinatorLogin'));
const CoordinatorDashboard = lazy(() => import('./pages/CoordinatorDashboard'));
const BulkRegister = lazy(() => import('./pages/BulkRegister'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PaymentCallback = lazy(() => import('./pages/PaymentCallback'));

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
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Snowfall />
        <ChristmasDecorations />
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
            <Route path="/" element={<LandingPage />} />
            <Route path="/ticket-preview" element={<TicketPreview />} />
            
            {/* PUBLIC REGISTRATION ROUTE */}
            <Route path="/get-ticket" element={<TicketForm />} />
            
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/coordinator-login" element={<CoordinatorLogin />} />
            
            {/* Coordinator Routes */}
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

            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={<ProtectedRoute allowedRoles={['admin']}><AdminVerify /></ProtectedRoute>} 
            />
            <Route 
  path="/admin/register-admin" 
  element={
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminRegister />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/register-coordinator" 
  element={<ProtectedRoute allowedRoles={['admin']}><RegisterCoordinator /></ProtectedRoute>} 
/>
            {/* Paystack Callback Route */}
            <Route path="/payment/callback" element={<PaymentCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        
        {/* Vercel Analytics Tracker */}
        <Analytics />
      </Router>
    </AuthProvider>
  );
}

export default App;