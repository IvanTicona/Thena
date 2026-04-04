import { useEffect, useState } from 'react';
import { Form, Input, Button, Typography, Card, Alert, Select, Spin } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { thesisApi, usersApi, type CreateThesisDto } from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { TutorSummary } from '../../types';
import '../auth/auth.css';

const { Title, Text } = Typography;

interface OnboardingFormValues {
  title: string;
  tutorId?: string;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tutors, setTutors] = useState<TutorSummary[]>([]);
  const [loadingTutors, setLoadingTutors] = useState(true);
  const [form] = Form.useForm<OnboardingFormValues>();

  useEffect(() => {
    usersApi
      .getTutors()
      .then((res) => setTutors(res.data))
      .catch(() => {
        // Non-fatal: tutors list is optional
        setTutors([]);
      })
      .finally(() => setLoadingTutors(false));
  }, []);

  const handleSubmit = async (values: OnboardingFormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const dto: CreateThesisDto = {
        title: values.title.trim(),
        ...(values.tutorId ? { tutorId: values.tutorId } : {}),
      };
      await thesisApi.create(dto);
      // After thesis is created, go to student dashboard
      navigate('/chapters', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Ocurrió un error inesperado. Intentá de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const tutorOptions = tutors.map((t) => ({
    value: t.id,
    label: `${t.name} — ${t.email}`,
  }));

  return (
    <AuthLayout>
      <div className="auth-form-wrapper">
        {/* Heading — outside the card */}
        <div className="auth-form-heading">
          <Title level={2} className="auth-form-title">
            Configura tu Proyecto de Grado
          </Title>
          <Text className="auth-form-subtitle">
            Completa los datos para comenzar a trabajar en tu tesis
          </Text>
        </div>

        <Card className="auth-card">
          {errorMsg && (
            <Alert
              message={errorMsg}
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
              name="title"
              label="Título del Proyecto"
              rules={[
                { required: true, message: 'Ingresá el título de tu proyecto' },
                { min: 5, message: 'El título debe tener al menos 5 caracteres' },
              ]}
            >
              <Input
                prefix={<BookOutlined className="auth-input-icon" />}
                placeholder="Ej: Sistema de Gestión Hospitalaria..."
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="tutorId"
              label="Tutor (opcional)"
            >
              {loadingTutors ? (
                <Spin size="small" />
              ) : (
                <Select
                  size="large"
                  placeholder="Selecciona un tutor (opcional)"
                  options={tutorOptions}
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              )}
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={isSubmitting}
                className="auth-submit-btn"
              >
                {isSubmitting ? 'Creando...' : 'Crear Proyecto'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div className="auth-footer">
          <Text type="secondary">© 2026 Thena — Universidad Privada Boliviana</Text>
        </div>
      </div>
    </AuthLayout>
  );
}
