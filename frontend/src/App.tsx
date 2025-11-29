import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import Snowfall from './components/Snowfall';
import ChristmasDecorations from './components/ChristmasDecorations'; // <--- IMPORT THIS

// Lazy load pages...
const LandingPage = lazy(() => import('./pages/LandingPage'));
const TicketForm = lazy(() => import('./pages/TicketForm'));
const TicketPreview = lazy(() => import('./pages/TicketPreview'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminVerify = lazy(() => import('./pages/AdminVerify'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#2b0303]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
  </div>
);

function App() {
  return (
    <Router>
      <ScrollToTop />
      
      {/* Global Christmas Atmosphere */}
      <Snowfall />
      <ChristmasDecorations /> {/* <--- ADD THIS HERE */}
      
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a0505',
            color: '#fff',
            border: '1px solid #8B0000',
          },
          success: {
            iconTheme: { primary: '#FFD700', secondary: '#1a0505' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
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