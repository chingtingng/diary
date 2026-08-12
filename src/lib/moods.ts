export type MoodId = 'great' | 'good' | 'okay' | 'low' | 'rough'

export interface Mood {
  id: MoodId
  label: string
  emoji: string
  color: string
  colorSoft: string
}

export const MOODS: Mood[] = [
  {
    id: 'great',
    label: 'Great',
    emoji: '😄',
    color: '#3d9a6a',
    colorSoft: '#dff5ea',
  },
  {
    id: 'good',
    label: 'Good',
    emoji: '🙂',
    color: '#4f8fd9',
    colorSoft: '#e3effc',
  },
  {
    id: 'okay',
    label: 'Okay',
    emoji: '😐',
    color: '#8b8f98',
    colorSoft: '#eceef1',
  },
  {
    id: 'low',
    label: 'Low',
    emoji: '😕',
    color: '#d4894a',
    colorSoft: '#f8eadb',
  },
  {
    id: 'rough',
    label: 'Rough',
    emoji: '😢',
    color: '#c45c5c',
    colorSoft: '#f8e3e3',
  },
]

export function getMood(id: MoodId | null | undefined): Mood | null {
  if (!id) return null
  return MOODS.find((m) => m.id === id) ?? null
}
