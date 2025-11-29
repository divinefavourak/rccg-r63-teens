import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast'; // <--- IMPORT THIS
import ProtectedRoute from './components/ProtectedRoute';
import { Analytics } from "@vercel/analytics/next"
import ScrollToTop from './components/ScrollToTop';

// Lazy load pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const TicketForm = lazy(() => import('./pages/TicketForm'));
const TicketPreview = lazy(() => import('./pages/TicketPreview'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminVerify = lazy(() => import('./pages/AdminVerify'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
  </div>
);

function App() {
  return (
    <Router>
      {/* Configure Toaster globally */}
      <ScrollToTop />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/get-ticket" element={<TicketForm />} />
          <Route path="/ticket-preview" element={<TicketPreview />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminVerify />
              </ProtectedRoute>
            } 
          /> 
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;