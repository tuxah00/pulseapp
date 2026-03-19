export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pulse-50 via-white to-pulse-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-pulse-600">
            Pulse<span className="text-gray-900">App</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            İşletmenizin dijital asistanı
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
