import type { ReactNode } from 'react';
import { Typography } from 'antd';
import './AuthLayout.css';

const { Title, Text } = Typography;

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      {/* LEFT PANEL — decorative navy */}
      <div className="auth-layout__left">
        {/* Decorative circles */}
        <div className="auth-layout__circle auth-layout__circle--lg" />
        <div className="auth-layout__circle auth-layout__circle--md" />
        <div className="auth-layout__circle auth-layout__circle--sm" />

        {/* Brand */}
        <div className="auth-layout__brand">
          <img
            src="/upb_logo.svg"
            alt="Universidad Privada Boliviana"
            className="auth-layout__upb-logo"
          />
          <Title level={1} className="auth-layout__brand-title">
            Thena
          </Title>
          <Text className="auth-layout__brand-subtitle">
            Sistema de Revisión de Tesis
          </Text>
          <Text className="auth-layout__brand-institution">
            Universidad Privada Boliviana
          </Text>
        </div>
      </div>

      {/* RIGHT PANEL — form area */}
      <div className="auth-layout__right">
        {/* Mobile logo — only visible on small screens */}
        <div className="auth-layout__mobile-logo">
          <img
            src="/upb_logo.svg"
            alt="Universidad Privada Boliviana"
            className="auth-layout__upb-logo--mobile"
          />
          <span className="auth-layout__mobile-brand">Thena</span>
        </div>

        <div className="auth-layout__content">{children}</div>
      </div>
    </div>
  );
}
