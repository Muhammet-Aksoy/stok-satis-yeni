const Database = require('better-sqlite3');
const fs = require('fs');

console.log('🚀 MEVCUT JSON DOSYASINDAN EKSİK ÜRÜN İMPORT İŞLEMİ\n');

// JSON dosyasını oku
let stokData;
try {
    const jsonContent = fs.readFileSync('veriler/stok.json', 'utf8');
    stokData = JSON.parse(jsonContent);
    console.log(`📋 stok.json dosyasındaki ürün sayısı: ${Object.keys(stokData).length}`);
} catch (error) {
    console.error('❌ stok.json dosyası okunamadı:', error.message);
    process.exit(1);
}

const db = new Database('veriler/veritabani.db');

// Önce sistemdeki mevcut durumu öğren
const currentStats = db.prepare(`
    SELECT 
        COUNT(*) as count,
        SUM(miktar * alisFiyati) as total_value
    FROM stok
`).get();

console.log(`📊 İşlem öncesi sistem durumu:`);
console.log(`   Ürün sayısı: ${currentStats.count}`);
console.log(`   Toplam değer: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL\n`);

let foundCount = 0;
let missingCount = 0;
const missingProducts = [];

console.log('🔍 Eksik ürünler tespit ediliyor...\n');

for (const [key, product] of Object.entries(stokData)) {
    // Composite key ile kontrol et (barkod + marka)
    const existing = db.prepare(`
        SELECT * FROM stok 
        WHERE barkod = ? AND marka = ?
    `).get(
        product.barkod, 
        product.marka || ''
    );

    if (existing) {
        foundCount++;
    } else {
        missingCount++;
        missingProducts.push(product);
        if (missingCount <= 20) {
            console.log(`❌ EKSİK: ${product.barkod} - ${product.urun_adi} (${product.marka || 'Marka yok'})`);
        } else if (missingCount === 21) {
            console.log(`❌ ... ve daha fazla eksik ürün tespit ediliyor...`);
        }
    }
    
    // Her 100 üründe bir ilerleme göster
    if ((foundCount + missingCount) % 100 === 0) {
        console.log(`⏳ İlerleme: ${foundCount + missingCount}/${Object.keys(stokData).length} ürün kontrol edildi...`);
    }
}

console.log('\n' + '='.repeat(80));
console.log('EKSİK ÜRÜN ANALİZİ');
console.log('='.repeat(80));
console.log(`✅ Sistemde mevcut: ${foundCount} ürün`);
console.log(`❌ Eksik olan: ${missingCount} ürün`);

if (missingCount > 0) {
    console.log(`\n🚀 ${missingCount} EKSİK ÜRÜN EKLENİYOR...\n`);
    
    const insertStmt = db.prepare(`
        INSERT INTO stok 
        (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const transaction = db.transaction(() => {
        let addedCount = 0;
        let totalValue = 0;
        let errorCount = 0;
        
        missingProducts.forEach((product, index) => {
            try {
                // Eğer urun_id yoksa oluştur
                const urunId = product.urun_id || `urun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                insertStmt.run(
                    urunId,
                    product.barkod,
                    product.urun_adi || product.ad,
                    product.marka || '',
                    product.stok_miktari || product.miktar || 0,
                    product.alisFiyati || 0,
                    product.satisFiyati || 0,
                    product.kategori || '',
                    product.aciklama || '',
                    product.varyant_id || ''
                );
                addedCount++;
                totalValue += (product.stok_miktari || product.miktar || 0) * (product.alisFiyati || 0);
                
                if (addedCount <= 10) {
                    console.log(`➕ EKLENDİ: ${product.barkod} - ${product.urun_adi || product.ad} (${product.marka || 'Marka yok'})`);
                } else if (addedCount === 11) {
                    console.log(`➕ ... devam ediyor (${missingProducts.length} ürün işleniyor)...`);
                }
                
                if (addedCount % 50 === 0) {
                    console.log(`⏳ İlerleme: ${addedCount}/${missingProducts.length} ürün eklendi...`);
                }
            } catch (error) {
                errorCount++;
                if (errorCount <= 5) {
                    console.error(`❌ HATA: ${product.barkod} - ${error.message}`);
                } else if (errorCount === 6) {
                    console.error(`❌ ... ve daha fazla hata (toplam ${errorCount} hata)`);
                }
            }
        });
        
        return { addedCount, totalValue, errorCount };
    });

    console.log('⏳ Transaction başlatılıyor...');
    const result = transaction();
    
    console.log('\n' + '='.repeat(80));
    console.log('EKLEME SONUÇLARI');
    console.log('='.repeat(80));
    console.log(`🎉 Başarıyla eklenen: ${result.addedCount} ürün`);
    if (result.errorCount > 0) {
        console.log(`❌ Hata olan: ${result.errorCount} ürün`);
    }
    console.log(`💰 Eklenen ürünlerin toplam değeri: ${result.totalValue.toLocaleString('tr-TR')} TL`);
} else {
    console.log('\n🎉 Kontrol edilen tüm ürünler zaten sistemde mevcut!');
}

// Son durum
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
}

db.close();

console.log('\n✅ JSON import işlemi tamamlandı!');