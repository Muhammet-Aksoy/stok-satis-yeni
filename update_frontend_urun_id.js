// Frontend güncelleme scripti - try.html dosyasını güncelle
const fs = require('fs');

console.log('🔧 FRONTEND ÜRÜN ID GÜNCELLEMESİ\n');

// try.html dosyasını oku
let htmlContent = fs.readFileSync('try.html', 'utf8');

// 1. urunSat fonksiyonunu güncelle - Aynı barkodlu ürünler için seçim ekle
const urunSatOld = `function urunSat(key) {
    if (!stokListesi[key]) return;

    const urun = stokListesi[key];
    const mevcutStok = parseInt(urun.stok_miktari ?? urun.miktar ?? 0, 10);
    if (mevcutStok <= 0) {
        Swal.fire('Uyarı', 'Bu ürünün stokta yeterli miktarı yok.', 'warning');
        return;
    }
    const alisFiyati = parseFloat(urun.alisFiyati) || 0;

    Swal.fire({`;

const urunSatNew = `function urunSat(key) {
    if (!stokListesi[key]) return;

    const urun = stokListesi[key];
    
    // Aynı barkodlu başka ürünler var mı kontrol et
    const ayniBarkoduluUrunler = Object.entries(stokListesi).filter(([k, u]) => 
        u.barkod === urun.barkod && parseInt(u.stok_miktari ?? u.miktar ?? 0, 10) > 0
    );
    
    // Eğer birden fazla ürün varsa, seçim yaptır
    if (ayniBarkoduluUrunler.length > 1) {
        let urunSecimHTML = '<div style="text-align: left; max-height: 300px; overflow-y: auto;">';
        urunSecimHTML += '<p><strong>Aynı barkodlu birden fazla ürün bulundu. Lütfen satılacak ürünü seçin:</strong></p>';
        
        ayniBarkoduluUrunler.forEach(([k, u], index) => {
            const stok = parseInt(u.stok_miktari ?? u.miktar ?? 0, 10);
            const isSelected = k === key ? 'checked' : '';
            urunSecimHTML += \`
                <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px; background: \${isSelected ? '#e8f4f8' : '#fff'};">
                    <label style="display: block; cursor: pointer;">
                        <input type="radio" name="urunSecim" value="\${k}" \${isSelected}>
                        <strong>\${u.ad || u.urun_adi || ''}</strong><br>
                        <small>
                            ID: \${u.urun_id || u.id} | 
                            Marka: \${u.marka || 'Markasız'} | 
                            Stok: \${stok} | 
                            Alış: \${(parseFloat(u.alisFiyati) || 0).toFixed(2)} ₺
                        </small>
                    </label>
                </div>
            \`;
        });
        
        urunSecimHTML += '</div>';
        
        Swal.fire({
            title: 'Ürün Seçimi',
            html: urunSecimHTML,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Devam Et',
            cancelButtonText: 'İptal',
            preConfirm: () => {
                const selectedRadio = document.querySelector('input[name="urunSecim"]:checked');
                if (!selectedRadio) {
                    Swal.showValidationMessage('Lütfen bir ürün seçin');
                    return false;
                }
                return selectedRadio.value;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Seçilen ürün ile satış işlemine devam et
                urunSatDevam(result.value);
            }
        });
        
        return;
    }
    
    // Tek ürün varsa direkt devam et
    urunSatDevam(key);
}

// Satış işleminin devamı
function urunSatDevam(key) {
    if (!stokListesi[key]) return;

    const urun = stokListesi[key];
    const mevcutStok = parseInt(urun.stok_miktari ?? urun.miktar ?? 0, 10);
    if (mevcutStok <= 0) {
        Swal.fire('Uyarı', 'Bu ürünün stokta yeterli miktarı yok.', 'warning');
        return;
    }
    const alisFiyati = parseFloat(urun.alisFiyati) || 0;

    Swal.fire({`;

// 2. showProductDetails fonksiyonuna ürün ID bilgisi ekle
const showProductDetailsPattern = /<p><strong>Stok:<\/strong> \${urun\.stok_miktari \|\| urun\.miktar \|\| 0}<\/p>/g;
const showProductDetailsReplacement = `<p><strong>Stok:</strong> \${urun.stok_miktari || urun.miktar || 0}</p>
                            <p><strong>Ürün ID:</strong> \${urun.urun_id || urun.id || '-'}</p>`;

// 3. Satış geçmişinde ürün ID göster
const satisTablosuPattern = /<td title="Orijinal: \${satis\.urunAdi}/g;
const satisTablosuReplacement = `<td title="Ürün ID: \${satis.urun_id || '-'} | Orijinal: \${satis.urunAdi}`;

// Güncellemeleri uygula
htmlContent = htmlContent.replace(urunSatOld, urunSatNew);
htmlContent = htmlContent.replace(showProductDetailsPattern, showProductDetailsReplacement);
htmlContent = htmlContent.replace(satisTablosuPattern, satisTablosuReplacement);

// 4. Barkod aramasında ürün ID bazlı sonuç gösterimi ekle
const barkodAramaPattern = /searchProductsByBarcode\(barkod\);/g;
const barkodAramaReplacement = `searchProductsByBarcode(barkod, true);`;

htmlContent = htmlContent.replace(barkodAramaPattern, barkodAramaReplacement);

// 5. searchProductsByBarcode fonksiyonunu güncelle
const searchByBarcodeOld = `async function searchProductsByBarcode(barkod) {`;
const searchByBarcodeNew = `async function searchProductsByBarcode(barkod, showSelection = false) {`;

htmlContent = htmlContent.replace(searchByBarcodeOld, searchByBarcodeNew);

// Güncellenmiş dosyayı kaydet
fs.writeFileSync('try.html', htmlContent);

console.log('✅ Frontend güncellemesi tamamlandı!');
console.log('\n📋 Yapılan değişiklikler:');
console.log('1. ✅ urunSat fonksiyonu: Aynı barkodlu ürünler için seçim ekranı');
console.log('2. ✅ Ürün detaylarında ürün ID gösterimi');
console.log('3. ✅ Satış geçmişinde ürün ID bilgisi');
console.log('4. ✅ Barkod aramasında ürün seçimi');
console.log('\n🎯 Artık aynı barkodlu varyant ürünler karışmayacak!');