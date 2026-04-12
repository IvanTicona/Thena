import { useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { usersApi } from '../../services/api';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const handleOk = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      await usersApi.changePassword(values.currentPassword, values.newPassword);
      message.success('Contraseña actualizada correctamente');
      form.resetFields();
      onClose();
    } catch {
      message.error('La contraseña actual es incorrecta');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Cambiar contraseña"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={loading}
      destroyOnHide
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="currentPassword"
          label="Contraseña actual"
          rules={[{ required: true, message: 'Ingresá tu contraseña actual' }]}
        >
          <Input.Password placeholder="Contraseña actual" />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="Nueva contraseña"
          rules={[
            { required: true, message: 'Ingresá la nueva contraseña' },
            { min: 8, message: 'Mínimo 8 caracteres' },
          ]}
        >
          <Input.Password placeholder="Nueva contraseña" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirmar contraseña"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Confirmá la nueva contraseña' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Las contraseñas no coinciden'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="Repetí la nueva contraseña" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
