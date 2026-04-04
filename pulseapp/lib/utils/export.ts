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

/**
 * Fatura listesi PDF export — jspdf + jspdf-autotable
 */
export async function exportInvoiceListPDF(
  invoices: Array<{
    invoice_number: string
    customers?: { name: string } | null
    total: number
    paid_amount?: number
    tax_rate: number
    tax_amount: number
    status: string
    payment_method?: string | null
    payment_type?: string
    created_at: string
    due_date?: string | null
  }>,
  statusConfig?: Record<string, { label: string }>
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const statusLabel = (s: string) => statusConfig?.[s]?.label || s
  const paymentLabel = (m: string | null | undefined) => {
    if (!m) return '—'
    const labels: Record<string, string> = { cash: 'Nakit', card: 'Kart', transfer: 'Havale/EFT', online: 'Online' }
    return labels[m] || m
  }
  const paymentTypeLabel = (t: string | undefined) => {
    if (!t || t === 'standard') return 'Standart'
    if (t === 'installment') return 'Taksitli'
    if (t === 'deposit') return 'Kaporali'
    return t
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFontSize(18)
  doc.setTextColor(99, 102, 241)
  doc.text('Fatura Listesi', 14, 18)

  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Olusturma: ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} | ${invoices.length} fatura`, 14, 25)

  // Summary stats
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalPending = invoices.filter(i => i.status === 'pending' || i.status === 'partial').reduce((s, i) => s + i.total - (i.paid_amount || 0), 0)
  const totalOverdue = invoices.filter(i => i.status === 'overdue').length

  const boxY = 30
  const boxH = 14
  const boxW = 60

  // Paid box
  doc.setFillColor(209, 250, 229)
  doc.roundedRect(14, boxY, boxW, boxH, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setTextColor(5, 150, 105)
  doc.text('Tahsil Edilen', 18, boxY + 5)
  doc.setFontSize(11)
  doc.text(formatCurrency(totalPaid), 18, boxY + 11)

  // Pending box
  doc.setFillColor(254, 243, 199)
  doc.roundedRect(14 + boxW + 8, boxY, boxW, boxH, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setTextColor(217, 119, 6)
  doc.text('Bekleyen', 18 + boxW + 8, boxY + 5)
  doc.setFontSize(11)
  doc.text(formatCurrency(totalPending), 18 + boxW + 8, boxY + 11)

  // Overdue box
  doc.setFillColor(254, 226, 226)
  doc.roundedRect(14 + (boxW + 8) * 2, boxY, boxW, boxH, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setTextColor(220, 38, 38)
  doc.text('Vadesi Gecmis', 18 + (boxW + 8) * 2, boxY + 5)
  doc.setFontSize(11)
  doc.text(`${totalOverdue} fatura`, 18 + (boxW + 8) * 2, boxY + 11)

  // Table
  const tableData = invoices.map(inv => [
    inv.invoice_number,
    inv.customers?.name || '—',
    formatCurrency(inv.total),
    inv.tax_rate > 0 ? `%${inv.tax_rate}` : '—',
    formatCurrency(inv.paid_amount || 0),
    statusLabel(inv.status),
    paymentLabel(inv.payment_method),
    paymentTypeLabel(inv.payment_type),
    formatDate(inv.created_at),
    inv.due_date ? formatDate(inv.due_date) : '—',
  ])

  autoTable(doc, {
    startY: boxY + boxH + 6,
    head: [['Fatura No', 'Musteri', 'Toplam', 'KDV', 'Odenen', 'Durum', 'Odeme', 'Tip', 'Tarih', 'Son Odeme']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didDrawCell: (data: import('jspdf-autotable').CellHookData) => {
      if (data.section === 'body' && data.column.index === 5) {
        const text = data.cell.text[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = data.cell.styles as any
        if (text === 'Odendi' || text === 'Ödendi') {
          s.textColor = [5, 150, 105]; s.fillColor = [209, 250, 229]
        } else if (text === 'Bekliyor') {
          s.textColor = [217, 119, 6]; s.fillColor = [254, 243, 199]
        } else if (text === 'Vadesi Gecmis' || text === 'Vadesi Geçmiş') {
          s.textColor = [220, 38, 38]; s.fillColor = [254, 226, 226]
        } else if (text === 'Iptal' || text === 'İptal') {
          s.textColor = [107, 114, 128]; s.fillColor = [243, 244, 246]
        }
      }
    },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.text(`PulseApp | Sayfa ${i}/${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
  }

  doc.save('fatura-listesi.pdf')
}

/**
 * Fatura listesi Excel export — xlsx
 */
export async function exportInvoiceListXLSX(
  invoices: Array<{
    invoice_number: string
    customers?: { name: string } | null
    subtotal: number
    total: number
    paid_amount?: number
    tax_rate: number
    tax_amount: number
    status: string
    payment_method?: string | null
    payment_type?: string
    created_at: string
    due_date?: string | null
    paid_at?: string | null
  }>
): Promise<void> {
  const XLSX = await import('xlsx')

  const statusLabels: Record<string, string> = {
    pending: 'Bekliyor', paid: 'Ödendi', partial: 'Kısmi Ödeme',
    overdue: 'Vadesi Geçmiş', cancelled: 'İptal',
  }
  const paymentLabels: Record<string, string> = { cash: 'Nakit', card: 'Kart', transfer: 'Havale/EFT', online: 'Online' }
  const paymentTypeLabels: Record<string, string> = { standard: 'Standart', installment: 'Taksitli', deposit: 'Kaporalı' }

  const formatDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('tr-TR') : '—'

  const data = invoices.map(inv => ({
    'Fatura No': inv.invoice_number,
    'Müşteri': inv.customers?.name || '—',
    'Ara Toplam': inv.subtotal,
    'KDV (%)': inv.tax_rate,
    'KDV Tutarı': inv.tax_amount,
    'Toplam': inv.total,
    'Ödenen': inv.paid_amount || 0,
    'Kalan': inv.total - (inv.paid_amount || 0),
    'Durum': statusLabels[inv.status] || inv.status,
    'Ödeme Yöntemi': paymentLabels[inv.payment_method || ''] || '—',
    'Ödeme Tipi': paymentTypeLabels[inv.payment_type || 'standard'] || 'Standart',
    'Tarih': formatDate(inv.created_at),
    'Son Ödeme': formatDate(inv.due_date),
    'Ödeme Tarihi': formatDate(inv.paid_at),
  }))

  // Total row
  const totalRow: Record<string, string | number> = {
    'Fatura No': 'TOPLAM',
    'Müşteri': `${invoices.length} fatura`,
    'Ara Toplam': invoices.reduce((s, i) => s + i.subtotal, 0),
    'KDV (%)': '',
    'KDV Tutarı': invoices.reduce((s, i) => s + i.tax_amount, 0),
    'Toplam': invoices.reduce((s, i) => s + i.total, 0),
    'Ödenen': invoices.reduce((s, i) => s + (i.paid_amount || 0), 0),
    'Kalan': invoices.reduce((s, i) => s + i.total - (i.paid_amount || 0), 0),
    'Durum': '', 'Ödeme Yöntemi': '', 'Ödeme Tipi': '',
    'Tarih': '', 'Son Ödeme': '', 'Ödeme Tarihi': '',
  }
  data.push(totalRow as typeof data[0])

  const ws = XLSX.utils.json_to_sheet(data)

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Faturalar')
  XLSX.writeFile(wb, 'fatura-listesi.xlsx')
}
