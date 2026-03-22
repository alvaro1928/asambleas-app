'use client'

import type { ReactNode } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

export interface BarChartData {
  name: string
  fullName: string
  porcentaje: number
  /** Unidades que votaron esta opción (una fila de voto por unidad). */
  votosCantidad: number
  /** Suma del coeficiente de esas unidades (% del conjunto). */
  coeficienteSum?: number
  color: string
  aprueba: boolean
}

interface VotacionBarChartProps {
  data: BarChartData[]
  umbral: number
  tipoVotacion: string
  variant: 'panel' | 'proyector'
  esMobile?: boolean
}

export default function VotacionBarChart({
  data,
  umbral,
  tipoVotacion,
  variant,
  esMobile = false,
}: VotacionBarChartProps) {
  const hayAprobados = data.some((d) => d.aprueba)

  if (variant === 'proyector') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 16, right: 120, left: 140, bottom: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 18, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 18, fill: '#94a3b8' }} />
          <Tooltip
            formatter={(value: number | undefined, _n?: string, props?: unknown) => {
              const payload = (props as { payload?: { votosCantidad?: number; coeficienteSum?: number } })?.payload
              const unidades = payload?.votosCantidad ?? 0
              const sumCoef = payload?.coeficienteSum
              const labelTipo = tipoVotacion === 'nominal' ? 'Sobre unidades del conjunto' : 'Sobre coeficiente total (Ley 675)'
              const detalleUnidades = `${unidades} ${unidades !== 1 ? 'unidades' : 'unidad'}`
              const detalleCoef =
                sumCoef != null && Number.isFinite(sumCoef)
                  ? ` · Σ coef. ${Number(sumCoef).toFixed(2)}%`
                  : ''
              return [`${value ?? 0}% — ${detalleUnidades}${detalleCoef}`, labelTipo]
            }}
            labelFormatter={(_: ReactNode, payload: readonly { payload?: { fullName?: string } }[]) =>
              payload?.[0]?.payload?.fullName ?? ''
            }
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              color: '#e2e8f0',
            }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <ReferenceLine
            x={umbral}
            stroke={hayAprobados ? '#10b981' : '#f59e0b'}
            strokeWidth={2}
            strokeDasharray="4 2"
            label={{
              value: `Mayoría necesaria (${umbral}%)`,
              position: 'insideTopRight',
              fill: '#94a3b8',
              fontSize: 14,
            }}
          />
          <Bar
            dataKey="porcentaje"
            radius={[0, 8, 8, 0]}
            maxBarSize={56}
            label={{
              position: 'right',
              formatter: (value: unknown) => {
                const v = Number(value ?? 0)
                const payload = data.find((d) => Math.abs(d.porcentaje - v) < 0.01) ?? data[0]
                const aprueba = payload?.aprueba ?? false
                if (aprueba) return `${v}% MAYORÍA ALCANZADA`
                return `${v}%`
              },
              fontSize: 18,
              fill: '#e2e8f0',
            }}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name + index}
                fill={entry.aprueba ? '#10b981' : entry.color}
                stroke={entry.aprueba ? '#059669' : undefined}
                strokeWidth={entry.aprueba ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // variant === 'panel'
  const margenes = esMobile
    ? { top: 8, right: 40, left: 50, bottom: 8 }
    : { top: 12, right: 90, left: 100, bottom: 12 }
  const yAxisWidth = esMobile ? 48 : 95
  const barLabelFontSize = esMobile ? 9 : 12

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={280}>
      <BarChart layout="vertical" data={data} margin={margenes}>
        <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: esMobile ? 10 : 12, fill: '#94a3b8' }} />
        <YAxis
          type="category"
          dataKey="name"
          width={yAxisWidth}
          tick={{ fontSize: esMobile ? 11 : 13, fill: '#94a3b8' }}
        />
        <Tooltip
          formatter={(value: number | undefined, _name?: string, props?: unknown) => {
            const payload = (props as { payload?: { votosCantidad?: number; coeficienteSum?: number } })?.payload
            const unidades = payload?.votosCantidad ?? 0
            const sumCoef = payload?.coeficienteSum
            const labelTipo = tipoVotacion === 'nominal' ? 'Sobre unidades del conjunto' : 'Sobre coeficiente total (Ley 675)'
            const detalleUnidades = `${unidades} ${unidades !== 1 ? 'unidades' : 'unidad'}`
            const detalleCoef =
              sumCoef != null && Number.isFinite(sumCoef)
                ? ` · Σ coef. ${Number(sumCoef).toFixed(2)}%`
                : ''
            return [`${value ?? 0}% — ${detalleUnidades}${detalleCoef}`, labelTipo]
          }}
          labelFormatter={(_: ReactNode, payload: readonly { payload?: { fullName?: string } }[]) =>
            payload?.[0]?.payload?.fullName ?? ''
          }
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            color: '#e2e8f0',
          }}
          labelStyle={{ color: '#f1f5f9' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <ReferenceLine
          x={umbral}
          stroke={hayAprobados ? '#10b981' : '#f59e0b'}
          strokeWidth={2}
          strokeDasharray="4 2"
          label={{
            value: `Mayoría necesaria (${umbral}%)`,
            position: 'insideTopRight',
            fill: '#94a3b8',
            fontSize: 11,
          }}
        />
        <Bar
          dataKey="porcentaje"
          radius={[0, 6, 6, 0]}
          maxBarSize={esMobile ? 28 : 40}
          label={{
            position: 'right',
            formatter: (value: unknown) => {
              const v = Number(value ?? 0)
              const payload = data.find((d) => Math.abs(d.porcentaje - v) < 0.01) ?? data[0]
              const aprueba = payload?.aprueba ?? false
              if (aprueba) return esMobile ? `${v}% ✓` : `${v}% MAYORÍA ALCANZADA`
              return `${v}%`
            },
            fontSize: barLabelFontSize,
            fill: '#e2e8f0',
          }}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.name + index}
              fill={entry.aprueba ? '#10b981' : entry.color}
              stroke={entry.aprueba ? '#059669' : undefined}
              strokeWidth={entry.aprueba ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
