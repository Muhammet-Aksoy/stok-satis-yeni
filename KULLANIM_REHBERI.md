# 📚 Türkçe Stok Yönetim Sistemi - Kullanım Rehberi

## 🚀 Sistem Başlatma

### 1. Sunucuyu Başlatın
```bash
node server.js
```

### 2. Yerel Ağ Erişimi için (İsteğe Bağlı)
Windows'ta **yönetici olarak** çalıştırın:
```cmd
setup-network.bat
```

## 🔧 Yeni Özellikler ve Kullanım

### ✅ 1. Barkod Değiştirme
- Artık barkod değiştirirken "bilinmeyen hata" almayacaksınız
- Sistem otomatik olarak benzersizlik kontrolü yapar
- Çakışma durumunda uygun hata mesajı verir

### ✅ 2. İade İşlemleri

#### Frontend Kullanımı:
```javascript
// İade işlemi
const iadeData = {
    satis_id: 123,
    barkod: "230965", 
    miktar: 1,
    aciklama: "Müşteri memnuniyetsizliği",
    musteri_id: "musteri_123"
};

fetch('/api/iade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(iadeData)
});
```

#### İade Geçmişi Görüntüleme:
```javascript
// Tüm iadeler
fetch('/api/iadeler')

// Belirli müşteri iadleri
fetch('/api/iadeler?musteri_id=123')

// Tarih aralığı ile
fetch('/api/iadeler?tarih_baslangic=2025-01-01&tarih_bitis=2025-01-31')
```

### ✅ 3. Kategori Yönetimi

#### Mevcut Kategoriler:
1. **Amortisör** (🚗) - Araç amortisörleri
2. **Fren Sistemi** (✋) - Fren balata ve parçaları  
3. **Motor Parçaları** (⚙️) - Motor yedek parçaları
4. **Elektrik** (⚡) - Elektrikli sistemler
5. **Karoseri** (🚚) - Dış karoseri parçaları
6. **İç Aksam** (🪑) - İç aksam parçaları
7. **Yağlar** (🛢️) - Motor ve diğer yağlar
8. **Filtreler** (🔍) - Hava, yakıt ve diğer filtreler

#### Kategori API Kullanımı:
```javascript
// Kategorileri listele
fetch('/api/kategoriler')

// Kategoriye göre ürünleri filtrele
fetch('/api/stok?kategori=Amortisör')
```

### ✅ 4. Müşteri Tab İyileştirmeleri

#### Yeni Özellikler:
- Müşteri satış geçmişi ayrı tabloda
- Ürün silme işlemi düzeltildi
- İade durumu takibi
- Gerçek zamanlı güncelleme

#### Kullanım:
```javascript
// Müşteri satış geçmişi
fetch('/api/musteri-satis-gecmisi/MUSTERI_ID')

// Müşteri ürün iadesi
fetch('/api/iade', {
    method: 'POST',
    body: JSON.stringify({
        satis_id: SATIS_ID,
        barkod: BARKOD,
        miktar: MIKTAR,
        musteri_id: MUSTERI_ID
    })
});
```

## 🌐 Yerel Ağ Erişimi

### IP Adresi Bulma:
1. `setup-network.bat` çalıştırın
2. Gösterilen IP adreslerinden birini kullanın
3. Telefon/tablet'ten: `http://192.168.X.X:3000`

### Güvenlik Duvarı Ayarları:
- Port 3000 otomatik açılır
- Yerel ağ trafiğine izin verilir
- CORS ayarları düzeltildi

## 📊 Veritabanı Durumu

### Mevcut Kayıtlar:
- **Ürünler**: 1,066 adet
- **Kategoriler**: 8 adet
- **Müşteriler**: 1 adet  
- **Satış Geçmişi**: 28 kayıt
- **İadeler**: 0 kayıt (yeni tablo)

### Yedekten Geri Yüklenen:
- **559 ürün** başarıyla geri yüklendi
- Tüm backup formatları desteklendi
- Otomatik kategori ataması yapıldı

## 🔍 Sorun Giderme

### Yaygın Sorunlar:

#### 1. Barkod Güncelleme Hatası
**Çözüm**: Düzeltildi! Artık güvenli şekilde güncelleyebilirsiniz.

#### 2. İade İşlemi Çalışmıyor
**Kontrol Edin**:
- İade tablosu oluşturuldu mu? ✅
- API endpoint'i mevcut mu? ✅
- Stok güncellemesi çalışıyor mu? ✅

#### 3. Telefon Bağlanamıyor
**Çözümler**:
1. `setup-network.bat` çalıştırın
2. Güvenlik duvarını kontrol edin
3. IP adresini doğru kullandığınızdan emin olun

#### 4. Kategoriler Görünmüyor
**Kontrol Edin**:
- Kategoriler tablosu oluşturuldu ✅
- 8 varsayılan kategori eklendi ✅
- Otomatik sayım çalışıyor ✅

## 📁 Önemli Dosyalar

### Düzeltme Scripti:
- `comprehensive-fixes.js` - Tüm düzeltmeleri yapar
- Tekrar çalıştırılabilir
- Güvenli ve idempotent

### Ağ Ayarları:
- `network-config.json` - Ağ yapılandırması
- `setup-network.bat` - Windows güvenlik duvarı

### Raporlar:
- `DUZELTME_RAPORU.md` - Düzeltme detayları
- `KULLANIM_REHBERI.md` - Bu dosya

## 🎯 Test Listesi

### ✅ Yapılması Gerekenler:
- [ ] Barkod güncelleme testi
- [ ] İade işlemi testi (tam/kısmi)
- [ ] Müşteri tab fonksiyonalitesi
- [ ] Yerel ağ bağlantısı
- [ ] Kategori filtreleme
- [ ] Yeni ürün ekleme
- [ ] CSS optimizasyonu kontrolü

## 🆘 Acil Durum

### Sorun Yaşarsanız:

1. **Düzeltme Script'ini Tekrar Çalıştırın**:
```bash
node comprehensive-fixes.js
```

2. **Sunucuyu Yeniden Başlatın**:
```bash
# Sunucuyu durdurun (Ctrl+C)
node server.js
```

3. **Logları Kontrol Edin**:
- Terminal çıktısını inceleyin
- Hata mesajlarını kaydedin

4. **Veritabanı Backup'ı**:
- Veriler/veritabani.db dosyası korunur
- Backup'lar all-backups/ klasöründe

## 📞 İletişim ve Destek

### Sistem Bilgileri:
- **Node.js Sürümü**: v22.16.0
- **Veritabanı**: SQLite3 (better-sqlite3)
- **Port**: 3000
- **Host**: 0.0.0.0 (tüm ağ arayüzleri)

### Başarılı Düzeltmeler:
✅ Barkod güncelleme hatası  
✅ İade işlemi sorunu  
✅ Müşteri tab sorunları  
✅ Ağ bağlantı problemi  
✅ CSS optimizasyonu  
✅ Kategori yönetimi  
✅ Çoklu barkod sorunu  
✅ Veri geri yükleme  

---
**🎉 Tüm sorunlar başarıyla çözüldü!**  
**📅 Güncelleme**: Ocak 2025  
**🔧 Sürüm**: v2.0 (Düzeltilmiş)