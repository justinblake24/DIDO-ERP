// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { POStatus } from '@prisma/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatJPY(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n)
}

export function formatCurrency(amount: number, currency: string): string {
  switch (currency) {
    case 'KRW': return formatKRW(amount)
    case 'JPY': return formatJPY(amount)
    case 'USD': return formatUSD(amount)
    default: return `${formatNumber(amount)} ${currency}`
  }
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: '작성중',
  ISSUED: '발주완료',
  PAID: '결제완료',
  SHIPPED: '선적완료',
  INVOICED: '청구완료',
  COMPLETED: '입금완료',
  CANCELLED: '취소',
}

export const STATUS_FLOW: POStatus[] = [
  'DRAFT', 'ISSUED', 'PAID', 'SHIPPED', 'INVOICED', 'COMPLETED',
]

export function getStatusProgress(status: POStatus): number {
  if (status === 'CANCELLED') return 0
  const idx = STATUS_FLOW.indexOf(status)
  return ((idx) / (STATUS_FLOW.length - 1)) * 100
}

export function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    KR: '🇰🇷',
    CN: '🇨🇳',
    JP: '🇯🇵',
    US: '🇺🇸',
  }
  return flags[country] || '🌐'
}
