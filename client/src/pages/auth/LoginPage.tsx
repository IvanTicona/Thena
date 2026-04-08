import { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Card, Alert } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useAuth } from '../../contexts/useAuth';
import { ApiError } from '../../services/api-error';
import './auth.css';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form] = Form.useForm<LoginFormValues>();

  useEffect(() => { document.title = 'Iniciar Sesión — Thena'; }, []);

  const handleSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await login(values.email, values.password);
      // Redirect to home — App.tsx will route based on role
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
            Bienvenido
          </Title>
          <Text className="auth-form-subtitle">Ingresá a tu cuenta</Text>
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
              rules={[{ required: true, message: 'Ingresá tu contraseña' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="auth-input-icon" />}
                placeholder="Tu contraseña"
                size="large"
                autoComplete="current-password"
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
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div className="auth-alt-link">
          <Text>¿No tenés cuenta?</Text>{' '}
          <Link to="/register">Regístrate</Link>
        </div>

        <div className="auth-footer">
          <Text type="secondary">© 2026 Thena — Universidad Privada Boliviana</Text>
        </div>
      </div>
    </AuthLayout>
  );
}
