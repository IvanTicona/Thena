import { useEffect, useState, useCallback } from 'react';
import { Typography, Spin, Modal, message, Empty } from 'antd';
import { thesisApi } from '../../services/api';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import { ThesisCard } from '../../components/ThesisCard';
import type { ThesisDocument } from '../../types';
import './TutorDashboard.css';

const { Title, Text } = Typography;

export default function TutorDashboard() {
  const [theses, setTheses] = useState<ThesisDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const refetchTheses = useCallback(() => {
    setLoading(true);
    thesisApi
      .list()
      .then((res) => setTheses(res.data))
      .catch((err: unknown) => {
        if (err instanceof ApiError) console.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetchTheses();
  }, [refetchTheses]);

  useEffect(() => { document.title = 'Panel del Tutor — Thena'; }, []);

  const handleApprove = (chapterId: string, chapterTitle: string) => {
    Modal.confirm({
      title: 'Aprobar capítulo',
      content: `¿Estás seguro de aprobar "${chapterTitle}"? Esto desbloqueará el siguiente capítulo para el estudiante.`,
      okText: 'Aprobar',
      okType: 'primary',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.patch(`/chapters/${chapterId}/approve`);
          message.success('Capítulo aprobado');
          refetchTheses();
        } catch (err) {
          message.error(
            err instanceof ApiError ? err.message : 'Error al aprobar el capítulo',
          );
        }
      },
    });
  };

  const handleReject = (chapterId: string, chapterTitle: string) => {
    Modal.confirm({
      title: 'Rechazar capítulo',
      content: `¿Estás seguro de rechazar "${chapterTitle}"? El estudiante deberá subir una nueva versión.`,
      okText: 'Rechazar',
      okType: 'default',
      danger: true,
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.patch(`/chapters/${chapterId}/reject`);
          message.success('Capítulo rechazado');
          refetchTheses();
        } catch (err) {
          message.error(
            err instanceof ApiError ? err.message : 'Error al rechazar el capítulo',
          );
        }
      },
    });
  };

  return (
    <div>
      <Title level={3} className="font-academic">Panel del Tutor</Title>

      {loading ? (
        <div className="tutor-dashboard__loading">
          <Spin size="large" />
        </div>
      ) : theses.length === 0 ? (
        <div className="tutor-dashboard__empty">
          <Empty description="No tienes proyectos asignados todavía" />
          <Text type="secondary" className="tutor-dashboard__empty-hint">
            Los estudiantes aparecerán aquí cuando te seleccionen como tutor al crear su proyecto.
          </Text>
        </div>
      ) : (
        theses.map((thesis) => (
          <ThesisCard
            key={thesis.id}
            thesis={thesis}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))
      )}
    </div>
  );
}
