export interface Guest {
  id: string
  name: string
  party_size: number
  email?: string
  notes?: string
  created_at: string
}

export interface Scan {
  id: string
  guest_id: string
  scanned_at: string
  status: 'valid' | 'already_scanned' | 'invalid'
  guests?: Guest
}

export type ScanStatus = 'idle' | 'scanning' | 'valid' | 'already_scanned' | 'invalid'

export interface ScanResult {
  status: ScanStatus
  guest?: Guest
  scannedAt?: string
}
