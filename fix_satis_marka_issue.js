const Database = require('better-sqlite3');
const db = new Database('veriler/veritabani.db');

console.log('🔧 SATIŞ GEÇMİŞİ MARKA SORUNU DÜZELTİLİYOR\n');

// 1. Önce satisGecmisi tablosuna marka ve varyant_id kolonları ekle
console.log('📊 Mevcut satisGecmisi tablo yapısı kontrol ediliyor...');
const satisCols = db.prepare("PRAGMA table_info(satisGecmisi)").all();
const colNames = new Set(satisCols.map(c => c.name));

// Marka kolonu ekle
if (!colNames.has('marka')) {
    console.log('➕ Marka kolonu ekleniyor...');
    db.exec("ALTER TABLE satisGecmisi ADD COLUMN marka TEXT");
} else {
    console.log('✅ Marka kolonu zaten mevcut');
}

// Varyant_id kolonu ekle
if (!colNames.has('varyant_id')) {
    console.log('➕ Varyant_id kolonu ekleniyor...');
    db.exec("ALTER TABLE satisGecmisi ADD COLUMN varyant_id TEXT");
} else {
    console.log('✅ Varyant_id kolonu zaten mevcut');
}

// urun_id kolonu ekle (hangi ürünün satıldığını tam olarak bilmek için)
if (!colNames.has('urun_id')) {
    console.log('➕ Urun_id kolonu ekleniyor...');
    db.exec("ALTER TABLE satisGecmisi ADD COLUMN urun_id TEXT");
} else {
    console.log('✅ Urun_id kolonu zaten mevcut');
}

// 2. Mevcut satış kayıtlarını güncelle - stok tablosundan marka bilgisini al
console.log('\n🔄 Mevcut satış kayıtları güncelleniyor...');

const satislar = db.prepare("SELECT * FROM satisGecmisi WHERE marka IS NULL OR marka = ''").all();
console.log(`📋 Güncellenecek satış sayısı: ${satislar.length}`);

let guncellenenSayisi = 0;
let bulunamayanSayisi = 0;
let cokluUrunSayisi = 0;

const updateStmt = db.prepare('UPDATE satisGecmisi SET marka = ?, varyant_id = ?, urun_id = ? WHERE id = ?');

for (const satis of satislar) {
    // Önce barkod ve ürün adı ile eşleşen ürünleri bul
    const eslenenUrunler = db.prepare(`
        SELECT * FROM stok 
        WHERE barkod = ? 
        ORDER BY 
            CASE WHEN ad = ? THEN 0 ELSE 1 END,
            updated_at DESC
    `).all(satis.barkod, satis.urunAdi);
    
    if (eslenenUrunler.length === 0) {
        console.log(`❌ Ürün bulunamadı: ${satis.barkod} - ${satis.urunAdi}`);
        bulunamayanSayisi++;
    } else if (eslenenUrunler.length === 1) {
        // Tek ürün bulundu, direkt güncelle
        const urun = eslenenUrunler[0];
        updateStmt.run(urun.marka || '', urun.varyant_id || '', urun.urun_id || urun.id, satis.id);
        guncellenenSayisi++;
        console.log(`✅ Güncellendi: ${satis.barkod} - ${satis.urunAdi} -> Marka: ${urun.marka || 'YOK'}`);
    } else {
        // Birden fazla ürün bulundu
        console.log(`⚠️ Birden fazla ürün bulundu: ${satis.barkod} - ${satis.urunAdi}`);
        
        // Önce tam isim eşleşmesi ara
        let eslenenUrun = eslenenUrunler.find(u => u.ad === satis.urunAdi);
        
        // Eğer tam eşleşme yoksa, alış fiyatı eşleşmesi ara
        if (!eslenenUrun && satis.alisFiyati) {
            eslenenUrun = eslenenUrunler.find(u => u.alisFiyati === satis.alisFiyati);
        }
        
        // Hala bulunamadıysa ilk ürünü al (en son güncellenen)
        if (!eslenenUrun) {
            eslenenUrun = eslenenUrunler[0];
        }
        
        updateStmt.run(eslenenUrun.marka || '', eslenenUrun.varyant_id || '', eslenenUrun.urun_id || eslenenUrun.id, satis.id);
        guncellenenSayisi++;
        cokluUrunSayisi++;
        console.log(`✅ Güncellendi (çoklu): ${satis.barkod} - ${satis.urunAdi} -> Marka: ${eslenenUrun.marka || 'YOK'}`);
    }
}

console.log('\n' + '='.repeat(60));
console.log('ÖZET');
console.log('='.repeat(60));
console.log(`✅ Güncellenen satış sayısı: ${guncellenenSayisi}`);
console.log(`⚠️ Çoklu ürün eşleşmesi: ${cokluUrunSayisi}`);
console.log(`❌ Bulunamayan ürün sayısı: ${bulunamayanSayisi}`);

// 3. Güncellenmiş tablo yapısını göster
console.log('\n📊 Güncellenmiş tablo yapısı:');
const finalCols = db.prepare("PRAGMA table_info(satisGecmisi)").all();
console.log('Kolonlar:', finalCols.map(c => c.name).join(', '));

// 4. Test: Birkaç satış kaydını göster
console.log('\n🔍 Örnek güncellenmiş satış kayıtları:');
const ornekSatislar = db.prepare(`
    SELECT id, barkod, urunAdi, marka, miktar, fiyat, tarih 
    FROM satisGecmisi 
    WHERE marka IS NOT NULL AND marka != ''
    ORDER BY tarih DESC 
    LIMIT 5
`).all();

ornekSatislar.forEach(satis => {
    console.log(`  - ${satis.barkod} | ${satis.urunAdi} | Marka: ${satis.marka} | ${satis.miktar} adet`);
});

db.close();

console.log('\n✅ Satış geçmişi marka düzeltmesi tamamlandı!');
console.log('\n⚠️ ÖNEMLİ: Server.js dosyasını da güncelleyerek yeni satışlarda marka bilgisinin kaydedilmesini sağlamalısınız.');