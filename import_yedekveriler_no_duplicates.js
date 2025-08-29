const Database = require('better-sqlite3');
const fs = require('fs');

console.log('🚀 YEDEKVERILER.JSON İÇE AKTARMA İŞLEMİ (KOPYASIZ)\n');

// JSON dosyasını oku
const jsonData = JSON.parse(fs.readFileSync('yedekveriler.json', 'utf8'));
const stokListesi = jsonData.stokListesi || {};

// Veritabanı bağlantısı
const db = new Database('veriler/veritabani.db');

console.log(`📋 Kontrol edilecek ürün sayısı: ${Object.keys(stokListesi).length}`);

// Önce sistemdeki mevcut durumu öğren
const currentStats = db.prepare(`
    SELECT 
        COUNT(*) as count,
        SUM(miktar * alisFiyati) as total_value
    FROM stok
`).get();

console.log(`\n📊 İşlem öncesi sistem durumu:`);
console.log(`   Ürün sayısı: ${currentStats.count}`);
console.log(`   Toplam değer: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL\n`);

let foundCount = 0;
let missingCount = 0;
let addedCount = 0;
let errorCount = 0;
let totalAddedValue = 0;
const missingProducts = [];
const errors = [];

console.log('🔍 Kopya ürünler tespit ediliyor...\n');

// Her bir ürünü kontrol et
for (const [id, product] of Object.entries(stokListesi)) {
    // Barkod + Ad + Marka kombinasyonu ile kopya kontrolü
    const existing = db.prepare(`
        SELECT * FROM stok 
        WHERE barkod = ? AND ad = ? AND marka = ?
    `).get(
        product.barkod || '', 
        product.ad || '',
        product.marka || ''
    );

    if (existing) {
        foundCount++;
        console.log(`✅ KOPYA: ${product.barkod} - ${product.ad} (${product.marka || 'Marka yok'}) - Stokta ${existing.miktar} adet var`);
    } else {
        missingCount++;
        missingProducts.push({ ...product, original_id: id });
        console.log(`❌ YENİ: ${product.barkod} - ${product.ad} (${product.marka || 'Marka yok'})`);
    }
}

console.log('\n' + '='.repeat(80));
console.log('KOPYA ANALİZİ');
console.log('='.repeat(80));
console.log(`✅ Sistemde mevcut (kopya): ${foundCount} ürün`);
console.log(`❌ Sistemde olmayan (yeni): ${missingCount} ürün`);

if (missingCount > 0) {
    console.log(`\n🚀 ${missingCount} YENİ ÜRÜN EKLENİYOR...\n`);
    
    const insertStmt = db.prepare(`
        INSERT INTO stok 
        (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
        missingProducts.forEach((product) => {
            try {
                // Yeni ürün ID'si oluştur (orijinal ID'yi kullan veya yeni oluştur)
                const urunId = product.original_id || `urun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Tarih alanlarını kontrol et ve uygun formata çevir
                const eklenmeTarihi = product.eklenmeTarihi || new Date().toISOString();
                const guncellemeTarihi = product.guncellemeTarihi || eklenmeTarihi;
                
                insertStmt.run(
                    urunId,
                    product.barkod || '',
                    product.ad || '',
                    product.marka || '',
                    product.miktar || 0,
                    product.alisFiyati || 0,
                    product.satisFiyati || 0,
                    product.kategori || '',
                    product.aciklama || '',
                    product.varyant_id || '',
                    eklenmeTarihi,
                    guncellemeTarihi
                );
                
                addedCount++;
                totalAddedValue += (product.miktar || 0) * (product.alisFiyati || 0);
                
                console.log(`➕ EKLENDİ: ${product.barkod} - ${product.ad} (${product.marka || 'Marka yok'}) - ${product.miktar} adet`);
                
            } catch (error) {
                errorCount++;
                errors.push({ product, error: error.message });
                console.error(`❌ HATA: ${product.barkod} - ${product.ad} - ${error.message}`);
            }
        });
    });

    console.log('\n⏳ Transaction başlatılıyor...');
    
    try {
        transaction();
        console.log('✅ Transaction başarıyla tamamlandı!');
    } catch (error) {
        console.error('❌ Transaction hatası:', error.message);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('EKLEME SONUÇLARI');
    console.log('='.repeat(80));
    console.log(`🎉 Başarıyla eklenen: ${addedCount} ürün`);
    if (errorCount > 0) {
        console.log(`❌ Hata olan: ${errorCount} ürün`);
        console.log('\nHata detayları:');
        errors.forEach(({ product, error }) => {
            console.log(`  - ${product.barkod} ${product.ad}: ${error}`);
        });
    }
    console.log(`💰 Eklenen ürünlerin toplam değeri: ${totalAddedValue.toLocaleString('tr-TR')} TL`);
} else {
    console.log('\n🎉 Tüm ürünler zaten sistemde mevcut (kopya)!');
}

// Son durum
const finalStats = db.prepare(`
    SELECT 
        COUNT(*) as total_count,
        SUM(miktar * alisFiyati) as total_value,
        COUNT(DISTINCT marka) as brand_count,
        COUNT(DISTINCT barkod) as unique_barcodes
    FROM stok
`).get();

console.log('\n' + '='.repeat(80));
console.log('GÜNCEL SİSTEM DURUMU');
console.log('='.repeat(80));
console.log(`📊 Toplam ürün sayısı: ${finalStats.total_count} (önceki: ${currentStats.count})`);
console.log(`💰 Toplam stok değeri: ${(finalStats.total_value || 0).toLocaleString('tr-TR')} TL (önceki: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL)`);
console.log(`🏷️ Farklı marka sayısı: ${finalStats.brand_count}`);
console.log(`📊 Benzersiz barkod sayısı: ${finalStats.unique_barcodes}`);

const addedProductCount = finalStats.total_count - currentStats.count;
const addedValue = (finalStats.total_value || 0) - (currentStats.total_value || 0);

if (addedProductCount > 0) {
    console.log(`\n📈 DEĞİŞİM:`);
    console.log(`   +${addedProductCount} ürün eklendi`);
    console.log(`   +${addedValue.toLocaleString('tr-TR')} TL değer artışı`);
}

// Hata olan ürünleri JSON dosyasına kaydet
if (errors.length > 0) {
    const errorLog = {
        tarih: new Date().toISOString(),
        hata_sayisi: errors.length,
        hatalar: errors
    };
    
    fs.writeFileSync('import_hatalari.json', JSON.stringify(errorLog, null, 2));
    console.log('\n⚠️ Hata detayları "import_hatalari.json" dosyasına kaydedildi.');
}

db.close();

console.log('\n✅ Yedekveriler.json import işlemi tamamlandı!');