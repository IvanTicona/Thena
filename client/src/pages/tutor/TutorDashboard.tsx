import { useEffect, useState, useCallback, useMemo } from 'react';
import { Typography, Spin, App, Empty, Input, Select } from 'antd';
import { thesisApi } from '../../services/api';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import { ThesisCard } from '../../components/ThesisCard';
import type { ThesisDocument, ChapterStatus } from '../../types';
import './TutorDashboard.css';

const { Title, Text } = Typography;

export default function TutorDashboard() {
  const [theses, setTheses] = useState<ThesisDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChapterStatus | 'ALL'>('ALL');
  const { modal, message } = App.useApp();

  const refetchTheses = useCallback(() => {
    setLoading(true);
    thesisApi
      .list()
      .then((res) => {
        // Server returns paginated { data: [...], meta: {...} } for tutors
        const payload = res.data;
        setTheses(Array.isArray(payload) ? payload : (payload as any).data ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) console.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetchTheses();
  }, [refetchTheses]);

  useEffect(() => { document.title = 'Panel del Tutor — Thena'; }, []);

  const filteredTheses = useMemo(() => {
    return theses.filter((thesis) => {
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchesStudent = thesis.student?.name?.toLowerCase().includes(q) ?? false;
        const matchesTitle = thesis.title.toLowerCase().includes(q);
        if (!matchesStudent && !matchesTitle) return false;
      }
      if (statusFilter !== 'ALL') {
        const hasStatus = thesis.chapters?.some((c) => c.status === statusFilter) ?? false;
        if (!hasStatus) return false;
      }
      return true;
    });
  }, [theses, searchText, statusFilter]);

  const handleApprove = (chapterId: string, chapterTitle: string) => {
    modal.confirm({
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
    modal.confirm({
      title: 'Rechazar capítulo',
      content: `¿Estás seguro de rechazar "${chapterTitle}"? El estudiante deberá subir una nueva versión.`,
      okText: 'Rechazar',
      okButtonProps: { danger: true },
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
      <Title level={3}>Panel del Tutor</Title>

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
        <>
          <div className="tutor-dashboard__filters">
            <Input.Search
              placeholder="Buscar por estudiante o título..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="tutor-dashboard__search"
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="tutor-dashboard__status-select"
              options={[
                { value: 'ALL', label: 'Todos los estados' },
                { value: 'IN_REVIEW', label: 'En revisión del tutor' },
                { value: 'DRAFT', label: 'Borrador' },
                { value: 'APPROVED', label: 'Aprobado' },
                { value: 'LOCKED', label: 'Bloqueado' },
              ]}
            />
          </div>

          {filteredTheses.length === 0 ? (
            <div className="tutor-dashboard__empty">
              <Empty description="No hay resultados para los filtros aplicados" />
            </div>
          ) : (
            filteredTheses.map((thesis) => (
              <ThesisCard
                key={thesis.id}
                thesis={thesis}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
