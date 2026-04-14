'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '@/components/shared/ThemeProvider'

const monthlyData = [
  { month: '10월', amount: 218609 },
  { month: '11월', amount: 332413 },
  { month: '12월', amount: 519628 },
  { month: '1월',  amount: 108000 },
  { month: '2월',  amount: 208166 },
  { month: '3월',  amount: 76458  },
]

const CustomTooltip = ({ active, payload, label, isDark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: isDark ? 'rgba(10,10,10,0.95)' : 'rgba(255,255,255,0.97)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: '10px',
        padding: '8px 14px',
        fontSize: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: '4px' }}>{label}</p>
        <p style={{ color: '#FFC000', fontWeight: 700 }}>
          ₩{(payload[0].value * 1000).toLocaleString('ko-KR')}
        </p>
      </div>
    )
  }
  return null
}

export default function DashboardCharts() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // 테마별 색상
  const tickColor    = isDark ? 'rgba(255,255,255,0.65)' : '#6B7280'
  const gridColor    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'
  const axisColor    = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          월별 발주액 추이
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>최근 6개월 (단위: 천원)</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="month"
            tick={{ fill: tickColor, fontSize: 12, fontWeight: 500 }}
            axisLine={{ stroke: axisColor }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: tickColor, fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}M`}
          />
          <Tooltip content={<CustomTooltip isDark={isDark} />} />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#FFC000"
            strokeWidth={2.5}
            dot={{ fill: '#FFC000', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#FFD633', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
