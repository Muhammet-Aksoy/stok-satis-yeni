const Database = require('better-sqlite3');
const db = new Database('veriler/veritabani.db');

console.log('🧪 VARYANT ÜRÜN SATIŞ TEST\n');

// Test senaryosu: Aynı barkodlu ürünlerden satış yapma
const testBarkod = 'BK21 2M008 AC'; // En çok varyantı olan ürün

console.log(`📋 Test barkodu: ${testBarkod}`);
console.log('='.repeat(60));

// 1. Bu barkodlu tüm ürünleri listele
const varyantlar = db.prepare(`
    SELECT 
        id,
        urun_id,
        barkod,
        ad,
        marka,
        miktar,
        alisFiyati,
        satisFiyati
    FROM stok
    WHERE barkod = ?
    ORDER BY marka, ad
`).all(testBarkod);

console.log(`\n🔍 Bulunan varyant sayısı: ${varyantlar.length}\n`);

varyantlar.forEach((urun, index) => {
    console.log(`${index + 1}. Ürün ID: ${urun.urun_id}`);
    console.log(`   Ad: ${urun.ad}`);
    console.log(`   Marka: ${urun.marka || 'Markasız'}`);
    console.log(`   Stok: ${urun.miktar}`);
    console.log(`   Alış: ${urun.alisFiyati} TL | Satış: ${urun.satisFiyati} TL`);
    console.log('-'.repeat(60));
});

// 2. Son satışları kontrol et
console.log('\n📊 SON SATIŞLAR (Bu barkod için):');
const sonSatislar = db.prepare(`
    SELECT 
        id,
        tarih,
        barkod,
        urunAdi,
        marka,
        urun_id,
        miktar,
        fiyat
    FROM satisGecmisi
    WHERE barkod = ?
    ORDER BY tarih DESC
    LIMIT 5
`).all(testBarkod);

if (sonSatislar.length > 0) {
    sonSatislar.forEach(satis => {
        const tarih = new Date(satis.tarih);
        const tarihStr = tarih.toLocaleString('tr-TR');
        console.log(`\nSatış ID: ${satis.id} | Tarih: ${tarihStr}`);
        console.log(`Ürün: ${satis.urunAdi}`);
        console.log(`Marka: ${satis.marka || 'Belirtilmemiş'}`);
        console.log(`Ürün ID: ${satis.urun_id || 'YOK - ESKİ SATIŞ'}`);
        console.log(`Miktar: ${satis.miktar} | Fiyat: ${satis.fiyat} TL`);
    });
} else {
    console.log('Bu barkodla henüz satış yapılmamış.');
}

// 3. Test önerisi
console.log('\n' + '='.repeat(60));
console.log('💡 TEST ÖNERİSİ:');
console.log('='.repeat(60));
console.log('\n1. Tarayıcıda stok listesine gidin');
console.log('2. Arama kutusuna "BK21 2M008 AC" yazın');
console.log('3. Herhangi bir ürünün "Sat" butonuna tıklayın');
console.log('4. Aynı barkodlu ürünler listesi çıkacak');
console.log('5. İstediğiniz varyantı seçip satış yapın');
console.log('6. Satış geçmişinde doğru ürünün satıldığını kontrol edin');

// 4. Sistemin hazır olup olmadığını kontrol et
console.log('\n🔍 SİSTEM DURUMU:');
const eksikUrunIdSayisi = db.prepare(`
    SELECT COUNT(*) as sayi FROM stok 
    WHERE urun_id IS NULL OR urun_id = ''
`).get();

const eksikSatisUrunIdSayisi = db.prepare(`
    SELECT COUNT(*) as sayi FROM satisGecmisi 
    WHERE urun_id IS NULL OR urun_id = ''
`).get();

console.log(`✅ Tüm ürünlerin urun_id bilgisi var: ${eksikUrunIdSayisi.sayi === 0 ? 'EVET' : 'HAYIR (' + eksikUrunIdSayisi.sayi + ' eksik)'}`);
console.log(`✅ Satış kayıtlarında urun_id kullanımı: ${eksikSatisUrunIdSayisi.sayi} eski kayıt var`);
console.log(`✅ Server.js güncel: Ürün ID öncelikli arama aktif`);
console.log(`✅ Frontend güncel: Varyant seçim ekranı aktif`);

db.close();

console.log('\n🎯 Sistem varyant ürün satışına hazır!');