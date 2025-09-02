import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function getPositionColor(position: string): string {
  const colors: Record<string, string> = {
    QB: 'text-red-400',
    RB: 'text-green-400',
    WR: 'text-blue-400',
    TE: 'text-yellow-400',
    K: 'text-purple-400',
    DEF: 'text-orange-400',
    DB: 'text-indigo-400',
    DL: 'text-cyan-400',
    LB: 'text-pink-400',
  }
  return colors[position] || 'text-gray-400'
}