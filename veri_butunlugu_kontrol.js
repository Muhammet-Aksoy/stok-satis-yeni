const Database = require('better-sqlite3');
const db = new Database('veriler/veritabani.db');

console.log('🔍 VERİ BÜTÜNLÜĞÜ KONTROLÜ\n');
console.log('='.repeat(80));

let sorunSayisi = 0;

// 1. KOPYA ÜRÜN KONTROLÜ
console.log('\n1️⃣ KOPYA ÜRÜN KONTROLÜ');
console.log('-'.repeat(60));

// Aynı barkod + marka + ad kombinasyonuna sahip ürünler
const kopyaUrunler = db.prepare(`
    SELECT 
        barkod,
        ad,
        marka,
        COUNT(*) as sayi,
        GROUP_CONCAT(urun_id, ', ') as urun_idler,
        GROUP_CONCAT(miktar, ', ') as miktarlar,
        GROUP_CONCAT(id, ', ') as idler
    FROM stok
    GROUP BY barkod, ad, LOWER(marka)
    HAVING COUNT(*) > 1
    ORDER BY sayi DESC
`).all();

if (kopyaUrunler.length > 0) {
    console.log(`❌ ${kopyaUrunler.length} kopya ürün grubu bulundu:\n`);
    kopyaUrunler.forEach(kopya => {
        console.log(`Barkod: ${kopya.barkod}`);
        console.log(`Ad: ${kopya.ad}`);
        console.log(`Marka: ${kopya.marka || 'Markasız'}`);
        console.log(`Kopya Sayısı: ${kopya.sayi}`);
        console.log(`Ürün ID'leri: ${kopya.urun_idler}`);
        console.log(`Stok Miktarları: ${kopya.miktarlar}`);
        console.log(`Kayıt ID'leri: ${kopya.idler}`);
        console.log('-'.repeat(60));
        sorunSayisi++;
    });
} else {
    console.log('✅ Kopya ürün bulunamadı.');
}

// 2. ÜRÜN ID KONTROLÜ
console.log('\n2️⃣ ÜRÜN ID KONTROLÜ');
console.log('-'.repeat(60));

// Eksik veya boş urun_id kontrolü
const eksikUrunId = db.prepare(`
    SELECT COUNT(*) as sayi 
    FROM stok 
    WHERE urun_id IS NULL OR urun_id = ''
`).get();

if (eksikUrunId.sayi > 0) {
    console.log(`❌ ${eksikUrunId.sayi} üründe urun_id eksik!`);
    sorunSayisi++;
} else {
    console.log('✅ Tüm ürünlerin urun_id bilgisi mevcut.');
}

// Tekrar eden urun_id kontrolü
const tekrarEdenUrunId = db.prepare(`
    SELECT 
        urun_id,
        COUNT(*) as sayi,
        GROUP_CONCAT(barkod || ' - ' || ad || ' (' || COALESCE(marka, 'Markasız') || ')', ' | ') as urunler
    FROM stok
    WHERE urun_id IS NOT NULL AND urun_id != ''
    GROUP BY urun_id
    HAVING COUNT(*) > 1
`).all();

if (tekrarEdenUrunId.length > 0) {
    console.log(`❌ ${tekrarEdenUrunId.length} tekrar eden urun_id bulundu:\n`);
    tekrarEdenUrunId.forEach(tekrar => {
        console.log(`Ürün ID: ${tekrar.urun_id}`);
        console.log(`Tekrar Sayısı: ${tekrar.sayi}`);
        console.log(`Ürünler: ${tekrar.urunler}`);
        console.log('-'.repeat(60));
        sorunSayisi++;
    });
} else {
    console.log('✅ Tekrar eden urun_id yok.');
}

// 3. SATIŞ GEÇMİŞİ KONTROLÜ
console.log('\n3️⃣ SATIŞ GEÇMİŞİ KONTROLÜ');
console.log('-'.repeat(60));

// Stokta olmayan ürünlerin satışları
const stokta_olmayan_satislar = db.prepare(`
    SELECT 
        sg.id,
        sg.tarih,
        sg.barkod,
        sg.urunAdi,
        sg.marka,
        sg.urun_id,
        sg.miktar
    FROM satisGecmisi sg
    WHERE sg.urun_id IS NOT NULL 
    AND sg.urun_id != ''
    AND NOT EXISTS (
        SELECT 1 FROM stok s WHERE s.urun_id = sg.urun_id
    )
    LIMIT 10
`).all();

if (stokta_olmayan_satislar.length > 0) {
    console.log(`❌ Stokta olmayan ürün ID'li ${stokta_olmayan_satislar.length} satış bulundu:\n`);
    stokta_olmayan_satislar.forEach(satis => {
        console.log(`Satış ID: ${satis.id}`);
        console.log(`Tarih: ${new Date(satis.tarih).toLocaleDateString('tr-TR')}`);
        console.log(`Ürün: ${satis.barkod} - ${satis.urunAdi}`);
        console.log(`Ürün ID: ${satis.urun_id}`);
        console.log('-'.repeat(60));
        sorunSayisi++;
    });
} else {
    console.log('✅ Tüm satışlar geçerli ürün ID\'lerine sahip.');
}

// 4. STOK MİKTARI KONTROLÜ
console.log('\n4️⃣ STOK MİKTARI KONTROLÜ');
console.log('-'.repeat(60));

// Negatif stoklu ürünler
const negatifStok = db.prepare(`
    SELECT barkod, ad, marka, miktar, urun_id
    FROM stok
    WHERE miktar < 0
`).all();

if (negatifStok.length > 0) {
    console.log(`❌ ${negatifStok.length} negatif stoklu ürün bulundu:\n`);
    negatifStok.forEach(urun => {
        console.log(`${urun.barkod} - ${urun.ad} (${urun.marka || 'Markasız'}): ${urun.miktar}`);
    });
    sorunSayisi++;
} else {
    console.log('✅ Negatif stoklu ürün yok.');
}

// 5. SATIŞ-STOK UYUM KONTROLÜ
console.log('\n5️⃣ SATIŞ-STOK UYUM KONTROLÜ');
console.log('-'.repeat(60));

// Son 24 saatteki satışları kontrol et
const sonSatislar = db.prepare(`
    SELECT 
        sg.id,
        sg.barkod,
        sg.urunAdi,
        sg.marka,
        sg.urun_id,
        sg.miktar as satis_miktar,
        s.miktar as stok_miktar,
        s.ad as stok_ad,
        s.marka as stok_marka
    FROM satisGecmisi sg
    LEFT JOIN stok s ON sg.urun_id = s.urun_id
    WHERE sg.tarih > datetime('now', '-1 day')
    AND sg.urun_id IS NOT NULL
    ORDER BY sg.tarih DESC
    LIMIT 10
`).all();

console.log(`Son 24 saatteki ${sonSatislar.length} satış kontrolü:`);
let uyumsuzSatis = 0;

sonSatislar.forEach(satis => {
    if (!satis.stok_miktar && satis.stok_miktar !== 0) {
        console.log(`❌ Satış ID ${satis.id}: Stok kaydı bulunamadı (Ürün ID: ${satis.urun_id})`);
        uyumsuzSatis++;
    } else if (satis.stok_marka !== satis.marka) {
        console.log(`⚠️ Satış ID ${satis.id}: Marka uyumsuzluğu - Satış: "${satis.marka}", Stok: "${satis.stok_marka}"`);
    }
});

if (uyumsuzSatis === 0) {
    console.log('✅ Son satışlar stok kayıtlarıyla uyumlu.');
} else {
    sorunSayisi++;
}

// 6. İADE TEST KONTROLÜ
console.log('\n6️⃣ İADE SONRASI KOPYA KONTROLÜ');
console.log('-'.repeat(60));

// Son iadeler
const sonIadeler = db.prepare(`
    SELECT COUNT(*) as iade_sayisi
    FROM satisGecmisi
    WHERE tarih < datetime('now', '-1 day')
`).get();

console.log(`Toplam eski satış sayısı: ${sonIadeler.iade_sayisi}`);
console.log('💡 İade yapıldığında yeni ürün oluşturulmadığından emin olmak için:');
console.log('   1. Bir satış yapın');
console.log('   2. Satışı iade edin');
console.log('   3. Bu scripti tekrar çalıştırın');
console.log('   4. Kopya ürün oluşmadığını kontrol edin');

// ÖZET
console.log('\n' + '='.repeat(80));
console.log('📊 ÖZET');
console.log('='.repeat(80));

if (sorunSayisi === 0) {
    console.log('✅ VERİ BÜTÜNLÜĞÜ SAĞLAM - Hiçbir sorun bulunamadı!');
} else {
    console.log(`❌ TOPLAM ${sorunSayisi} SORUN TESPİT EDİLDİ!`);
    console.log('\n🔧 ÖNERİLER:');
    
    if (kopyaUrunler.length > 0) {
        console.log('- Kopya ürünleri birleştirmek için manuel kontrol gerekli');
    }
    if (eksikUrunId.sayi > 0) {
        console.log('- Eksik urun_id\'leri doldurmak için update_satis_urun_id.js çalıştırın');
    }
    if (tekrarEdenUrunId.length > 0) {
        console.log('- Tekrar eden urun_id\'ler için veritabanı düzeltmesi gerekli');
    }
}

// İstatistikler
console.log('\n📈 GENEL İSTATİSTİKLER:');
const stats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM stok) as toplam_urun,
        (SELECT COUNT(DISTINCT barkod) FROM stok) as benzersiz_barkod,
        (SELECT COUNT(*) FROM stok WHERE miktar > 0) as stokta_olan,
        (SELECT COUNT(*) FROM stok WHERE miktar = 0) as stok_biten,
        (SELECT COUNT(*) FROM satisGecmisi) as toplam_satis,
        (SELECT COUNT(DISTINCT urun_id) FROM satisGecmisi WHERE urun_id IS NOT NULL) as satilan_urun_cesidi
`).get();

console.log(`Toplam Ürün: ${stats.toplam_urun}`);
console.log(`Benzersiz Barkod: ${stats.benzersiz_barkod}`);
console.log(`Stokta Olan: ${stats.stokta_olan}`);
console.log(`Stoku Biten: ${stats.stok_biten}`);
console.log(`Toplam Satış: ${stats.toplam_satis}`);
console.log(`Satılan Ürün Çeşidi: ${stats.satilan_urun_cesidi}`);

db.close();

console.log('\n✅ Veri bütünlüğü kontrolü tamamlandı!');