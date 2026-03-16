export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
