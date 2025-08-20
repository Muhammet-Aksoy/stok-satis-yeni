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

// Satış geçmişi verilerini düzelt
function fixSalesData() {
    const data = readData();
    if (!data || !data.satisGecmisi) {
        console.log('Satış geçmişi verisi bulunamadı.');
        return;
    }

    console.log('Düzeltme öncesi satış geçmişi kayıtları:');
    data.satisGecmisi.forEach((satis, index) => {
        console.log(`${index + 1}. ${satis.urunAdi} - Satış Fiyatı: ${satis.fiyat}, Alış Fiyatı: ${satis.alisFiyati}`);
    });

    // Satış geçmişi verilerini düzelt
    data.satisGecmisi.forEach(satis => {
        // Eğer satış fiyatı alış fiyatına eşitse veya alış fiyatından düşükse
        // bu durumda satış fiyatını alış fiyatının %20 üzerinde olacak şekilde ayarla
        if (satis.fiyat <= satis.alisFiyati || satis.fiyat === satis.alisFiyati) {
            const yeniSatisFiyati = Math.round(satis.alisFiyati * 1.2); // %20 kar marjı
            console.log(`${satis.urunAdi} için satış fiyatı ${satis.fiyat} -> ${yeniSatisFiyati} olarak güncellendi`);
            satis.fiyat = yeniSatisFiyati;
            satis.toplam = satis.fiyat * satis.miktar;
        }
    });

    console.log('\nDüzeltme sonrası satış geçmişi kayıtları:');
    data.satisGecmisi.forEach((satis, index) => {
        console.log(`${index + 1}. ${satis.urunAdi} - Satış Fiyatı: ${satis.fiyat}, Alış Fiyatı: ${satis.alisFiyati}`);
    });

    // Veriyi kaydet
    saveData(data);
}

// Scripti çalıştır
if (require.main === module) {
    console.log('Satış geçmişi verilerini düzeltme işlemi başlatılıyor...\n');
    fixSalesData();
    console.log('\nDüzeltme işlemi tamamlandı.');
} 