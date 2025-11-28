import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Lazy load pages for better performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const TicketForm = lazy(() => import('./pages/TicketForm'));
const TicketPreview = lazy(() => import('./pages/TicketPreview'));
const AdminVerify = lazy(() => import('./pages/AdminVerify'));

// Simple loading component
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/get-ticket" element={<TicketForm />} />
          <Route path="/ticket-preview" element={<TicketPreview />} />
          <Route path="/admin" element={<AdminVerify />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;