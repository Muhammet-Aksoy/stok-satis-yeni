const fs = require('fs');
const path = require('path');

// Veri dosyasının yolu
const dataPath = path.join(__dirname, 'veriler', 'veriler.json');

// Veriyi oku
function readData() {
    try {
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Veri dosyası okunamadı:', error.message);
        return null;
    }
}

// Veriyi kaydet
function saveData(data) {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
        console.log('Veri başarıyla kaydedildi.');
    } catch (error) {
        console.error('Veri kaydedilemedi:', error.message);
    }
}

// NaN değerlerini düzelt
function fixNaNValues() {
    const data = readData();
    if (!data || !data.satisGecmisi) {
        console.log('Satış geçmişi verisi bulunamadı.');
        return;
    }

    console.log('NaN değerleri düzeltme işlemi başlatılıyor...\n');

    let fixedCount = 0;
    data.satisGecmisi.forEach((satis, index) => {
        let hasChanges = false;
        
        // Fiyat kontrolü
        if (isNaN(satis.fiyat) || satis.fiyat === null || satis.fiyat === undefined) {
            console.log(`${index + 1}. ${satis.urunAdi} - Fiyat NaN, 0 olarak düzeltildi`);
            satis.fiyat = 0;
            hasChanges = true;
        }
        
        // Miktar kontrolü
        if (isNaN(satis.miktar) || satis.miktar === null || satis.miktar === undefined) {
            console.log(`${index + 1}. ${satis.urunAdi} - Miktar NaN, 1 olarak düzeltildi`);
            satis.miktar = 1;
            hasChanges = true;
        }
        
        // Alış fiyatı kontrolü
        if (isNaN(satis.alisFiyati) || satis.alisFiyati === null || satis.alisFiyati === undefined) {
            console.log(`${index + 1}. ${satis.urunAdi} - Alış fiyatı NaN, 0 olarak düzeltildi`);
            satis.alisFiyati = 0;
            hasChanges = true;
        }
        
        // Toplam hesaplama
        const fiyat = parseFloat(satis.fiyat) || 0;
        const miktar = parseInt(satis.miktar) || 0;
        const yeniToplam = fiyat * miktar;
        
        if (isNaN(satis.toplam) || satis.toplam === null || satis.toplam === undefined || satis.toplam !== yeniToplam) {
            console.log(`${index + 1}. ${satis.urunAdi} - Toplam ${satis.toplam} -> ${yeniToplam} olarak düzeltildi`);
            satis.toplam = yeniToplam;
            hasChanges = true;
        }
        
        if (hasChanges) {
            fixedCount++;
        }
    });

    if (fixedCount > 0) {
        console.log(`\n${fixedCount} kayıt düzeltildi.`);
        saveData(data);
    } else {
        console.log('\nDüzeltilecek NaN değeri bulunamadı.');
    }
}

// Scripti çalıştır
if (require.main === module) {
    fixNaNValues();
    console.log('\nNaN düzeltme işlemi tamamlandı.');
} 