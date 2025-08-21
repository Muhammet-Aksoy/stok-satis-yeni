const Database = require('better-sqlite3');

const db = new Database('veritabani.db');

console.log('📊 SİSTEMDEKİ MEVCUT ÜRÜNLER\n');

// Toplam sayı
const totalCount = db.prepare('SELECT COUNT(*) as count FROM stok').get();
console.log(`Toplam ürün sayısı: ${totalCount.count}\n`);

// Mevcut ürünleri listele
const products = db.prepare('SELECT barkod, ad, marka, miktar FROM stok ORDER BY barkod').all();

console.log('Mevcut ürünler:');
console.log('='.repeat(80));

products.forEach((product, index) => {
    console.log(`${index + 1}. ${product.barkod} - ${product.ad} (${product.marka || 'Marka yok'}) - Stok: ${product.miktar}`);
});

console.log('\n' + '='.repeat(80));
console.log(`ÖZET: Sistemde toplam ${totalCount.count} ürün mevcut`);

db.close();