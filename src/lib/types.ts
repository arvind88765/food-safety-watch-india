export type Confidence = 'high' | 'medium' | 'low' | 'noise'

export interface Article {
  id: number
  title: string
  link: string
  published: string
  source: string
  district: string
  state: 'Telangana' | 'Andhra Pradesh'
  lat: number
  lon: number
  action_taken: string[]
  violations: string[]
  authority: string | null
  fine_amount: string | null
  confidence: Confidence
}
