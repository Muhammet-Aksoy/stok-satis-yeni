const Database = require('better-sqlite3');
const db = new Database('veriler/veritabani.db');

console.log('🔍 SATIŞ GEÇMİŞİ MARKA BİLGİLERİ TEST EDİLİYOR\n');

// 1. Satış geçmişindeki marka bilgilerini kontrol et
console.log('📊 Satış geçmişindeki marka dağılımı:');
const markaDagilimi = db.prepare(`
    SELECT 
        CASE 
            WHEN marka IS NULL OR marka = '' THEN 'MARKA YOK'
            ELSE marka
        END as marka,
        COUNT(*) as sayi
    FROM satisGecmisi
    GROUP BY marka
    ORDER BY sayi DESC
`).all();

markaDagilimi.forEach(row => {
    console.log(`  ${row.marka}: ${row.sayi} satış`);
});

// 2. Son 10 satışın detaylarını göster
console.log('\n📋 Son 10 satış (marka bilgileri ile):');
const sonSatislar = db.prepare(`
    SELECT 
        id,
        tarih,
        barkod,
        urunAdi,
        marka,
        varyant_id,
        urun_id,
        miktar,
        fiyat,
        toplam
    FROM satisGecmisi
    ORDER BY tarih DESC
    LIMIT 10
`).all();

console.log('ID  | Tarih       | Barkod      | Ürün Adı                    | Marka       | Miktar | Fiyat');
console.log('-'.repeat(100));
sonSatislar.forEach(satis => {
    const tarih = new Date(satis.tarih).toLocaleDateString('tr-TR');
    console.log(
        `${satis.id.toString().padEnd(3)} | ` +
        `${tarih.padEnd(11)} | ` +
        `${(satis.barkod || '').padEnd(11)} | ` +
        `${(satis.urunAdi || '').substring(0, 27).padEnd(27)} | ` +
        `${(satis.marka || 'YOK').padEnd(11)} | ` +
        `${satis.miktar.toString().padEnd(6)} | ` +
        `${satis.fiyat}`
    );
});

// 3. Aynı barkodlu farklı markalı ürünlerin satışlarını kontrol et
console.log('\n🔍 Aynı barkodlu farklı markalı ürün satışları:');
const ayniBarkoddakiler = db.prepare(`
    SELECT 
        barkod,
        GROUP_CONCAT(DISTINCT marka) as markalar,
        COUNT(DISTINCT marka) as marka_sayisi,
        COUNT(*) as toplam_satis
    FROM satisGecmisi
    WHERE barkod IS NOT NULL AND barkod != ''
    GROUP BY barkod
    HAVING COUNT(DISTINCT marka) > 1
    ORDER BY marka_sayisi DESC, toplam_satis DESC
    LIMIT 10
`).all();

if (ayniBarkoddakiler.length > 0) {
    ayniBarkoddakiler.forEach(row => {
        console.log(`  Barkod: ${row.barkod} | Markalar: ${row.markalar} | Toplam satış: ${row.toplam_satis}`);
    });
} else {
    console.log('  ✅ Aynı barkodlu farklı markalı satış bulunamadı.');
}

// 4. Marka bilgisi eksik olan satışları kontrol et
const markaEksikSatislar = db.prepare(`
    SELECT COUNT(*) as sayi
    FROM satisGecmisi
    WHERE marka IS NULL OR marka = ''
`).get();

console.log(`\n📊 Marka bilgisi eksik satış sayısı: ${markaEksikSatislar.sayi}`);

if (markaEksikSatislar.sayi > 0) {
    console.log('\n⚠️ Marka bilgisi eksik olan örnek satışlar:');
    const eksikOrnekler = db.prepare(`
        SELECT id, barkod, urunAdi, tarih
        FROM satisGecmisi
        WHERE marka IS NULL OR marka = ''
        LIMIT 5
    `).all();
    
    eksikOrnekler.forEach(satis => {
        console.log(`  ID: ${satis.id} | ${satis.barkod} | ${satis.urunAdi}`);
    });
}

// 5. Stok tablosu ile karşılaştırma
console.log('\n🔄 Stok tablosu ile karşılaştırma:');
const stokKarsilastirma = db.prepare(`
    SELECT 
        s.barkod,
        s.urunAdi as satis_urun,
        s.marka as satis_marka,
        st.ad as stok_urun,
        st.marka as stok_marka
    FROM satisGecmisi s
    LEFT JOIN stok st ON s.barkod = st.barkod AND s.marka = st.marka
    WHERE st.barkod IS NULL AND s.barkod IS NOT NULL
    LIMIT 5
`).all();

if (stokKarsilastirma.length > 0) {
    console.log('⚠️ Stokta bulunmayan satış kayıtları:');
    stokKarsilastirma.forEach(row => {
        console.log(`  ${row.barkod} | Satış: ${row.satis_urun} (${row.satis_marka}) | Stokta yok`);
    });
} else {
    console.log('✅ Tüm satış kayıtları stok tablosundaki ürünlerle eşleşiyor.');
}

db.close();

console.log('\n✅ Test tamamlandı!');
console.log('\n💡 Öneriler:');
console.log('1. Marka bilgisi eksik olan satışlar varsa, fix_satis_marka_issue.js scriptini tekrar çalıştırın.');
console.log('2. Yeni satışlarda marka bilgisinin doğru kaydedildiğinden emin olun.');
console.log('3. Varyant ürünlerde urun_id kullanarak doğru ürünün satıldığından emin olun.');