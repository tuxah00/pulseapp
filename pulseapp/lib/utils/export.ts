// ============================================
// PulseApp — CSV & PDF Export Utilities
// ============================================

export interface ExportColumn {
  key: string
  label: string
}

/**
 * CSV export — UTF-8 BOM prefix for Turkish character support in Excel
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExportColumn[]
): void {
  if (!data || data.length === 0) return

  const header = columns.map(col => `"${col.label}"`).join(',')
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col.key]
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }).join(',')
  )

  // UTF-8 BOM (\uFEFF) → Excel Türkçe karakter desteği
  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Fatura PDF — window.print() ile özel print CSS şablonu
 */
export function printInvoicePDF(params: {
  invoiceNumber: string
  businessName: string
  customerName?: string
  customerPhone?: string
  items: { service_name: string; quantity: number; unit_price: number; total: number }[]
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  status: string
  paymentMethod?: string | null
  createdAt: string
  dueDate?: string | null
  notes?: string | null
}): void {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const statusLabels: Record<string, string> = {
    pending: 'Bekliyor',
    paid: 'Ödendi',
    partial: 'Kısmi Ödeme',
    overdue: 'Vadesi Geçmiş',
    cancelled: 'İptal',
  }

  const paymentLabels: Record<string, string> = {
    cash: 'Nakit',
    card: 'Kart',
    transfer: 'Havale/EFT',
    online: 'Online',
  }

  const itemRows = params.items.map(item => `
    <tr>
      <td>${item.service_name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatCurrency(item.unit_price)}</td>
      <td style="text-align:right">${formatCurrency(item.total)}</td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Fatura ${params.invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }
        .business-name { font-size: 22px; font-weight: 700; color: #6366f1; }
        .invoice-meta { text-align: right; }
        .invoice-number { font-size: 18px; font-weight: 700; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-top: 6px; }
        .badge-pending { background: #fef3c7; color: #d97706; }
        .badge-paid { background: #d1fae5; color: #059669; }
        .badge-overdue { background: #fee2e2; color: #dc2626; }
        .badge-cancelled { background: #f3f4f6; color: #6b7280; }
        .badge-partial { background: #dbeafe; color: #2563eb; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px; }
        .section-value { font-size: 14px; font-weight: 500; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
        tbody td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
        .totals { width: 260px; margin-left: auto; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
        .totals-row.total { font-size: 16px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 10px; margin-top: 4px; color: #6366f1; }
        .notes { margin-top: 20px; padding: 14px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="business-name">${params.businessName}</div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-number">${params.invoiceNumber}</div>
          <div style="color:#6b7280; margin-top:4px">${formatDate(params.createdAt)}</div>
          <span class="badge badge-${params.status}">${statusLabels[params.status] || params.status}</span>
        </div>
      </div>

      <div class="grid">
        ${params.customerName ? `
        <div class="section">
          <div class="section-title">Müşteri</div>
          <div class="section-value">${params.customerName}</div>
          ${params.customerPhone ? `<div style="color:#6b7280;margin-top:2px">${params.customerPhone}</div>` : ''}
        </div>
        ` : '<div></div>'}
        <div class="section" style="text-align:right">
          ${params.dueDate ? `
          <div class="section-title">Son Ödeme Tarihi</div>
          <div class="section-value">${formatDate(params.dueDate)}</div>
          ` : ''}
          ${params.paymentMethod ? `
          <div class="section-title" style="margin-top:12px">Ödeme Yöntemi</div>
          <div class="section-value">${paymentLabels[params.paymentMethod] || params.paymentMethod}</div>
          ` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Hizmet / Ürün</th>
            <th style="text-align:center">Adet</th>
            <th style="text-align:right">Birim Fiyat</th>
            <th style="text-align:right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Ara Toplam</span>
          <span>${formatCurrency(params.subtotal)}</span>
        </div>
        ${params.taxRate > 0 ? `
        <div class="totals-row">
          <span>KDV (%${params.taxRate})</span>
          <span>${formatCurrency(params.taxAmount)}</span>
        </div>
        ` : ''}
        <div class="totals-row total">
          <span>TOPLAM</span>
          <span>${formatCurrency(params.total)}</span>
        </div>
      </div>

      ${params.notes ? `<div class="notes"><strong>Not:</strong> ${params.notes}</div>` : ''}

      <div class="footer">PulseApp ile oluşturuldu</div>
    </body>
    </html>
  `

  const printWindow = window.open('', '_blank', 'width=800,height=900')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 500)
}
