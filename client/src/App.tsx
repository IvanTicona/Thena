import { lazy, Suspense } from 'react';
import { ConfigProvider, Spin } from 'antd';
import esES from 'antd/locale/es_ES';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { StudentThesisGuard } from './components/StudentThesisGuard';
import { AppLayout } from './components/layout/AppLayout';

/* ── Lazy-loaded pages ────────────────────────────────────── */
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const OnboardingPage = lazy(() => import('./pages/student/OnboardingPage'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const ChapterList = lazy(() => import('./pages/student/ChapterList'));
const ChapterDetail = lazy(() => import('./pages/student/ChapterDetail'));
const ReviewView = lazy(() => import('./pages/student/ReviewView'));
const TutorDashboard = lazy(() => import('./pages/tutor/TutorDashboard'));
const KnowledgeBase = lazy(() => import('./pages/tutor/KnowledgeBase'));
const SubmissionReview = lazy(() => import('./pages/tutor/SubmissionReview'));

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
        <Suspense fallback={<Spin size="large" className="u-spinner-fullscreen" />}>
          <Routes>
          {/* Public auth routes — redirect to dashboard if already authenticated */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Onboarding — protected but outside AppLayout (uses AuthLayout) */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          {/* Protected routes — require authentication */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Default redirect to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Student routes — guarded by thesis check */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <StudentThesisGuard />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<StudentDashboard />} />
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
        </Suspense>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
