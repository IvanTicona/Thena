import { Card } from 'antd';
import './StatCard.css';

interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color?: string;
}

/**
 * Reusable stat card — icon + large value + small label.
 * Used in StudentDashboard, HistoryPage, etc.
 */
export function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <Card className="stat-card" size="small">
      <div className="stat-card__inner">
        {icon && (
          <div className="stat-card__icon" style={color ? { color } : undefined}>
            {icon}
          </div>
        )}
        <div>
          <div className="stat-card__value">{value}</div>
          <div className="stat-card__label">{label}</div>
        </div>
      </div>
    </Card>
  );
}
