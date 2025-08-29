const Database = require('better-sqlite3');
const db = new Database('veriler/veritabani.db');

console.log('🔧 SATIŞ SİSTEMİNİ ÜRÜN ID TABANLI HALE GETİRME\n');

// 1. Mevcut satış geçmişindeki eksik urun_id'leri doldur
console.log('📊 Satış geçmişindeki eksik urun_id bilgileri dolduruluyor...');

const eksikUrunIdSatislar = db.prepare(`
    SELECT * FROM satisGecmisi 
    WHERE (urun_id IS NULL OR urun_id = '') 
    AND barkod IS NOT NULL
`).all();

console.log(`📋 Güncellenecek satış sayısı: ${eksikUrunIdSatislar.length}`);

let guncellenenSayisi = 0;
let bulunamayanSayisi = 0;

const updateStmt = db.prepare('UPDATE satisGecmisi SET urun_id = ? WHERE id = ?');

for (const satis of eksikUrunIdSatislar) {
    // Öncelik sırası: marka eşleşmesi, ad eşleşmesi, alış fiyatı eşleşmesi
    let eslenenUrun = null;
    
    // 1. Barkod + Marka eşleşmesi
    if (satis.marka) {
        eslenenUrun = db.prepare(`
            SELECT * FROM stok 
            WHERE barkod = ? AND marka = ?
            ORDER BY updated_at DESC
            LIMIT 1
        `).get(satis.barkod, satis.marka);
    }
    
    // 2. Barkod + Ürün adı eşleşmesi
    if (!eslenenUrun && satis.urunAdi) {
        eslenenUrun = db.prepare(`
            SELECT * FROM stok 
            WHERE barkod = ? AND ad = ?
            ORDER BY updated_at DESC
            LIMIT 1
        `).get(satis.barkod, satis.urunAdi);
    }
    
    // 3. Sadece barkod eşleşmesi (tek ürün varsa)
    if (!eslenenUrun) {
        const barkodEslesmeler = db.prepare(`
            SELECT * FROM stok WHERE barkod = ?
        `).all(satis.barkod);
        
        if (barkodEslesmeler.length === 1) {
            eslenenUrun = barkodEslesmeler[0];
        }
    }
    
    if (eslenenUrun && eslenenUrun.urun_id) {
        updateStmt.run(eslenenUrun.urun_id, satis.id);
        guncellenenSayisi++;
        console.log(`✅ Güncellendi: Satış ID ${satis.id} -> Ürün ID: ${eslenenUrun.urun_id}`);
    } else {
        bulunamayanSayisi++;
        console.log(`❌ Ürün bulunamadı: Satış ID ${satis.id} - ${satis.barkod} ${satis.urunAdi}`);
    }
}

console.log('\n' + '='.repeat(60));
console.log('ÖZET');
console.log('='.repeat(60));
console.log(`✅ Güncellenen satış sayısı: ${guncellenenSayisi}`);
console.log(`❌ Eşleşmeyen satış sayısı: ${bulunamayanSayisi}`);

// 2. Stok tablosundaki tüm ürünlerin urun_id'si olduğundan emin ol
console.log('\n🔍 Stok tablosundaki urun_id eksiklikleri kontrol ediliyor...');

const eksikUrunIdStoklar = db.prepare(`
    SELECT COUNT(*) as sayi FROM stok 
    WHERE urun_id IS NULL OR urun_id = ''
`).get();

if (eksikUrunIdStoklar.sayi > 0) {
    console.log(`⚠️ ${eksikUrunIdStoklar.sayi} üründe urun_id eksik!`);
    
    // Eksik olanları güncelle
    const eksikler = db.prepare(`
        SELECT * FROM stok 
        WHERE urun_id IS NULL OR urun_id = ''
    `).all();
    
    const stokUpdateStmt = db.prepare('UPDATE stok SET urun_id = ? WHERE id = ?');
    
    eksikler.forEach(urun => {
        const yeniUrunId = `urun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        stokUpdateStmt.run(yeniUrunId, urun.id);
        console.log(`➕ Ürün ID oluşturuldu: ${urun.barkod} ${urun.ad} -> ${yeniUrunId}`);
    });
} else {
    console.log('✅ Tüm ürünlerin urun_id bilgisi mevcut.');
}

// 3. Test: Aynı barkodlu farklı ürünleri göster
console.log('\n📊 Aynı barkodlu farklı ürünler (varyantlar):');
const varyantlar = db.prepare(`
    SELECT 
        barkod,
        COUNT(*) as sayi,
        GROUP_CONCAT(ad || ' (' || COALESCE(marka, 'Markasız') || ')', ', ') as urunler,
        GROUP_CONCAT(urun_id, ', ') as urun_idler
    FROM stok
    GROUP BY barkod
    HAVING COUNT(*) > 1
    ORDER BY sayi DESC
    LIMIT 10
`).all();

if (varyantlar.length > 0) {
    varyantlar.forEach(v => {
        console.log(`\nBarkod: ${v.barkod} (${v.sayi} varyant)`);
        console.log(`Ürünler: ${v.urunler}`);
        console.log(`ID'ler: ${v.urun_idler}`);
    });
} else {
    console.log('Aynı barkodlu farklı ürün bulunamadı.');
}

// 4. Satış geçmişi ve stok uyumu kontrolü
console.log('\n🔄 Satış geçmişi ve stok uyumu kontrolü:');
const uyumsuzSatislar = db.prepare(`
    SELECT 
        sg.id as satis_id,
        sg.barkod,
        sg.urunAdi,
        sg.marka as satis_marka,
        sg.urun_id,
        s.ad as stok_ad,
        s.marka as stok_marka
    FROM satisGecmisi sg
    LEFT JOIN stok s ON sg.urun_id = s.urun_id
    WHERE sg.urun_id IS NOT NULL 
    AND sg.urun_id != ''
    AND s.urun_id IS NULL
    LIMIT 5
`).all();

if (uyumsuzSatislar.length > 0) {
    console.log('⚠️ Stokta bulunmayan ürün ID\'li satışlar:');
    uyumsuzSatislar.forEach(u => {
        console.log(`  Satış ID: ${u.satis_id} | Ürün ID: ${u.urun_id} | ${u.barkod} ${u.urunAdi}`);
    });
} else {
    console.log('✅ Tüm satışlar geçerli ürün ID\'lerine sahip.');
}

db.close();

console.log('\n✅ Ürün ID güncellemesi tamamlandı!');
console.log('\n💡 ÖNEMLİ NOTLAR:');
console.log('1. Artık satışlarda mutlaka urun_id kullanılmalı');
console.log('2. Aynı barkodlu farklı ürünler urun_id ile ayırt edilebilir');
console.log('3. Frontend\'de ürün seçiminde urun_id kullanılmalı');