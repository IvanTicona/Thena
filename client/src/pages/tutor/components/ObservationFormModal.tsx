import { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, App } from 'antd';
import type { Observation } from '../../../types';
import { AGENT_LABELS } from '../../student/components/observation-config';
import { observationsApi } from '../../../services/api';
import { ApiError } from '../../../services/api-error';

const { TextArea } = Input;

interface ObservationFormValues {
  type?: string;
  severity: string;
  message: string;
  suggestion?: string;
  textFragment?: string;
}

interface ObservationFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reviewId: string;
  observation?: Observation;
}

const SEVERITY_OPTIONS = [
  { value: 'INFO', label: 'Info' },
  { value: 'SUGGESTION', label: 'Sugerencia' },
  { value: 'WARNING', label: 'Advertencia' },
  { value: 'ERROR', label: 'Error' },
];

const TYPE_OPTIONS = (Object.entries(AGENT_LABELS) as [string, string][]).map(
  ([value, label]) => ({ value, label }),
);

export default function ObservationFormModal({
  open,
  onClose,
  onSuccess,
  reviewId,
  observation,
}: ObservationFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ObservationFormValues>();
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isEditMode = !!observation;

  useEffect(() => {
    if (open) {
      if (isEditMode && observation) {
        form.setFieldsValue({
          severity: observation.severity,
          message: observation.message,
          suggestion: observation.suggestion ?? undefined,
          textFragment: observation.textFragment ?? undefined,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, isEditMode, observation, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);

      if (isEditMode && observation) {
        await observationsApi.update(observation.id, {
          severity: values.severity,
          message: values.message,
          suggestion: values.suggestion,
          textFragment: values.textFragment,
        });
        message.success('Observación actualizada');
      } else {
        await observationsApi.create({
          reviewId,
          type: values.type!,
          severity: values.severity,
          message: values.message,
          suggestion: values.suggestion,
          textFragment: values.textFragment,
        });
        message.success('Observación creada');
      }

      onSuccess();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // validation error
      message.error(
        err instanceof ApiError ? err.message : 'Error al guardar la observación',
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <Modal
      title={isEditMode ? 'Editar observación' : 'Agregar observación'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={confirmLoading}
      okText={isEditMode ? 'Guardar' : 'Agregar'}
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        {!isEditMode && (
          <Form.Item
            name="type"
            label="Tipo"
            rules={[{ required: true, message: 'El tipo es obligatorio' }]}
          >
            <Select placeholder="Seleccioná un tipo" options={TYPE_OPTIONS} />
          </Form.Item>
        )}

        <Form.Item
          name="severity"
          label="Severidad"
          rules={[{ required: true, message: 'La severidad es obligatoria' }]}
        >
          <Select placeholder="Seleccioná una severidad" options={SEVERITY_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="message"
          label="Mensaje"
          rules={[{ required: true, message: 'El mensaje es obligatorio' }]}
        >
          <TextArea rows={3} placeholder="Descripción de la observación" />
        </Form.Item>

        <Form.Item name="suggestion" label="Sugerencia">
          <TextArea rows={2} placeholder="Sugerencia de mejora (opcional)" />
        </Form.Item>

        <Form.Item name="textFragment" label="Fragmento citado">
          <TextArea rows={2} placeholder="Fragmento del documento relacionado (opcional)" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
