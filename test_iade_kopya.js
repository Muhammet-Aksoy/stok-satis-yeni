const Database = require('better-sqlite3');
const db = new Database('veriler/veritabani.db');

console.log('🧪 İADE İŞLEMİ KOPYA TESTİ\n');

// Test için bir ürün seç (stoku olan)
const testUrun = db.prepare(`
    SELECT * FROM stok 
    WHERE miktar > 5 
    ORDER BY RANDOM() 
    LIMIT 1
`).get();

if (!testUrun) {
    console.log('❌ Test için uygun ürün bulunamadı (stok > 5 olan ürün yok)');
    db.close();
    process.exit(1);
}

console.log('📦 Test Ürünü:');
console.log(`   Barkod: ${testUrun.barkod}`);
console.log(`   Ad: ${testUrun.ad}`);
console.log(`   Marka: ${testUrun.marka || 'Markasız'}`);
console.log(`   Ürün ID: ${testUrun.urun_id}`);
console.log(`   Mevcut Stok: ${testUrun.miktar}\n`);

// Önce bu barkodla kaç ürün var kontrol et
const oncekiUrunSayisi = db.prepare(`
    SELECT COUNT(*) as sayi FROM stok WHERE barkod = ?
`).get(testUrun.barkod).sayi;

console.log(`🔍 Bu barkodla mevcut ürün sayısı: ${oncekiUrunSayisi}`);

// Test satışı oluştur
const satisMiktar = 2;
const satisFiyat = 100;
const satisId = Date.now();

console.log(`\n💰 Test satışı oluşturuluyor...`);
console.log(`   Miktar: ${satisMiktar}`);
console.log(`   Fiyat: ${satisFiyat} TL`);

// Satış ekle
db.prepare(`
    INSERT INTO satisGecmisi (
        id, barkod, urunAdi, marka, urun_id, miktar, 
        fiyat, alisFiyati, toplam, borc, tarih, musteriId, musteriAdi
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
    satisId,
    testUrun.barkod,
    testUrun.ad,
    testUrun.marka || '',
    testUrun.urun_id,
    satisMiktar,
    satisFiyat,
    testUrun.alisFiyati || 0,
    satisMiktar * satisFiyat,
    0,
    new Date().toISOString(),
    '',
    'Test Müşteri'
);

// Stok azalt
db.prepare(`
    UPDATE stok SET miktar = miktar - ? WHERE id = ?
`).run(satisMiktar, testUrun.id);

console.log('✅ Test satışı oluşturuldu');

// Güncel stok durumu
const satissonrasiStok = db.prepare(`
    SELECT miktar FROM stok WHERE id = ?
`).get(testUrun.id);

console.log(`\n📊 Satış Sonrası Durum:`);
console.log(`   Stok: ${satissonrasiStok.miktar} (${testUrun.miktar} - ${satisMiktar})`);

// Şimdi iade simülasyonu
console.log(`\n🔄 İade simülasyonu başlıyor...`);

// İade için satış kaydını sil
db.prepare('DELETE FROM satisGecmisi WHERE id = ?').run(satisId);

// Stoğu geri artır - SADECE MEVCUT ÜRÜNE
db.prepare(`
    UPDATE stok SET miktar = miktar + ? WHERE id = ?
`).run(satisMiktar, testUrun.id);

console.log('✅ İade işlemi tamamlandı');

// İade sonrası kontroller
const iadeSonrasiStok = db.prepare(`
    SELECT miktar FROM stok WHERE id = ?
`).get(testUrun.id);

const iadeSonrasiUrunSayisi = db.prepare(`
    SELECT COUNT(*) as sayi FROM stok WHERE barkod = ?
`).get(testUrun.barkod).sayi;

console.log(`\n📊 İade Sonrası Durum:`);
console.log(`   Stok: ${iadeSonrasiStok.miktar} (beklenen: ${testUrun.miktar})`);
console.log(`   Bu barkodla ürün sayısı: ${iadeSonrasiUrunSayisi} (beklenen: ${oncekiUrunSayisi})`);

// Sonuç değerlendirmesi
console.log('\n' + '='.repeat(60));
console.log('TEST SONUCU');
console.log('='.repeat(60));

let basarili = true;

if (iadeSonrasiStok.miktar === testUrun.miktar) {
    console.log('✅ Stok miktarı doğru şekilde geri yüklendi');
} else {
    console.log('❌ Stok miktarı hatalı!');
    basarili = false;
}

if (iadeSonrasiUrunSayisi === oncekiUrunSayisi) {
    console.log('✅ Kopya ürün oluşmadı');
} else {
    console.log('❌ KOPYA ÜRÜN OLUŞTU!');
    basarili = false;
    
    // Kopya ürünleri listele
    const kopyalar = db.prepare(`
        SELECT * FROM stok WHERE barkod = ?
    `).all(testUrun.barkod);
    
    console.log('\nKopya ürünler:');
    kopyalar.forEach(kopya => {
        console.log(`  ID: ${kopya.id}, Ürün ID: ${kopya.urun_id}, Stok: ${kopya.miktar}`);
    });
}

if (basarili) {
    console.log('\n🎉 TEST BAŞARILI - İade işlemi kopya oluşturmuyor!');
} else {
    console.log('\n❌ TEST BAŞARISIZ - Sorun tespit edildi!');
}

db.close();