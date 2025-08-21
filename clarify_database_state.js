const Database = require('better-sqlite3');

console.log('🔍 VERİTABANI DURUM AÇIKLAMASI\n');

// Root veritabanını kontrol et
const rootDb = new Database('veritabani.db');
const rootCount = rootDb.prepare("SELECT COUNT(*) as count FROM stok").get();
console.log('📊 ROOT VERİTABANI (veritabani.db):');
console.log(`   Ürün sayısı: ${rootCount.count}`);
rootDb.close();

// Veriler klasöründeki veritabanını kontrol et
const verilerDb = new Database('veriler/veritabani.db');
const verilerCount = verilerDb.prepare("SELECT COUNT(*) as count FROM stok").get();
console.log('\n📊 VERİLER KLASÖRÜ VERİTABANI (veriler/veritabani.db):');
console.log(`   Ürün sayısı: ${verilerCount.count}`);

// En eski ve en yeni kayıtları kontrol et
const oldestRecord = verilerDb.prepare(`
    SELECT id, barkod, ad, created_at 
    FROM stok 
    ORDER BY id ASC 
    LIMIT 1
`).get();

const newestRecord = verilerDb.prepare(`
    SELECT id, barkod, ad, created_at 
    FROM stok 
    ORDER BY id DESC 
    LIMIT 1
`).get();

console.log('\n🕐 KAYIT TARİHLERİ:');
console.log('-'.repeat(50));
console.log(`En eski kayıt: ID ${oldestRecord.id} - ${oldestRecord.created_at || 'Tarih yok'}`);
console.log(`En yeni kayıt: ID ${newestRecord.id} - ${newestRecord.created_at || 'Tarih yok'}`);

// Tarih bazında dağılım
const dateDistribution = verilerDb.prepare(`
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
    FROM stok 
    WHERE created_at IS NOT NULL
    GROUP BY DATE(created_at)
    ORDER BY date ASC
`).all();

console.log('\n📅 TARİH BAZINDA DAĞILIM:');
console.log('-'.repeat(50));
dateDistribution.forEach(entry => {
    console.log(`${entry.date}: ${entry.count} ürün`);
});

// NULL tarihli kayıtlar
const nullDateCount = verilerDb.prepare(`
    SELECT COUNT(*) as count 
    FROM stok 
    WHERE created_at IS NULL
`).get();

if (nullDateCount.count > 0) {
    console.log(`\n⚠️ ${nullDateCount.count} ürünün tarih bilgisi yok (muhtemelen orijinal veriler)`);
    
    // NULL tarihli ürünlerden örnekler
    const nullDateSamples = verilerDb.prepare(`
        SELECT id, barkod, ad, marka
        FROM stok 
        WHERE created_at IS NULL
        ORDER BY id ASC
        LIMIT 5
    `).all();
    
    console.log('\nNULL tarihli ürün örnekleri:');
    nullDateSamples.forEach((sample, index) => {
        console.log(`   ${index + 1}. ID: ${sample.id} | ${sample.barkod} - ${sample.ad} (${sample.marka || 'Marka yok'})`);
    });
}

console.log('\n🤔 DURUM AÇIKLAMASI:');
console.log('='.repeat(50));

if (verilerCount.count > 500) {
    console.log('✅ Evet, veriler/veritabani.db dosyasında zaten 500+ ürün vardı');
    console.log('📝 Benim scriptim muhtemelen root dizindeki veritabani.db dosyasını kontrol etti');
    console.log('📁 İki farklı veritabanı dosyası var:');
    console.log('   - veritabani.db (root dizinde)');
    console.log('   - veriler/veritabani.db (veriler klasöründe)');
    console.log('\n💡 Bu durumda:');
    console.log('   1. Ana veritabanı veriler/ klasöründe');
    console.log('   2. Root dizindeki muhtemelen test/geçici veritabanı');
    console.log('   3. Backup veriler zaten ana veritabanında mevcuttu');
} else {
    console.log('❓ Beklenmedik durum tespit edildi');
}

verilerDb.close();
console.log('\n✅ Açıklama tamamlandı!');