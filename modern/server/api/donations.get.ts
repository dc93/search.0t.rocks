import { readFileSync } from 'fs'
import { resolve } from 'path'

interface Donation {
  name: string
  amount: number
  message?: string
}

let donationsCache: Donation[] | null = null

export default defineEventHandler(() => {
  if (!donationsCache) {
    try {
      const filePath = resolve(process.cwd(), 'data/donations.json')
      donationsCache = JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      donationsCache = []
    }
  }
  return [...donationsCache!].sort((a, b) => b.amount - a.amount)
})
