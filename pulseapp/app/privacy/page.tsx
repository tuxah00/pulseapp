import { ShieldCheck, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Ana Sayfa
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <ShieldCheck className="h-8 w-8 text-pulse-900" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kişisel Verilerin Korunması Aydınlatma Metni</h1>
              <p className="text-sm text-gray-500 mt-1">6698 sayılı KVKK kapsamında</p>
            </div>
          </div>

          <div className="prose prose-sm prose-gray max-w-none space-y-4 text-gray-700 leading-relaxed">
            <h2 className="text-lg font-semibold text-gray-900">1. Veri Sorumlusu</h2>
            <p>
              Bu aydınlatma metni, PulseApp platformunu kullanan işletme (&quot;Veri Sorumlusu&quot;) tarafından,
              6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında hazırlanmıştır.
            </p>

            <h2 className="text-lg font-semibold text-gray-900">2. İşlenen Kişisel Veriler</h2>
            <p>Aşağıdaki kişisel verileriniz işlenmektedir:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Kimlik Bilgileri:</strong> Ad, soyad</li>
              <li><strong>İletişim Bilgileri:</strong> Telefon numarası, e-posta adresi</li>
              <li><strong>Randevu Bilgileri:</strong> Randevu tarihi, saati, alınan hizmet</li>
              <li><strong>Sağlık Verileri (ilgili sektörlerde):</strong> Tedavi geçmişi, alerji bilgileri, tedavi protokolleri, fotoğraflar</li>
              <li><strong>Finansal Veriler:</strong> Fatura bilgileri, ödeme geçmişi</li>
              <li><strong>Dijital Veriler:</strong> IP adresi, cihaz bilgileri</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">3. Kişisel Verilerin İşlenme Amaçları</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Randevu oluşturma, yönetme ve hatırlatma</li>
              <li>Hizmet sunumu ve kalite takibi</li>
              <li>Tedavi protokollerinin planlanması ve takibi</li>
              <li>Faturalama ve ödeme işlemleri</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              <li>Açık rızanız halinde: kampanya ve bilgilendirme mesajları gönderimi</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">4. Kişisel Verilerin İşlenmesinin Hukuki Sebepleri</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Sözleşmenin ifası (KVKK m.5/2-c)</li>
              <li>Veri sorumlusunun meşru menfaati (KVKK m.5/2-f)</li>
              <li>Hukuki yükümlülüklerin yerine getirilmesi (KVKK m.5/2-ç)</li>
              <li>Sağlık verileri için: açık rıza (KVKK m.6/2)</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">5. Kişisel Verilerin Aktarılması</h2>
            <p>
              Kişisel verileriniz, hizmet sunumu amacıyla aşağıdaki taraflara aktarılabilir:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Randevu hatırlatma ve bilgilendirme için SMS/WhatsApp hizmet sağlayıcıları</li>
              <li>E-fatura düzenleme için muhasebe yazılımı sağlayıcıları</li>
              <li>Ödeme işlemleri için ödeme kuruluşları</li>
              <li>Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşları</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">6. Veri Saklama Süresi</h2>
            <p>
              Kişisel verileriniz, hizmet ilişkisi devam ettiği sürece ve yasal saklama yükümlülükleri
              kapsamında (sağlık kayıtları için 20 yıl, ticari kayıtlar için 10 yıl) saklanır.
            </p>

            <h2 className="text-lg font-semibold text-gray-900">7. KVKK Kapsamındaki Haklarınız</h2>
            <p>KVKK&apos;nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmiş olması halinde düzeltilmesini isteme</li>
              <li>KVKK&apos;nın 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
              <li>Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
              <li>Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkması halinde itiraz etme</li>
              <li>Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900">8. Başvuru Yöntemi</h2>
            <p>
              Yukarıdaki haklarınızı kullanmak için işletmenize doğrudan başvurabilir veya
              Kişisel Verileri Koruma Kurumu&apos;na şikayette bulunabilirsiniz.
            </p>

            <div className="border-t border-gray-100 pt-4 mt-6">
              <p className="text-xs text-gray-400">
                Bu aydınlatma metni, PulseApp platformu aracılığıyla hizmet sunan işletme tarafından sağlanmaktadır.
                Son güncelleme: {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
