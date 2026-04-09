/**
 * Paraşüt API istemcisi (e-Fatura entegrasyonu)
 *
 * Aktif etmek için gerekli env değişkenleri:
 *   PARASUT_CLIENT_ID
 *   PARASUT_CLIENT_SECRET
 *   PARASUT_USERNAME      (Paraşüt kullanıcı e-postası)
 *   PARASUT_PASSWORD      (Paraşüt şifresi)
 *   PARASUT_COMPANY_ID    (İşletme ID — Paraşüt panelinden)
 *
 * https://apidocs.parasut.com
 */
import type { ParasutCreateInvoiceParams, ParasutInvoiceResult } from './types'

const PARASUT_API_BASE = 'https://api.parasut.com/v4'

let _accessToken: string | null = null
let _tokenExpiry: number = 0

async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken

  const clientId = process.env.PARASUT_CLIENT_ID
  const clientSecret = process.env.PARASUT_CLIENT_SECRET
  const username = process.env.PARASUT_USERNAME
  const password = process.env.PARASUT_PASSWORD

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Paraşüt env değişkenleri eksik: PARASUT_CLIENT_ID, PARASUT_CLIENT_SECRET, PARASUT_USERNAME, PARASUT_PASSWORD')
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
    redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
  })

  const res = await fetch('https://api.parasut.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Paraşüt OAuth hatası: ${err}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _accessToken = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return _accessToken
}

function companyUrl(path: string): string {
  const companyId = process.env.PARASUT_COMPANY_ID
  if (!companyId) throw new Error('PARASUT_COMPANY_ID env değişkeni eksik')
  return `${PARASUT_API_BASE}/${companyId}${path}`
}

async function parasutFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  return fetch(companyUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      ...(options.headers || {}),
    },
  })
}

/**
 * Fatura oluştur (satış faturası)
 */
export async function createSalesInvoice(params: ParasutCreateInvoiceParams): Promise<ParasutInvoiceResult> {
  const lines = params.items.map(item => ({
    type: 'sales_invoice_lines',
    attributes: {
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      discount_type: 'amount',
      discount_value: 0,
    },
  }))

  // Eğer müşteri ID yoksa, kontak oluştur ya da mevcut kontak kullan
  let contactData: { type: string; id?: string; attributes?: Record<string, unknown> }
  if (params.contact_id) {
    contactData = { type: 'contacts', id: params.contact_id }
  } else {
    // Geçici/anonim kontak oluştur
    const newContact = await createOrFindContact({
      name: params.contact_name || 'Bilinmeyen Müşteri',
      tax_number: params.contact_tax_number,
      tax_office: params.contact_tax_office,
    })
    contactData = { type: 'contacts', id: newContact }
  }

  const payload = {
    data: {
      type: 'sales_invoices',
      attributes: {
        item_type: 'invoice',
        description: params.notes || '',
        issue_date: params.issue_date,
        due_date: params.issue_date,
        invoice_series: 'PLS',
        invoice_id: parseInt(params.invoice_number.replace(/\D/g, '') || '1'),
        currency: params.currency || 'TRY',
        exchange_rate: 1,
        withholding_rate: 0,
        vat_withholding_rate: 0,
        invoice_discount_type: 'amount',
        invoice_discount: 0,
        payment_account_type: 'cash',
        is_abroad: false,
      },
      relationships: {
        contact: { data: contactData },
        details: { data: lines },
      },
    },
  }

  const res = await parasutFetch('/sales_invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Paraşüt fatura oluşturma hatası: ${err}`)
  }

  const data = await res.json()
  const attrs = data.data.attributes

  return {
    id: data.data.id,
    net_total: parseFloat(attrs.net_total || 0),
    gross_total: parseFloat(attrs.gross_total || 0),
    status: 'sent',
  }
}

/**
 * Fatura PDF URL'ini al
 */
export async function getInvoicePdf(invoiceId: string): Promise<string | null> {
  const res = await parasutFetch(`/sales_invoices/${invoiceId}/print_pdf`)
  if (!res.ok) return null
  const data = await res.json()
  return data?.data?.url || null
}

/**
 * Fatura iptal et
 */
export async function cancelInvoice(invoiceId: string): Promise<void> {
  const res = await parasutFetch(`/sales_invoices/${invoiceId}/cancel`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Paraşüt fatura iptal hatası: ${err}`)
  }
}

/**
 * Kontağı bul veya oluştur
 */
async function createOrFindContact(params: { name: string; tax_number?: string; tax_office?: string }): Promise<string> {
  if (params.tax_number) {
    // Vergi numarasına göre ara
    const res = await parasutFetch(`/contacts?filter[tax_number]=${params.tax_number}`)
    if (res.ok) {
      const data = await res.json()
      if (data.data?.length > 0) return data.data[0].id
    }
  }

  // Yeni kontak oluştur
  const payload = {
    data: {
      type: 'contacts',
      attributes: {
        contact_type: 'person',
        name: params.name,
        tax_number: params.tax_number || null,
        tax_office: params.tax_office || null,
        account_type: 'customer',
      },
    },
  }

  const res = await parasutFetch('/contacts', { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Paraşüt kontak oluşturma hatası')
  const data = await res.json()
  return data.data.id
}

export function isParasutConfigured(): boolean {
  return !!(
    process.env.PARASUT_CLIENT_ID &&
    process.env.PARASUT_CLIENT_SECRET &&
    process.env.PARASUT_USERNAME &&
    process.env.PARASUT_PASSWORD &&
    process.env.PARASUT_COMPANY_ID
  )
}
