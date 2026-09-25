import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PreviewBanner } from './components/PreviewBanner';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import NewAnalysis from './pages/NewAnalysis';
import MyAnalyses from './pages/MyAnalyses';
import AnalysisResult from './pages/AnalysisResult';
import Resumes from './pages/Resumes';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import { PrivacyPage, TermsPage, AboutPage, ContactPage } from './pages/Legal';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <PreviewBanner />
            <Routes>
              {/* Public */}
              <Route path="/"                element={<Landing />} />
              <Route path="/login"           element={<Login />} />
              <Route path="/signup"          element={<Signup />} />
              <Route path="/verify-email"    element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />
              <Route path="/auth/callback"   element={<AuthCallback />} />
              <Route path="/privacy"         element={<PrivacyPage />} />
              <Route path="/terms"           element={<TermsPage />} />
              <Route path="/about"           element={<AboutPage />} />
              <Route path="/contact"         element={<ContactPage />} />

              {/* Protected — all user routes */}
              <Route path="/dashboard"       element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/new-analysis"    element={<ProtectedRoute><NewAnalysis /></ProtectedRoute>} />
              <Route path="/analyses"        element={<ProtectedRoute><MyAnalyses /></ProtectedRoute>} />
              <Route path="/analyses/:id"    element={<ProtectedRoute><AnalysisResult /></ProtectedRoute>} />
              <Route path="/resumes"         element={<ProtectedRoute><Resumes /></ProtectedRoute>} />
              <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings"        element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* Admin — backend enforces role; frontend also redirects non-admins */}
              <Route path="/admin"           element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
