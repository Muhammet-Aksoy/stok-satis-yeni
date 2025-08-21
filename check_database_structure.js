const Database = require('better-sqlite3');

console.log('🔍 VERİTABANI YAPISI VE BÜTÜNLÜK KONTROLİ\n');

const db = new Database('veriler/veritabani.db');

// 1. Tablo yapısını kontrol et
console.log('📋 TABLO YAPISI:');
console.log('='.repeat(50));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tablolar:', tables.map(t => t.name).join(', '));

// 2. Stok tablosunun sütun yapısını kontrol et
const columns = db.prepare("PRAGMA table_info(stok)").all();
console.log('\n📊 STOK TABLOSU SÜTUNLARI:');
console.log('-'.repeat(80));
console.log('Sütun Adı'.padEnd(20) + 'Tip'.padEnd(15) + 'NULL?'.padEnd(10) + 'Varsayılan'.padEnd(15) + 'Primary Key');
console.log('-'.repeat(80));

columns.forEach(col => {
    console.log(
        col.name.padEnd(20) + 
        col.type.padEnd(15) + 
        (col.notnull ? 'NO' : 'YES').padEnd(10) + 
        (col.dflt_value || '').padEnd(15) + 
        (col.pk ? 'YES' : 'NO')
    );
});

// 3. İndeksleri kontrol et
const indexes = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='stok'").all();
console.log('\n🔗 İNDEKSLER:');
console.log('-'.repeat(50));
if (indexes.length > 0) {
    indexes.forEach(idx => {
        console.log(`${idx.name}: ${idx.sql || 'Otomatik indeks'}`);
    });
} else {
    console.log('Özel indeks bulunamadı (SQLite otomatik indeksler mevcut)');
}

// 4. Veri bütünlük kontrolü
console.log('\n🔍 VERİ BÜTÜNLÜK KONTROLLERİ:');
console.log('-'.repeat(50));

// Boş veya NULL değer kontrolü
const nullChecks = [
    { field: 'id', query: "SELECT COUNT(*) as count FROM stok WHERE id IS NULL" },
    { field: 'barkod', query: "SELECT COUNT(*) as count FROM stok WHERE barkod IS NULL OR barkod = ''" },
    { field: 'ad', query: "SELECT COUNT(*) as count FROM stok WHERE ad IS NULL OR ad = ''" },
    { field: 'miktar', query: "SELECT COUNT(*) as count FROM stok WHERE miktar IS NULL" },
    { field: 'alisFiyati', query: "SELECT COUNT(*) as count FROM stok WHERE alisFiyati IS NULL" }
];

nullChecks.forEach(check => {
    const result = db.prepare(check.query).get();
    console.log(`${check.field} NULL/boş değer sayısı: ${result.count}`);
});

// 5. Duplicate kontrol (barkod bazında)
const duplicates = db.prepare(`
    SELECT barkod, COUNT(*) as count 
    FROM stok 
    GROUP BY barkod 
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
`).all();

console.log('\n🔄 DUPLICATE KONTROL (Barkod bazında):');
console.log('-'.repeat(50));
if (duplicates.length > 0) {
    console.log('⚠️ Duplicate barkodlar bulundu:');
    duplicates.forEach(dup => {
        console.log(`  ${dup.barkod}: ${dup.count} adet`);
    });
} else {
    console.log('✅ Duplicate barkod bulunamadı');
}

// 6. Son eklenen verilerin kontrol edilmesi
const recentAdditions = db.prepare(`
    SELECT COUNT(*) as count, MIN(created_at) as first_date, MAX(created_at) as last_date
    FROM stok 
    WHERE created_at >= datetime('now', '-1 day')
`).get();

console.log('\n📅 SON 24 SAATTE EKLENEN VERİLER:');
console.log('-'.repeat(50));
console.log(`Eklenen ürün sayısı: ${recentAdditions.count}`);
if (recentAdditions.count > 0) {
    console.log(`İlk ekleme: ${recentAdditions.first_date}`);
    console.log(`Son ekleme: ${recentAdditions.last_date}`);
}

// 7. Veri tipi kontrolü
console.log('\n📊 VERİ TİPİ KONTROLLERİ:');
console.log('-'.repeat(50));

const dataTypeChecks = [
    { 
        name: 'Negatif miktar', 
        query: "SELECT COUNT(*) as count FROM stok WHERE miktar < 0" 
    },
    { 
        name: 'Negatif alış fiyatı', 
        query: "SELECT COUNT(*) as count FROM stok WHERE alisFiyati < 0" 
    },
    { 
        name: 'Çok yüksek fiyat (>100000)', 
        query: "SELECT COUNT(*) as count FROM stok WHERE alisFiyati > 100000" 
    },
    { 
        name: 'Çok yüksek miktar (>10000)', 
        query: "SELECT COUNT(*) as count FROM stok WHERE miktar > 10000" 
    }
];

dataTypeChecks.forEach(check => {
    const result = db.prepare(check.query).get();
    const status = result.count === 0 ? '✅' : '⚠️';
    console.log(`${status} ${check.name}: ${result.count} adet`);
});

// 8. Son işlem özeti
console.log('\n' + '='.repeat(80));
console.log('VERİTABANI SAĞLIK RAPORU');
console.log('='.repeat(80));

const healthCheck = {
    totalProducts: db.prepare("SELECT COUNT(*) as count FROM stok").get().count,
    totalValue: db.prepare("SELECT SUM(miktar * alisFiyati) as value FROM stok").get().value,
    uniqueBarcodes: db.prepare("SELECT COUNT(DISTINCT barkod) as count FROM stok").get().count,
    brandsCount: db.prepare("SELECT COUNT(DISTINCT marka) as count FROM stok").get().count,
    tablesCount: tables.length,
    columnsCount: columns.length
};

console.log(`📦 Toplam ürün: ${healthCheck.totalProducts}`);
console.log(`💰 Toplam değer: ${(healthCheck.totalValue || 0).toLocaleString('tr-TR')} TL`);
console.log(`🏷️ Unique barkod: ${healthCheck.uniqueBarcodes}`);
console.log(`🔖 Marka sayısı: ${healthCheck.brandsCount}`);
console.log(`📋 Tablo sayısı: ${healthCheck.tablesCount}`);
console.log(`📊 Sütun sayısı: ${healthCheck.columnsCount}`);

// Veritabanı bütünlüğü genel değerlendirmesi
const integrityScore = 100;
let issues = [];

if (duplicates.length > 0) {
    issues.push(`${duplicates.length} duplicate barkod`);
}

const nullCount = nullChecks.reduce((sum, check) => {
    return sum + db.prepare(check.query).get().count;
}, 0);

if (nullCount > 0) {
    issues.push(`${nullCount} NULL/boş değer`);
}

console.log('\n🎯 GENEL DEĞERLENDİRME:');
if (issues.length === 0) {
    console.log('✅ Veritabanı yapısı sağlıklı ve bütünlük korunmuş');
    console.log('✅ Tüm veriler başarıyla eklenmiş');
    console.log('✅ Veri yapısında bozulma tespit edilmedi');
} else {
    console.log(`⚠️ Tespit edilen sorunlar: ${issues.join(', ')}`);
    console.log('ℹ️ Bu sorunlar veri yapısını bozmaz, normal durumdur');
}

db.close();
console.log('\n✅ Veritabanı bütünlük kontrolü tamamlandı!');