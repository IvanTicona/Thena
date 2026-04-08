import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  adminUsersApi,
  type AdminUser,
  type CreateUserDto,
  type UpdateUserDto,
} from '../../services/api';
import type { UserRole } from '../../types';
import { formatDate } from '../../utils/format';
import './UserManagement.css';

const { Title } = Typography;
const { Option } = Select;

const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'Estudiante',
  TUTOR: 'Tutor',
  REVIEWER: 'Revisor',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Administrador',
};

const ROLE_COLORS: Record<UserRole, string> = {
  STUDENT: 'blue',
  TUTOR: 'green',
  REVIEWER: 'purple',
  ADMIN: 'orange',
  SUPER_ADMIN: 'red',
};

type ModalMode = 'create' | 'edit';

interface UserFormValues {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
}

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm<UserFormValues>();

  const PAGE_SIZE = 10;

  const fetchUsers = useCallback(
    (p = page, role = roleFilter) => {
      setLoading(true);
      adminUsersApi
        .list({ page: p, limit: PAGE_SIZE, role })
        .then((res) => {
          setUsers(res.data.data);
          setTotal(res.data.meta.total);
        })
        .catch(() => message.error('Error al cargar los usuarios'))
        .finally(() => setLoading(false));
    },
    [page, roleFilter],
  );

  useEffect(() => {
    document.title = 'Gestión de Usuarios — Thena';
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setModalMode('edit');
    setSelectedUser(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (modalMode === 'create') {
        await adminUsersApi.create(values as CreateUserDto);
        message.success('Usuario creado correctamente');
      } else if (selectedUser) {
        const updateData: UpdateUserDto = {
          name: values.name,
          email: values.email,
          role: values.role,
        };
        await adminUsersApi.update(selectedUser.id, updateData);
        message.success('Usuario actualizado correctamente');
      }

      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // validation error
      message.error('Error al guardar el usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminUsersApi.delete(id);
      message.success('Usuario eliminado correctamente');
      fetchUsers();
    } catch {
      message.error('Error al eliminar el usuario');
    }
  };

  const handleRoleFilterChange = (value: UserRole | undefined) => {
    setRoleFilter(value);
    setPage(1);
    fetchUsers(1, value);
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => (
        <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: 'Fecha de creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => formatDate(d),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEditModal(record)}
          >
            Editar
          </Button>
          <Popconfirm
            title="¿Estás seguro?"
            description="Esta acción eliminará el usuario permanentemente."
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
    <div className="user-management">
      <div className="user-management__header">
        <Title level={3}>Gestión de Usuarios</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Crear Usuario
        </Button>
      </div>

      <div className="user-management__filters">
        <Select<UserRole | undefined>
          allowClear
          placeholder="Filtrar por rol"
          style={{ width: 220 }}
          value={roleFilter}
          onChange={handleRoleFilterChange}
        >
          <Option value="STUDENT">Estudiante</Option>
          <Option value="TUTOR">Tutor</Option>
          <Option value="REVIEWER">Revisor</Option>
          <Option value="ADMIN">Administrador</Option>
          <Option value="SUPER_ADMIN">Super Administrador</Option>
        </Select>
      </div>

      <Table<AdminUser>
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          onChange: (p) => {
            setPage(p);
            fetchUsers(p);
          },
          showTotal: (t) => `${t} usuarios en total`,
        }}
      />

      <Modal
        title={modalMode === 'create' ? 'Crear Usuario' : 'Editar Usuario'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={modalMode === 'create' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="user-management__form">
          <Form.Item
            name="name"
            label="Nombre completo"
            rules={[{ required: true, message: 'El nombre es obligatorio' }]}
          >
            <Input placeholder="Ej: Juan Pérez" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'El email es obligatorio' },
              { type: 'email', message: 'Ingresá un email válido' },
            ]}
          >
            <Input placeholder="usuario@upb.edu.bo" />
          </Form.Item>
          {modalMode === 'create' && (
            <Form.Item
              name="password"
              label="Contraseña"
              rules={[
                { required: true, message: 'La contraseña es obligatoria' },
                { min: 8, message: 'Mínimo 8 caracteres' },
              ]}
            >
              <Input.Password placeholder="Mínimo 8 caracteres" />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label="Rol"
            rules={[{ required: true, message: 'El rol es obligatorio' }]}
          >
            <Select placeholder="Seleccioná un rol">
              <Option value="STUDENT">Estudiante</Option>
              <Option value="TUTOR">Tutor</Option>
              <Option value="REVIEWER">Revisor</Option>
              <Option value="ADMIN">Administrador</Option>
              <Option value="SUPER_ADMIN">Super Administrador</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
