type ChartSegment = { label: string; value: number; color: string };

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 168,
}: {
  segments: ChartSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="staff-donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#eef2f6" strokeWidth="12" />
        {total > 0
          ? segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const element = (
                <circle
                  key={segment.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="12"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  strokeLinecap="round"
                />
              );
              offset += length;
              return element;
            })
          : null}
      </svg>
      <div className="staff-donut-center">
        <strong>{centerValue}</strong>
        <small>{centerLabel}</small>
      </div>
    </div>
  );
}

export function BarChart({
  items,
}: {
  items: Array<{ label: string; value: number; color?: string }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="staff-bar-chart" aria-hidden="true">
      {items.map((item) => (
        <div className="staff-bar-row" key={item.label}>
          <span className="staff-bar-label">{item.label}</span>
          <span className="staff-bar-track">
            <span
              className="staff-bar-fill"
              style={{
                width: `${Math.round((item.value / max) * 100)}%`,
                background: item.color ?? 'var(--primary)',
              }}
            />
          </span>
          <span className="staff-bar-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({
  revenue,
  occupancy,
}: {
  revenue: number[];
  occupancy: number[];
}) {
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 34, left: 42 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxRevenue = Math.max(...revenue, 1);
  const points = revenue.map((value, index) => {
    const x = padding.left + (index / Math.max(revenue.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - (value / maxRevenue) * innerHeight;
    return `${x},${y}`;
  });
  const area = `${padding.left},${padding.top + innerHeight} ${points.join(' ')} ${padding.left + innerWidth},${padding.top + innerHeight}`;
  const occupancyPoints = occupancy.map((value, index) => {
    const x = padding.left + (index / Math.max(occupancy.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - (value / 100) * innerHeight;
    return `${x},${y}`;
  });
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  return (
    <svg className="staff-trend-chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {[0, 1, 2, 3].map((line) => {
        const y = padding.top + (line / 3) * innerHeight;
        return (
          <line
            key={line}
            x1={padding.left}
            x2={padding.left + innerWidth}
            y1={y}
            y2={y}
            stroke="#eef2f6"
          />
        );
      })}
      <polygon points={area} fill="rgba(5, 150, 105, 0.16)" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#059669"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={occupancyPoints.join(' ')}
        fill="none"
        stroke="#14b8a6"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {months.map((month, index) => {
        const x = padding.left + (index / Math.max(months.length - 1, 1)) * innerWidth;
        return (
          <text key={month} x={x} y={height - 10} textAnchor="middle" className="staff-chart-axis">
            {month}
          </text>
        );
      })}
    </svg>
  );
}
