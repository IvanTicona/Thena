import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <ConfigProvider locale={esES}>
      <UserProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/chapters" replace />} />
            <Route
              path="/chapters"
              element={<div>Capitulos (pendiente)</div>}
            />
            <Route
              path="/chapters/:id"
              element={<div>Detalle de Capitulo (pendiente)</div>}
            />
            <Route
              path="/chapters/:id/review/:jobId"
              element={<div>Vista de Revision (pendiente)</div>}
            />
            <Route
              path="/tutor"
              element={<div>Panel del Tutor (pendiente)</div>}
            />
            <Route
              path="/tutor/knowledge"
              element={<div>Base de Conocimiento (pendiente)</div>}
            />
          </Route>
        </Routes>
      </UserProvider>
    </ConfigProvider>
  );
}

export default App;
