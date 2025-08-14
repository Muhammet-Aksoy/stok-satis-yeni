// Fix for barkod-based system and tab close backup
// Bu dosyayı try.html dosyasına ekleyin

// 1. Tab close backup fonksiyonu
function createTabCloseBackup() {
    try {
        const backupData = {
            stokListesi: stokListesi,
            satisGecmisi: satisGecmisi,
            musteriler: musteriler,
            borclarim: borclarim,
            backupTime: new Date().toISOString(),
            backupType: 'tab-close'
        };
        
        // Backup dosyasını oluştur
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const backupUrl = URL.createObjectURL(backupBlob);
        
        const a = document.createElement('a');
        a.href = backupUrl;
        a.download = `tab-close-backup_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(backupUrl);
        
        console.log('💾 Sekme kapatılırken backup dosyası oluşturuldu');
    } catch (error) {
        console.error('❌ Tab close backup hatası:', error);
    }
}

// 2. Beforeunload event listener'ı güncelle
window.addEventListener('beforeunload', function(e) {
    guncellenenVerileriKaydet();
    createTabCloseBackup();
});

// 3. Barkod tabanlı sistem düzeltmeleri
// Bu fonksiyonları try.html'deki mevcut fonksiyonlarla değiştirin

// urunDuzenle fonksiyonunu düzelt
function urunDuzenle(barkod) {
    const urun = stokListesi[barkod];
    document.getElementById('barkod').value = urun.barkod;
    document.getElementById('urunAdi').value = urun.ad;
    document.getElementById('marka').value = urun.marka || '';
    document.getElementById('aciklama').value = urun.aciklama || '';
    document.getElementById('miktar').value = urun.miktar;
    document.getElementById('alisFiyati').value = urun.alisFiyati || '';
    
    // Düzenlenen ürün barkod'unu kaydet
    editingBarkod = barkod;
    
    // Sayfayı formun olduğu kısma kaydır
    document.getElementById('barkod').scrollIntoView({ behavior: 'smooth' });
}

// Tablo güncelleme fonksiyonunda barkod kullan
function tabloGuncelle() {
    const tbody = document.querySelector('#stokTablosu tbody');
    const cardView = document.getElementById('card-view');
    
    tbody.innerHTML = '';
    cardView.innerHTML = '';
    
    // Sıralama yap
    const sortedProducts = Object.entries(stokListesi);
    
    if (currentSort.column) {
        sortedProducts.sort((a, b) => {
            let valueA, valueB;
            
            switch(currentSort.column) {
                case 'barkod':
                    valueA = a[0].toLowerCase();
                    valueB = b[0].toLowerCase();
                    break;
                case 'ad':
                    valueA = a[1].ad.toLowerCase();
                    valueB = b[1].ad.toLowerCase();
                    break;
                case 'miktar':
                    valueA = a[1].miktar;
                    valueB = b[1].miktar;
                    break;
                case 'alisFiyati':
                    valueA = a[1].alisFiyati || 0;
                    valueB = b[1].alisFiyati || 0;
                    break;
                default:
                    return 0;
            }
            
            if (currentSort.direction === 'asc') {
                return valueA > valueB ? 1 : -1;
            } else {
                return valueA < valueB ? 1 : -1;
            }
        });
    }
    
    let productFound = false;
    
    for (const [barkod, urun] of sortedProducts) {
        // Stok sıfır ise özel class ekle
        const stockZeroClass = urun.miktar === 0 ? 'stock-zero' : '';
        
        // Tablo satırı oluştur
        const tr = document.createElement('tr');
        if (stockZeroClass) tr.classList.add(stockZeroClass);
        
        tr.innerHTML = `
            <td class="barcode-cell tooltip">${barkod}
                <span class="tooltiptext">Çift tıklayarak arama yapabilirsiniz</span>
            </td>
            <td>
                <span class="product-name-link" onclick="showProductDetails('${barkod}')">
                    ${urun.ad}
                </span>
            </td>
            <td>${urun.marka || '-'}</td>
            <td>${urun.miktar}${urun.miktar === 0 ? ' <span class="stock-zero-badge">STOK BİTTİ</span>' : ''}</td>
            <td>${urun.alisFiyati ? urun.alisFiyati.toFixed(2) : '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn btn-sell" title="Sat" onclick="urunSat('${barkod}')" ${urun.miktar === 0 ? 'disabled style="opacity:0.5;"' : ''}>
                        <i class="fas fa-cash-register"></i>
                    </button>
                    <button class="action-btn btn-print" title="Barkod Bas" onclick="barkodBas('${barkod}')">
                        <i class="fas fa-barcode"></i>
                    </button>
                    <button class="action-btn btn-edit" title="Düzenle" onclick="urunDuzenle('${barkod}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn btn-delete" title="Sil" onclick="urunSil('${barkod}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
        
        // Kart görünümü oluştur
        const card = document.createElement('div');
        card.className = `product-card ${stockZeroClass}`;
        
        card.innerHTML = `
            <div class="product-header">
                <h3 class="tooltip">
                    <span class="product-name-link" onclick="showProductDetails('${barkod}')">
                        ${urun.ad}
                    </span>
                </h3>
                <p>${barkod}</p>
                ${urun.marka ? `<p style="font-size: 12px; color: #888;">${urun.marka}</p>` : ''}
            </div>
            <div class="product-body">
                <div class="product-info">
                    <p><strong>Marka:</strong> ${urun.marka || '-'}</p>
                    <p><strong>Stok:</strong> ${urun.miktar}${urun.miktar === 0 ? ' <span class="stock-zero-badge">STOK BİTTİ</span>' : ''}</p>
                    <p><strong>Alış Fiyatı:</strong> ${urun.alisFiyati ? urun.alisFiyati.toFixed(2) : '-'} ₺</p>
                </div>
            </div>
            <div class="product-footer">
                <div class="action-buttons">
                    <button class="action-btn btn-sell" title="Sat" onclick="urunSat('${barkod}')" ${urun.miktar === 0 ? 'disabled style="opacity:0.5;"' : ''}>
                        <i class="fas fa-cash-register"></i>
                    </button>
                    <button class="action-btn btn-print" title="Barkod Bas" onclick="barkodBas('${barkod}')">
                        <i class="fas fa-barcode"></i>
                    </button>
                    <button class="action-btn btn-edit" title="Düzenle" onclick="urunDuzenle('${barkod}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn btn-delete" title="Sil" onclick="urunSil('${barkod}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        cardView.appendChild(card);
        productFound = true;
    }
    
    // Ürün bulunamadıysa mesaj göster
    const noProductMessage = document.getElementById('noProductMessage');
    if (!productFound) {
        noProductMessage.style.display = 'block';
    } else {
        noProductMessage.style.display = 'none';
    }
    
    // Double-click için olay dinleyicileri ekle
    addBarcodeDoubleClick();
    
    istatistikleriGuncelle();
}

console.log('🔧 Barkod tabanlı sistem düzeltmeleri ve tab close backup hazır');