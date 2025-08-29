const Database = require('better-sqlite3');
const db = new Database('veriler/veritabani.db');

console.log('🔧 KOPYA ÜRÜN BİRLEŞTİRME\n');

// Kopya ürünleri bul
const kopyaUrunler = db.prepare(`
    SELECT 
        barkod,
        ad,
        marka,
        COUNT(*) as sayi,
        GROUP_CONCAT(id, ',') as idler,
        GROUP_CONCAT(urun_id, ',') as urun_idler,
        GROUP_CONCAT(miktar, ',') as miktarlar,
        MIN(id) as ana_id,
        SUM(miktar) as toplam_miktar
    FROM stok
    GROUP BY barkod, ad, LOWER(marka)
    HAVING COUNT(*) > 1
`).all();

if (kopyaUrunler.length === 0) {
    console.log('✅ Kopya ürün bulunamadı. Sistem temiz!');
    db.close();
    process.exit(0);
}

console.log(`📋 ${kopyaUrunler.length} kopya ürün grubu bulundu.\n`);

// Her kopya grubu için işlem yap
kopyaUrunler.forEach((kopya, index) => {
    console.log(`${index + 1}. İşleniyor: ${kopya.barkod} - ${kopya.ad} (${kopya.marka || 'Markasız'})`);
    
    const idListesi = kopya.idler.split(',').map(id => parseInt(id));
    const urunIdListesi = kopya.urun_idler.split(',');
    const miktarListesi = kopya.miktarlar.split(',').map(m => parseInt(m));
    
    console.log(`   Kopya sayısı: ${kopya.sayi}`);
    console.log(`   Toplam stok: ${kopya.toplam_miktar}`);
    console.log(`   Ana kayıt ID: ${kopya.ana_id}`);
    
    // Ana kaydı güncelle - toplam stok miktarını yaz
    db.prepare(`
        UPDATE stok 
        SET miktar = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `).run(kopya.toplam_miktar, kopya.ana_id);
    
    // Diğer kopyaları sil
    const silinecekIdler = idListesi.filter(id => id !== kopya.ana_id);
    
    if (silinecekIdler.length > 0) {
        // Satış geçmişindeki referansları güncelle
        const anaUrunId = urunIdListesi[0]; // Ana ürünün ID'si
        
        silinecekIdler.forEach((silinecekId, idx) => {
            const silinecekUrunId = urunIdListesi[idx + 1];
            
            // Bu ürün ID'sine sahip satışları ana ürün ID'sine yönlendir
            const guncellemeSayisi = db.prepare(`
                UPDATE satisGecmisi 
                SET urun_id = ? 
                WHERE urun_id = ?
            `).run(anaUrunId, silinecekUrunId).changes;
            
            if (guncellemeSayisi > 0) {
                console.log(`   ➡️ ${guncellemeSayisi} satış kaydı güncellendi`);
            }
            
            // Kopya kaydı sil
            db.prepare('DELETE FROM stok WHERE id = ?').run(silinecekId);
            console.log(`   ❌ Kopya silindi: ID ${silinecekId}`);
        });
    }
    
    console.log(`   ✅ Birleştirme tamamlandı\n`);
});

// Sonuç kontrolü
const kalanKopya = db.prepare(`
    SELECT COUNT(*) as sayi
    FROM (
        SELECT barkod, ad, marka, COUNT(*) as cnt
        FROM stok
        GROUP BY barkod, ad, LOWER(marka)
        HAVING COUNT(*) > 1
    )
`).get();

console.log('='.repeat(60));
console.log('ÖZET');
console.log('='.repeat(60));
console.log(`✅ ${kopyaUrunler.length} kopya ürün grubu birleştirildi`);
console.log(`📊 Kalan kopya sayısı: ${kalanKopya.sayi}`);

// İstatistikler
const stats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM stok) as toplam_urun,
        (SELECT COUNT(DISTINCT barkod) FROM stok) as benzersiz_barkod
`).get();

console.log(`\n📈 Güncel durum:`);
console.log(`   Toplam ürün: ${stats.toplam_urun}`);
console.log(`   Benzersiz barkod: ${stats.benzersiz_barkod}`);

db.close();

console.log('\n✅ Kopya ürün birleştirme işlemi tamamlandı!');