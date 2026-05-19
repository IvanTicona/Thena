import { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Card, Alert } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useAuth } from '../../contexts/useAuth';
import { ApiError } from '../../services/api-error';
import './auth.css';

const { Title, Text } = Typography;

interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form] = Form.useForm<RegisterFormValues>();

  useEffect(() => { document.title = 'Crear Cuenta — Thena'; }, []);

  const handleSubmit = async (values: RegisterFormValues) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await register(values.name, values.email, values.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Ocurrió un error inesperado. Intentá de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form-wrapper">
        {/* Heading — outside the card */}
        <div className="auth-form-heading">
          <Title level={2} className="auth-form-title">
            Crear Cuenta
          </Title>
          <Text className="auth-form-subtitle">
            Completá tus datos para comenzar
          </Text>
        </div>

        <Card className="auth-card" variant="borderless">
          {errorMsg && (
            <Alert
              title={errorMsg}
              type="error"
              showIcon
              closable
              onClose={() => setErrorMsg(null)}
              style={{ marginBottom: 20 }}
            />
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
            autoComplete="off"
          >
            <Form.Item
              name="name"
              label="Nombre completo"
              rules={[
                { required: true, message: 'Ingresá tu nombre completo' },
                { min: 2, message: 'El nombre debe tener al menos 2 caracteres' },
              ]}
            >
              <Input
                prefix={<UserOutlined className="auth-input-icon" />}
                placeholder="Juan Pérez"
                size="large"
                autoComplete="name"
              />
            </Form.Item>

            <Form.Item
              name="email"
              label="Dirección de correo electrónico"
              rules={[
                { required: true, message: 'Ingresá tu correo electrónico' },
                { type: 'email', message: 'Ingresá un correo electrónico válido' },
              ]}
            >
              <Input
                prefix={<MailOutlined className="auth-input-icon" />}
                placeholder="correo@upb.edu"
                size="large"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Contraseña"
              rules={[
                { required: true, message: 'Ingresá una contraseña' },
                { min: 8, message: 'La contraseña debe tener al menos 8 caracteres' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="auth-input-icon" />}
                placeholder="Mínimo 8 caracteres"
                size="large"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Confirmar contraseña"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Confirmá tu contraseña' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('Las contraseñas no coinciden'),
                    );
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="auth-input-icon" />}
                placeholder="Repetí tu contraseña"
                size="large"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={isLoading}
                className="auth-submit-btn"
              >
                {isLoading ? 'Registrando...' : 'Crear Cuenta'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div className="auth-alt-link">
          <Text>¿Ya tenés cuenta?</Text>{' '}
          <Link to="/login">Iniciá sesión</Link>
        </div>

        <div className="auth-footer">
          <Text type="secondary">© 2026 Thena — Universidad Privada Boliviana</Text>
        </div>
      </div>
    </AuthLayout>
  );
}
