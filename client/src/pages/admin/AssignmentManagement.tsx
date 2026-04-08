import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Table,
  Button,
  Space,
  Popconfirm,
  Modal,
  Form,
  Select,
  message,
  Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  adminUsersApi,
  adminAssignmentsApi,
  type Assignment,
  type AdminUser,
  type CreateAssignmentDto,
} from '../../services/api';
import { formatDate } from '../../utils/format';
import './AssignmentManagement.css';

const { Title } = Typography;
const { Option } = Select;

interface AssignmentFormValues {
  studentId: string;
  tutorId: string;
  reviewerId?: string;
}

export default function AssignmentManagement() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // User lists for selects
  const [students, setStudents] = useState<AdminUser[]>([]);
  const [tutors, setTutors] = useState<AdminUser[]>([]);
  const [reviewers, setReviewers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [form] = Form.useForm<AssignmentFormValues>();

  const PAGE_SIZE = 10;

  const fetchAssignments = useCallback(
    (p = page) => {
      setLoading(true);
      adminAssignmentsApi
        .list({ page: p, limit: PAGE_SIZE })
        .then((res) => {
          setAssignments(res.data.data);
          setTotal(res.data.meta.total);
        })
        .catch(() => message.error('Error al cargar las asignaciones'))
        .finally(() => setLoading(false));
    },
    [page],
  );

  useEffect(() => {
    document.title = 'Asignaciones — Thena';
    fetchAssignments();
  }, [fetchAssignments]);

  const loadUsersForModal = async () => {
    setLoadingUsers(true);
    try {
      const [studentsRes, tutorsRes, reviewersRes] = await Promise.all([
        adminUsersApi.list({ role: 'STUDENT', limit: 100 }),
        adminUsersApi.list({ role: 'TUTOR', limit: 100 }),
        adminUsersApi.list({ role: 'TUTOR', limit: 100 }),
      ]);
      setStudents(studentsRes.data.data);
      setTutors(tutorsRes.data.data);
      setReviewers(reviewersRes.data.data);
    } catch {
      message.error('Error al cargar usuarios');
    } finally {
      setLoadingUsers(false);
    }
  };

  const openCreateModal = () => {
    form.resetFields();
    setModalOpen(true);
    loadUsersForModal();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const dto: CreateAssignmentDto = {
        studentId: values.studentId,
        tutorId: values.tutorId,
        ...(values.reviewerId ? { reviewerId: values.reviewerId } : {}),
      };

      await adminAssignmentsApi.create(dto);
      message.success('Asignación creada correctamente');
      setModalOpen(false);
      fetchAssignments();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Error al crear la asignación');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminAssignmentsApi.delete(id);
      message.success('Asignación eliminada correctamente');
      fetchAssignments();
    } catch {
      message.error('Error al eliminar la asignación');
    }
  };

  const columns: ColumnsType<Assignment> = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_, record) =>
        record.student ? (
          <div>
            <div>{record.student.name}</div>
            <div className="assignment-management__email">
              {record.student.email}
            </div>
          </div>
        ) : (
          <Tag color="default">—</Tag>
        ),
    },
    {
      title: 'Tutor',
      key: 'tutor',
      render: (_, record) =>
        record.tutor ? (
          <div>
            <div>{record.tutor.name}</div>
            <div className="assignment-management__email">
              {record.tutor.email}
            </div>
          </div>
        ) : (
          <Tag color="default">—</Tag>
        ),
    },
    {
      title: 'Revisor',
      key: 'reviewer',
      render: (_, record) =>
        record.reviewer ? (
          <div>
            <div>{record.reviewer.name}</div>
            <div className="assignment-management__email">
              {record.reviewer.email}
            </div>
          </div>
        ) : (
          <Tag color="default">Sin revisor</Tag>
        ),
    },
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => formatDate(d),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="¿Estás seguro?"
            description="Esta acción eliminará la asignación permanentemente."
            onConfirm={() => handleDelete(record.id)}
            okText="Eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} size="small">
              Eliminar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="assignment-management">
      <div className="assignment-management__header">
        <Title level={3}>Asignaciones</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Nueva Asignación
        </Button>
      </div>

      <Table<Assignment>
        dataSource={assignments}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          onChange: (p) => {
            setPage(p);
            fetchAssignments(p);
          },
          showTotal: (t) => `${t} asignaciones en total`,
        }}
      />

      <Modal
        title="Nueva Asignación"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText="Crear Asignación"
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="assignment-management__form">
          <Form.Item
            name="studentId"
            label="Estudiante"
            rules={[{ required: true, message: 'Seleccioná un estudiante' }]}
          >
            <Select
              showSearch
              placeholder="Buscar estudiante"
              loading={loadingUsers}
              optionFilterProp="label"
              options={students.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.email})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="tutorId"
            label="Tutor"
            rules={[{ required: true, message: 'Seleccioná un tutor' }]}
          >
            <Select
              showSearch
              placeholder="Buscar tutor"
              loading={loadingUsers}
              optionFilterProp="label"
              options={tutors.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.email})`,
              }))}
            />
          </Form.Item>

          <Form.Item name="reviewerId" label="Revisor (opcional)">
            <Select
              showSearch
              allowClear
              placeholder="Buscar revisor (opcional)"
              loading={loadingUsers}
              optionFilterProp="label"
              options={reviewers.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.email})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
