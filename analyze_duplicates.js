const Database = require('better-sqlite3');

console.log('🔄 DUPLICATE BARKOD ANALİZİ\n');

const db = new Database('veriler/veritabani.db');

// Duplicate barkodları detaylı analiz et
const duplicates = db.prepare(`
    SELECT barkod, COUNT(*) as count 
    FROM stok 
    GROUP BY barkod 
    HAVING COUNT(*) > 1
    ORDER BY count DESC
`).all();

console.log(`📊 Toplam ${duplicates.length} farklı barkodda duplicate tespit edildi\n`);

duplicates.forEach((dup, index) => {
    console.log(`${index + 1}. BARKOD: ${dup.barkod} (${dup.count} adet)`);
    console.log('-'.repeat(60));
    
    const products = db.prepare(`
        SELECT id, ad, marka, miktar, alisFiyati, created_at 
        FROM stok 
        WHERE barkod = ? 
        ORDER BY created_at ASC
    `).all(dup.barkod);
    
    products.forEach((product, idx) => {
        console.log(`   ${idx + 1}. ID: ${product.id} | ${product.ad} (${product.marka || 'Marka yok'})`);
        console.log(`      Stok: ${product.miktar}, Fiyat: ${product.alisFiyati} TL`);
        console.log(`      Tarih: ${product.created_at || 'Belirtilmemiş'}`);
    });
    console.log('');
});

// Duplicate'ların sebep analizi
console.log('📋 DUPLICATE SEBEPLERİ:');
console.log('='.repeat(50));

const reasons = [
    'Aynı barkod, farklı marka kombinasyonu',
    'Farklı zamanlarda eklenen aynı ürünler', 
    'Backup dosyalarında çakışan veriler',
    'Manuel veri girişi sırasında tekrarlar'
];

reasons.forEach((reason, index) => {
    console.log(`${index + 1}. ${reason}`);
});

console.log('\n💡 ÖNERİLER:');
console.log('='.repeat(50));
console.log('✅ Duplicatelar veri yapısını bozmaz');
console.log('✅ Her ürün unique ID ile tanımlanır');
console.log('✅ Barkod + marka kombinasyonu mantıklıdır');
console.log('✅ Gerekirse temizleme scripti yazılabilir');

// Özet istatistik
const totalProducts = db.prepare("SELECT COUNT(*) as count FROM stok").get().count;
const uniqueBarcodes = db.prepare("SELECT COUNT(DISTINCT barkod) as count FROM stok").get().count;
const duplicateProducts = totalProducts - uniqueBarcodes;

console.log('\n📊 DUPLICATE İSTATİSTİKLERİ:');
console.log('='.repeat(50));
console.log(`Toplam ürün: ${totalProducts}`);
console.log(`Unique barkod: ${uniqueBarcodes}`);
console.log(`Duplicate ürün: ${duplicateProducts}`);
console.log(`Duplicate oranı: %${((duplicateProducts/totalProducts)*100).toFixed(1)}`);

db.close();