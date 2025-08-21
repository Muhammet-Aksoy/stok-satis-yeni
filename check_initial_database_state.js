const Database = require('better-sqlite3');
const fs = require('fs');

console.log('🔍 İLK VERİTABANI DURUMU ANALİZİ\n');

// Log dosyasını kontrol et
if (fs.existsSync('ekleme_log.json')) {
    const logData = JSON.parse(fs.readFileSync('ekleme_log.json', 'utf8'));
    console.log('📋 İŞLEM KAYITLARINDAN:');
    console.log('='.repeat(50));
    console.log(`İşlem tarihi: ${logData.timestamp}`);
    console.log(`İşlem öncesi ürün sayısı: ${logData.before.product_count}`);
    console.log(`İşlem öncesi toplam değer: ${logData.before.total_value?.toLocaleString('tr-TR') || 0} TL`);
    console.log(`İşlem sonrası ürün sayısı: ${logData.after.product_count}`);
    console.log(`İşlem sonrası toplam değer: ${logData.after.total_value?.toLocaleString('tr-TR') || 0} TL`);
    console.log(`Eklenen ürün sayısı: ${logData.changes.products_added}`);
    console.log(`Başarısız ürün sayısı: ${logData.changes.products_failed}`);
    console.log(`Başarı oranı: ${logData.changes.success_rate}`);
}

// Mevcut veritabanını kontrol et
const db = new Database('veriler/veritabani.db');

console.log('\n📊 MEVCUT VERİTABANI DURUMU:');
console.log('='.repeat(50));

const currentStats = db.prepare(`
    SELECT 
        COUNT(*) as total_count,
        SUM(miktar * alisFiyati) as total_value
    FROM stok
`).get();

console.log(`Şu anki ürün sayısı: ${currentStats.total_count}`);
console.log(`Şu anki toplam değer: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL`);

// En eski kayıtları kontrol et (orijinal veriler)
console.log('\n🕐 EN ESKİ KAYITLAR (İlk 10):');
console.log('='.repeat(50));

const oldestRecords = db.prepare(`
    SELECT id, barkod, ad, marka, created_at
    FROM stok 
    ORDER BY id ASC
    LIMIT 10
`).all();

oldestRecords.forEach((record, index) => {
    console.log(`${index + 1}. ID: ${record.id} | ${record.barkod} - ${record.ad} (${record.marka || 'Marka yok'})`);
    console.log(`   Tarih: ${record.created_at || 'Belirtilmemiş'}`);
});

// Tarih bazında analiz
console.log('\n📅 TARİH BAZINDA ÜRÜN DAĞILIMI:');
console.log('='.repeat(50));

const dateAnalysis = db.prepare(`
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
    FROM stok 
    WHERE created_at IS NOT NULL
    GROUP BY DATE(created_at)
    ORDER BY date ASC
`).all();

if (dateAnalysis.length > 0) {
    dateAnalysis.forEach(entry => {
        console.log(`${entry.date}: ${entry.count} ürün`);
    });
} else {
    console.log('Tarih bilgisi olmayan kayıtlar mevcut');
}

// NULL created_at olanları kontrol et
const nullDateCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM stok 
    WHERE created_at IS NULL
`).get();

if (nullDateCount.count > 0) {
    console.log(`\n⚠️ ${nullDateCount.count} ürünün tarih bilgisi yok (muhtemelen orijinal veriler)`);
}

// ID aralığı analizi
const idAnalysis = db.prepare(`
    SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(*) as total_count
    FROM stok
`).get();

console.log('\n🔢 ID ANALİZİ:');
console.log('='.repeat(50));
console.log(`En düşük ID: ${idAnalysis.min_id}`);
console.log(`En yüksek ID: ${idAnalysis.max_id}`);
console.log(`Toplam kayıt: ${idAnalysis.total_count}`);
console.log(`ID aralığı: ${idAnalysis.max_id - idAnalysis.min_id + 1}`);

if (idAnalysis.max_id - idAnalysis.min_id + 1 !== idAnalysis.total_count) {
    console.log('⚠️ ID aralığında boşluklar var (silinmiş kayıtlar olabilir)');
}

db.close();

console.log('\n✅ Analiz tamamlandı!');