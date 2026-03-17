export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="booking-page min-h-screen bg-white text-gray-900" style={{ colorScheme: 'light' }}>
      {children}
    </div>
  )
}
