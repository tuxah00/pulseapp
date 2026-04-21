import { FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="public-page min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Ana Sayfa
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <FileText className="h-8 w-8 text-pulse-900" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kullanım Koşulları</h1>
              <p className="text-sm text-gray-500 mt-1">PulseApp Hizmet Sözleşmesi</p>
            </div>
          </div>

          <div className="prose prose-sm prose-gray max-w-none space-y-4 text-gray-700 leading-relaxed">
            <h2 className="text-lg font-semibold text-gray-900">1. Taraflar</h2>
            <p>
              Bu sözleşme, PulseApp platformu (&quot;Platform&quot;) ile platformu kullanan son kullanıcı (&quot;Kullanıcı&quot;) arasında
              düzenlenmiştir. Platformu kullanarak bu koşulları kabul etmiş sayılırsınız.
            </p>

            <h2 className="text-lg font-semibold text-gray-900">2. Hizmet Kapsamı</h2>
            <p>PulseApp, işletmelere yönelik aşağıdaki hizmetleri sunar:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Online randevu yönetimi</li>
              <li>Müşteri ilişkileri yönetimi (CRM)</li>
              <li>Faturalama ve ödeme takibi</li>
              <li>SMS ve mesajlaşma hizmetleri</li>
              <li>Yapay zeka destekli analiz ve öneriler</li>
              <li>Tedavi protokolü ve takip yönetimi</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">3. Kullanıcı Yükümlülükleri</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Platformu yalnızca yasal amaçlarla kullanacağınızı kabul edersiniz.</li>
              <li>Hesap bilgilerinizin güvenliğinden siz sorumlusunuz.</li>
              <li>Müşteri verilerinin doğruluğu ve güncelliği sizin sorumluluğunuzdadır.</li>
              <li>KVKK ve diğer veri koruma mevzuatına uygun hareket edeceğinizi taahhüt edersiniz.</li>
              <li>Sağlık verisi işleyen işletmeler, açık rıza alma yükümlülüğünü yerine getirmelidir.</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">4. Ödeme Koşulları</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Abonelik ücretleri aylık olarak tahsil edilir.</li>
              <li>Ödeme yapılmadığı takdirde hizmet askıya alınabilir.</li>
              <li>Fiyat değişiklikleri en az 30 gün önceden bildirilir.</li>
              <li>Deneme süresi sona erdiğinde otomatik ücretlendirme yapılmaz; plan seçimi gerekir.</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">5. Veri Güvenliği</h2>
            <p>
              Platform, verilerinizi endüstri standardı güvenlik önlemleriyle korur.
              Detaylar için <a href="/privacy" className="text-pulse-900 underline">Kişisel Verilerin Korunması Aydınlatma Metni</a>&apos;ni
              inceleyebilirsiniz.
            </p>

            <h2 className="text-lg font-semibold text-gray-900">6. Sorumluluk Sınırı</h2>
            <p>
              Platform, hizmet kesintileri, veri kaybı veya üçüncü taraf entegrasyonlarından kaynaklanan
              sorunlardan dolayı doğrudan veya dolaylı zararlardan sorumlu tutulamaz.
              Platform &quot;olduğu gibi&quot; sunulmaktadır.
            </p>

            <h2 className="text-lg font-semibold text-gray-900">7. Fikri Mülkiyet</h2>
            <p>
              PulseApp markası, logosu, yazılımı ve içeriği üzerindeki tüm fikri mülkiyet hakları
              platform sahibine aittir. İşletme verileri üzerindeki haklar işletmeye aittir.
            </p>

            <h2 className="text-lg font-semibold text-gray-900">8. Fesih</h2>
            <p>
              Her iki taraf da aboneliği herhangi bir zamanda sonlandırabilir.
              Fesih halinde verileriniz 30 gün boyunca saklanır ve bu süre içinde dışa aktarılabilir.
            </p>

            <h2 className="text-lg font-semibold text-gray-900">9. Uyuşmazlık Çözümü</h2>
            <p>
              Bu sözleşmeden doğan uyuşmazlıklarda Türkiye Cumhuriyeti kanunları uygulanır.
              Uyuşmazlıkların çözümünde Türkiye mahkemeleri yetkilidir.
            </p>

            <div className="border-t border-gray-100 pt-4 mt-6">
              <p className="text-xs text-gray-400">
                Son güncelleme: {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
