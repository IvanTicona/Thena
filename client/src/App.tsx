import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
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
        },
      }}
    >
      <AuthProvider>
        <Routes>
          {/* Public auth routes — no ProtectedRoute, no AppLayout */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes — require authentication */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/chapters" replace />} />

              {/* Student routes */}
              <Route
                path="/chapters"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <ChapterList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chapters/:id"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <ChapterDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chapters/:id/review/:jobId"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <ReviewView />
                  </ProtectedRoute>
                }
              />

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
