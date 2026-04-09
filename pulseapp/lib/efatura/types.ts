export type EFaturaStatus = 'pending' | 'sent' | 'approved' | 'rejected' | 'cancelled'

export interface ParasutContact {
  id: string
  name: string
  email?: string
  tax_number?: string
  tax_office?: string
}

export interface ParasutInvoiceItem {
  name: string
  quantity: number
  unit_price: number
  vat_rate: number  // 0, 1, 8, 18, 20
}

export interface ParasutCreateInvoiceParams {
  contact_id?: string
  contact_name?: string
  contact_tax_number?: string
  contact_tax_office?: string
  contact_address?: string
  issue_date: string  // YYYY-MM-DD
  invoice_number: string
  currency: string    // 'TRY'
  items: ParasutInvoiceItem[]
  notes?: string
}

export interface ParasutInvoiceResult {
  id: string
  net_total: number
  gross_total: number
  status: EFaturaStatus
  pdf_url?: string
}
