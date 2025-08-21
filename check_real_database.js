const Database = require('better-sqlite3');

const db = new Database('veriler/veritabani.db');

console.log('📊 ASIL VERİTABANI ANALİZİ (veriler/veritabani.db)\n');

// Toplam istatistikler
const stats = db.prepare(`
    SELECT 
        COUNT(*) as toplam_urun,
        SUM(miktar) as toplam_stok,
        SUM(miktar * alisFiyati) as toplam_alis_degeri,
        SUM(miktar * satisFiyati) as toplam_satis_degeri,
        COUNT(DISTINCT marka) as marka_sayisi
    FROM stok
`).get();

console.log('='.repeat(80));
console.log('GENEL İSTATİSTİKLER');
console.log('='.repeat(80));
console.log(`Toplam ürün sayısı: ${stats.toplam_urun}`);
console.log(`Toplam stok adedi: ${stats.toplam_stok}`);
console.log(`Toplam alış değeri: ${(stats.toplam_alis_degeri || 0).toLocaleString('tr-TR')} TL`);
console.log(`Toplam satış değeri: ${(stats.toplam_satis_degeri || 0).toLocaleString('tr-TR')} TL`);
console.log(`Farklı marka sayısı: ${stats.marka_sayisi}`);

// En yüksek değerli ürünler
console.log('\n' + '='.repeat(80));
console.log('EN YÜKSEK DEĞERLİ ÜRÜNLER (TOP 10)');
console.log('='.repeat(80));

const expensiveProducts = db.prepare(`
    SELECT barkod, ad, marka, miktar, alisFiyati, (miktar * alisFiyati) as toplam_deger
    FROM stok 
    ORDER BY toplam_deger DESC 
    LIMIT 10
`).all();

expensiveProducts.forEach((product, index) => {
    console.log(`${index + 1}. ${product.barkod} - ${product.ad} (${product.marka || 'Marka yok'})`);
    console.log(`   Stok: ${product.miktar}, Birim: ${product.alisFiyati} TL, Toplam: ${product.toplam_deger.toLocaleString('tr-TR')} TL\n`);
});

// Marka dağılımı
console.log('='.repeat(80));
console.log('MARKA DAĞILIMI (TOP 10)');
console.log('='.repeat(80));

const brandStats = db.prepare(`
    SELECT 
        CASE 
            WHEN marka = '' OR marka IS NULL THEN 'Marka Yok'
            ELSE marka 
        END as marka_adi,
        COUNT(*) as urun_sayisi,
        SUM(miktar * alisFiyati) as toplam_deger
    FROM stok 
    GROUP BY marka_adi
    ORDER BY toplam_deger DESC 
    LIMIT 10
`).all();

brandStats.forEach((brand, index) => {
    console.log(`${index + 1}. ${brand.marka_adi}: ${brand.urun_sayisi} ürün, ${brand.toplam_deger.toLocaleString('tr-TR')} TL`);
});

// Son eklenen ürünler
console.log('\n' + '='.repeat(80));
console.log('SON EKLENEN ÜRÜNLER (TOP 10)');
console.log('='.repeat(80));

const recentProducts = db.prepare(`
    SELECT barkod, ad, marka, miktar, alisFiyati, created_at
    FROM stok 
    ORDER BY created_at DESC 
    LIMIT 10
`).all();

recentProducts.forEach((product, index) => {
    console.log(`${index + 1}. ${product.barkod} - ${product.ad} (${product.marka || 'Marka yok'})`);
    console.log(`   Tarih: ${product.created_at || 'Belirtilmemiş'}, Stok: ${product.miktar}, Fiyat: ${product.alisFiyati} TL\n`);
});

console.log('='.repeat(80));
console.log(`ÖZET: Sistemde ${stats.toplam_urun} ürün, toplam ${(stats.toplam_alis_degeri || 0).toLocaleString('tr-TR')} TL değerinde stok mevcut`);
console.log('='.repeat(80));

db.close();