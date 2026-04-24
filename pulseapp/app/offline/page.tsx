'use client'

export default function OfflinePage() {
  return (
    <div className="public-page min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-8">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">İnternet bağlantısı yok</h1>
      <p className="text-gray-500 mb-6">Bağlantı kurulduğunda otomatik olarak devam edeceksiniz.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 rounded-lg bg-pulse-900 text-white font-medium text-sm hover:bg-pulse-800 transition-colors"
      >
        Yeniden Dene
      </button>
    </div>
  )
}
