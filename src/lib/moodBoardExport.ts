import { format } from 'date-fns'
import { MOODS, getMood } from './moods'
import type { Entry } from '../types/entry'

function dayKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

/** Pick the day's display mood: first entry that has a mood, else none. */
export function moodByDay(entries: Entry[]): Map<string, string> {
  const map = new Map<string, string>()
  const grouped = new Map<string, Entry[]>()

  for (const entry of entries) {
    const key = dayKey(new Date(entry.createdAt))
    const list = grouped.get(key) ?? []
    list.push(entry)
    grouped.set(key, list)
  }

  for (const [key, list] of grouped) {
    const withMood = list.find((e) => e.mood)
    if (withMood?.mood) {
      const mood = getMood(withMood.mood)
      if (mood) map.set(key, mood.color)
    }
  }

  return map
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Render a year mood board (12 × 31 coloured squares) to a PNG and download it.
 */
export async function exportYearMoodBoardPng(entries: Entry[], year: number): Promise<void> {
  const colors = moodByDay(entries)
  const dpr = 2
  const pad = 48
  const labelW = 56
  const cell = 18
  const gap = 4
  const headerH = 72
  const legendH = 56
  const cols = 31
  const rows = 12

  const width = pad * 2 + labelW + cols * cell + (cols - 1) * gap
  const height = pad * 2 + headerH + rows * cell + (rows - 1) * gap + legendH + 24

  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas')

  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#eef3f7'
  ctx.fillRect(0, 0, width, height)

  // soft panel
  const panelX = pad - 16
  const panelY = pad - 16
  const panelW = width - (pad - 16) * 2
  const panelH = height - (pad - 16) * 2
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, panelX, panelY, panelW, panelH, 24)
  ctx.fill()

  ctx.fillStyle = '#1c2430'
  ctx.font = '600 28px Fraunces, Georgia, serif'
  ctx.fillText(`${year} mood board`, pad, pad + 28)

  ctx.fillStyle = '#5c6675'
  ctx.font = '500 13px Manrope, system-ui, sans-serif'
  const daysWithMood = [...colors.keys()].filter((k) => k.startsWith(`${year}-`)).length
  ctx.fillText(`${daysWithMood} days with a mood · My Diary`, pad, pad + 52)

  const gridTop = pad + headerH
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  // day number header
  ctx.fillStyle = '#5c6675'
  ctx.font = '600 10px Manrope, system-ui, sans-serif'
  ctx.textAlign = 'center'
  for (let d = 1; d <= 31; d++) {
    if (d === 1 || d % 5 === 0 || d === 31) {
      const x = pad + labelW + (d - 1) * (cell + gap) + cell / 2
      ctx.fillText(String(d), x, gridTop - 10)
    }
  }
  ctx.textAlign = 'left'

  for (let m = 0; m < 12; m++) {
    const y = gridTop + m * (cell + gap)
    ctx.fillStyle = '#5c6675'
    ctx.font = '600 12px Manrope, system-ui, sans-serif'
    ctx.fillText(monthNames[m], pad, y + cell * 0.72)

    const daysInMonth = new Date(year, m + 1, 0).getDate()
    for (let d = 1; d <= 31; d++) {
      const x = pad + labelW + (d - 1) * (cell + gap)
      if (d > daysInMonth) {
        ctx.fillStyle = 'transparent'
        continue
      }
      const key = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const color = colors.get(key)
      ctx.fillStyle = color ?? '#e8edf2'
      roundRect(ctx, x, y, cell, cell, 4)
      ctx.fill()
    }
  }

  // legend
  const legendY = gridTop + rows * (cell + gap) + 20
  ctx.font = '600 11px Manrope, system-ui, sans-serif'
  let lx = pad
  for (const mood of MOODS) {
    roundRect(ctx, lx, legendY, 12, 12, 3)
    ctx.fillStyle = mood.color
    ctx.fill()
    ctx.fillStyle = '#5c6675'
    ctx.fillText(mood.label, lx + 16, legendY + 10)
    lx += 16 + ctx.measureText(mood.label).width + 18
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })

  downloadBlob(blob, `mood-board-${year}.png`)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
