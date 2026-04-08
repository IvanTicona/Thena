import { lazy, Suspense } from 'react';
import { ConfigProvider, App as AntApp, Spin } from 'antd';
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
const ChapterHistory = lazy(() => import('./pages/student/ChapterHistory'));
const TutorDashboard = lazy(() => import('./pages/tutor/TutorDashboard'));
const KnowledgeBase = lazy(() => import('./pages/tutor/KnowledgeBase'));
const SubmissionReview = lazy(() => import('./pages/tutor/SubmissionReview'));

/* ── Admin pages ──────────────────────────────────────────── */
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AssignmentManagement = lazy(() => import('./pages/admin/AssignmentManagement'));
const KnowledgeBaseAdmin = lazy(() => import('./pages/admin/KnowledgeBaseAdmin'));
const MetricsDashboard = lazy(() => import('./pages/admin/MetricsDashboard'));

/* ── Reviewer pages ───────────────────────────────────────── */
const ReviewerDashboard = lazy(() => import('./pages/reviewer/ReviewerDashboard'));
const ReviewerReviewView = lazy(() => import('./pages/reviewer/ReviewerReviewView'));

/* ── Super Admin pages ────────────────────────────────────── */
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'));
const AuditLogViewer = lazy(() => import('./pages/superadmin/AuditLogViewer'));

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
      <AntApp>
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
                  path="/chapters/:id/history"
                  element={<ChapterHistory />}
                />
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

              {/* Reviewer routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['REVIEWER']} />
                }
              >
                <Route path="/reviewer" element={<ReviewerDashboard />} />
                <Route
                  path="/reviewer/review/:jobId"
                  element={<ReviewerReviewView />}
                />
              </Route>

              {/* Admin routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']} />
                }
              >
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<UserManagement />} />
                <Route path="/admin/assignments" element={<AssignmentManagement />} />
                <Route path="/admin/knowledge" element={<KnowledgeBaseAdmin />} />
                <Route path="/admin/metrics" element={<MetricsDashboard />} />
              </Route>

              {/* Super Admin routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']} />
                }
              >
                <Route path="/superadmin" element={<SuperAdminDashboard />} />
                <Route path="/superadmin/audit" element={<AuditLogViewer />} />
              </Route>
            </Route>
          </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
