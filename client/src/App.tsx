import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { AppLayout } from './components/layout/AppLayout';
import ChapterList from './pages/student/ChapterList';
import ChapterDetail from './pages/student/ChapterDetail';
import ReviewView from './pages/student/ReviewView';
import TutorDashboard from './pages/tutor/TutorDashboard';
import KnowledgeBase from './pages/tutor/KnowledgeBase';
import SubmissionReview from './pages/tutor/SubmissionReview';

function App() {
  return (
    <ConfigProvider locale={esES}>
      <UserProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/chapters" replace />} />
            <Route path="/chapters" element={<ChapterList />} />
            <Route path="/chapters/:id" element={<ChapterDetail />} />
            <Route
              path="/chapters/:id/review/:jobId"
              element={<ReviewView />}
            />
            <Route path="/tutor" element={<TutorDashboard />} />
            <Route path="/tutor/knowledge" element={<KnowledgeBase />} />
            <Route path="/tutor/submissions/:submissionId" element={<SubmissionReview />} />
          </Route>
        </Routes>
      </UserProvider>
    </ConfigProvider>
  );
}

export default App;
