const Database = require('better-sqlite3');
const fs = require('fs');

console.log('🚀 EKSİK ÜRÜNLERİ SİSTEME EKLEME İŞLEMİ\n');

// Eksik ürünler dosyasını kontrol et
if (!fs.existsSync('eksik_urunler.json')) {
    console.error('❌ eksik_urunler.json dosyası bulunamadı!');
    console.log('Önce: node analyze_all_backups.js komutunu çalıştırın.');
    process.exit(1);
}

// Eksik ürünleri oku
let missingData;
try {
    const content = fs.readFileSync('eksik_urunler.json', 'utf8');
    missingData = JSON.parse(content);
    console.log(`📋 ${missingData.total_missing} eksik ürün yüklenecek`);
} catch (error) {
    console.error('❌ eksik_urunler.json dosyası okunamadı:', error.message);
    process.exit(1);
}

if (missingData.total_missing === 0) {
    console.log('🎉 Eklenecek ürün yok!');
    process.exit(0);
}

// Veritabanına bağlan
const db = new Database('veritabani.db');

// Mevcut durumu kontrol et
const currentStats = db.prepare(`
    SELECT 
        COUNT(*) as count,
        SUM(miktar * alisFiyati) as total_value
    FROM stok
`).get();

console.log(`📊 İşlem öncesi sistem durumu:`);
console.log(`   Ürün sayısı: ${currentStats.count}`);
console.log(`   Toplam değer: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL\n`);

// Insert statement'ını hazırla
const insertStmt = db.prepare(`
    INSERT INTO stok 
    (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

console.log('🔄 Ürünler ekleniyor...\n');

// Transaction ile toplu ekleme
const transaction = db.transaction(() => {
    let addedCount = 0;
    let errorCount = 0;
    let totalValue = 0;
    const errors = [];
    
    missingData.products.forEach((product, index) => {
        try {
            // Unique urun_id oluştur
            const urunId = product.urun_id || `urun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Ürünü ekle
            insertStmt.run(
                urunId,
                product.barkod || '',
                product.urun_adi || '',
                product.marka || '',
                product.stok_miktari || 0,
                product.alisFiyati || 0,
                product.satisFiyati || 0,
                product.kategori || '',
                product.aciklama || '',
                product.varyant_id || ''
            );
            
            addedCount++;
            totalValue += (product.stok_miktari || 0) * (product.alisFiyati || 0);
            
            // İlk 10 ürünü göster
            if (addedCount <= 10) {
                console.log(`➕ ${addedCount}. ${product.barkod} - ${product.urun_adi} (${product.marka || 'Marka yok'})`);
                console.log(`   Kaynak: ${product.source_file} | Stok: ${product.stok_miktari} | Fiyat: ${product.alisFiyati} TL`);
            } else if (addedCount === 11) {
                console.log(`➕ ... devam ediyor (${missingData.total_missing} ürün işleniyor)...`);
            }
            
            // Her 100 üründe ilerleme göster
            if (addedCount % 100 === 0) {
                console.log(`⏳ İlerleme: ${addedCount}/${missingData.total_missing} ürün eklendi (${((addedCount/missingData.total_missing)*100).toFixed(1)}%)`);
            }
            
        } catch (error) {
            errorCount++;
            const errorMsg = `${product.barkod} - ${error.message}`;
            errors.push(errorMsg);
            
            if (errorCount <= 5) {
                console.error(`❌ HATA ${errorCount}: ${errorMsg}`);
            } else if (errorCount === 6) {
                console.error(`❌ ... ve daha fazla hata (toplam ${errorCount} hata)`);
            }
        }
    });
    
    return { addedCount, errorCount, totalValue, errors };
});

console.log('\n⏳ Transaction başlatılıyor...');
const result = transaction();

console.log('\n' + '='.repeat(80));
console.log('EKLEME SONUÇLARI');
console.log('='.repeat(80));
console.log(`🎉 Başarıyla eklenen: ${result.addedCount} ürün`);
console.log(`❌ Hata olan: ${result.errorCount} ürün`);
console.log(`💰 Eklenen ürünlerin toplam değeri: ${result.totalValue.toLocaleString('tr-TR')} TL`);

if (result.errorCount > 0) {
    console.log('\n📝 HATA RAPORU:');
    result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
    });
    if (result.errors.length > 10) {
        console.log(`   ... ve ${result.errors.length - 10} hata daha`);
    }
    
    // Hataları dosyaya kaydet
    fs.writeFileSync('ekleme_hatalari.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        total_errors: result.errorCount,
        errors: result.errors
    }, null, 2), 'utf8');
    console.log('💾 Tüm hatalar ekleme_hatalari.json dosyasına kaydedildi');
}

// Son durumu kontrol et
const finalStats = db.prepare(`
    SELECT 
        COUNT(*) as total_count,
        SUM(miktar * alisFiyati) as total_value,
        COUNT(DISTINCT marka) as brand_count
    FROM stok
`).get();

console.log('\n' + '='.repeat(80));
console.log('GÜNCEL SİSTEM DURUMU');
console.log('='.repeat(80));
console.log(`📊 Toplam ürün sayısı: ${finalStats.total_count} (önceki: ${currentStats.count})`);
console.log(`💰 Toplam stok değeri: ${(finalStats.total_value || 0).toLocaleString('tr-TR')} TL (önceki: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL)`);
console.log(`🏷️ Farklı marka sayısı: ${finalStats.brand_count}`);

const addedProductCount = finalStats.total_count - currentStats.count;
const addedValue = (finalStats.total_value || 0) - (currentStats.total_value || 0);

if (addedProductCount > 0) {
    console.log(`\n📈 DEĞİŞİM:`);
    console.log(`   +${addedProductCount} ürün eklendi`);
    console.log(`   +${addedValue.toLocaleString('tr-TR')} TL değer artışı`);
    
    // Başarı oranı
    const successRate = ((result.addedCount / missingData.total_missing) * 100).toFixed(1);
    console.log(`   %${successRate} başarı oranı`);
}

// Log dosyası oluştur
const logData = {
    timestamp: new Date().toISOString(),
    operation: 'add_missing_products',
    before: {
        product_count: currentStats.count,
        total_value: currentStats.total_value || 0
    },
    after: {
        product_count: finalStats.total_count,
        total_value: finalStats.total_value || 0,
        brand_count: finalStats.brand_count
    },
    changes: {
        products_added: result.addedCount,
        products_failed: result.errorCount,
        value_added: addedValue,
        success_rate: ((result.addedCount / missingData.total_missing) * 100).toFixed(1) + '%'
    },
    source_files_processed: [...new Set(missingData.products.map(p => p.source_file))].length
};

fs.writeFileSync('ekleme_log.json', JSON.stringify(logData, null, 2), 'utf8');
console.log('\n💾 İşlem detayları ekleme_log.json dosyasına kaydedildi');

db.close();
console.log('\n✅ Eksik ürün ekleme işlemi tamamlandı!');