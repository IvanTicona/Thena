import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StudentThesisGuard } from './components/StudentThesisGuard';
import { AppLayout } from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OnboardingPage from './pages/student/OnboardingPage';
import ChapterList from './pages/student/ChapterList';
import ChapterDetail from './pages/student/ChapterDetail';
import ReviewView from './pages/student/ReviewView';
import TutorDashboard from './pages/tutor/TutorDashboard';
import KnowledgeBase from './pages/tutor/KnowledgeBase';
import SubmissionReview from './pages/tutor/SubmissionReview';

function App() {
  return (
    <ConfigProvider
      locale={esES}
      theme={{
        token: {
          colorPrimary: '#06175d',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Menu: {
            itemSelectedBg: '#e8ebf5',
            itemSelectedColor: '#06175d',
            itemHoverBg: '#f0f2f8',
            itemActiveBg: '#dde1f0',
          },
        },
      }}
    >
      <AuthProvider>
        <Routes>
          {/* Public auth routes — no ProtectedRoute, no AppLayout */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Onboarding — protected but outside AppLayout (uses AuthLayout) */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          {/* Protected routes — require authentication */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Default redirect based on role is handled by ProtectedRoute */}
              <Route path="/" element={<Navigate to="/chapters" replace />} />

              {/* Student routes — guarded by thesis check */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <StudentThesisGuard />
                  </ProtectedRoute>
                }
              >
                <Route path="/chapters" element={<ChapterList />} />
                <Route path="/chapters/:id" element={<ChapterDetail />} />
                <Route
                  path="/chapters/:id/review/:jobId"
                  element={<ReviewView />}
                />
              </Route>

              {/* Tutor routes */}
              <Route
                path="/tutor"
                element={
                  <ProtectedRoute allowedRoles={['TUTOR']}>
                    <TutorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tutor/knowledge"
                element={
                  <ProtectedRoute allowedRoles={['TUTOR']}>
                    <KnowledgeBase />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tutor/submissions/:submissionId"
                element={
                  <ProtectedRoute allowedRoles={['TUTOR']}>
                    <SubmissionReview />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
