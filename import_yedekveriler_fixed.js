const Database = require('better-sqlite3');
const fs = require('fs');

console.log('🚀 YEDEKVERİLER.JSON İÇE AKTARMA (DÜZELTİLMİŞ)\n');

// JSON dosyasını oku
const jsonData = JSON.parse(fs.readFileSync('yedekveriler.json', 'utf8'));
const yedekStokListesi = jsonData.stokListesi || {};

// Veritabanı bağlantısı
const db = new Database('veriler/veritabani.db');

console.log(`📋 Kontrol edilecek ürün sayısı: ${Object.keys(yedekStokListesi).length}`);

// Önce sistemdeki mevcut durumu öğren
const currentStats = db.prepare(`
    SELECT 
        COUNT(*) as count,
        SUM(miktar * alisFiyati) as total_value
    FROM stok
`).get();

console.log(`\n📊 İşlem öncesi sistem durumu:`);
console.log(`   Ürün sayısı: ${currentStats.count}`);
console.log(`   Toplam değer: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL\n`);

let zatenVarSayisi = 0;
let eklenenSayisi = 0;
let hataliSayisi = 0;
const eklenenUrunler = [];

// Her ürünü kontrol et
for (const [key, yedekUrun] of Object.entries(yedekStokListesi)) {
    const barkod = yedekUrun.barkod || '';
    const ad = yedekUrun.ad || '';
    const marka = yedekUrun.marka || '';
    
    if (!barkod || !ad) {
        console.log(`❌ Hatalı veri - Barkod veya ad eksik: ${key}`);
        hataliSayisi++;
        continue;
    }
    
    // Aynı barkod + ad + marka kombinasyonuna sahip ürün var mı kontrol et
    const mevcutUrun = db.prepare(`
        SELECT * FROM stok 
        WHERE barkod = ? 
        AND ad = ? 
        AND (
            (marka = ? AND ? != '') OR 
            ((marka IS NULL OR marka = '') AND ? = '')
        )
    `).get(barkod, ad, marka, marka, marka);
    
    if (mevcutUrun) {
        console.log(`✅ ZATEN VAR: ${barkod} - ${ad} (${marka || 'Markasız'})`);
        zatenVarSayisi++;
    } else {
        // Ürün yoksa ekle
        console.log(`🆕 YENİ ÜRÜN: ${barkod} - ${ad} (${marka || 'Markasız'})`);
        
        try {
            // Benzersiz ürün ID oluştur
            const urun_id = `urun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Tarih bilgilerini düzenle
            const eklenmeTarihi = yedekUrun.eklenmeTarihi || new Date().toISOString();
            const guncellemeTarihi = yedekUrun.guncellemeTarihi || eklenmeTarihi;
            
            // Ürünü ekle
            db.prepare(`
                INSERT INTO stok (
                    urun_id, barkod, ad, marka, miktar, 
                    alisFiyati, satisFiyati, kategori, aciklama, 
                    varyant_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                urun_id,
                barkod,
                ad,
                marka || null,
                parseInt(yedekUrun.miktar) || 0,
                parseFloat(yedekUrun.alisFiyati) || 0,
                parseFloat(yedekUrun.satisFiyati) || 0,
                yedekUrun.kategori || '',
                yedekUrun.aciklama || '',
                yedekUrun.varyant_id || '',
                eklenmeTarihi,
                guncellemeTarihi
            );
            
            eklenenSayisi++;
            eklenenUrunler.push({
                barkod,
                ad,
                marka: marka || 'Markasız',
                miktar: yedekUrun.miktar
            });
            
            console.log(`   ➡️ Eklendi! Miktar: ${yedekUrun.miktar}, Alış: ${yedekUrun.alisFiyati || 0} TL`);
            
        } catch (error) {
            console.log(`   ❌ HATA: ${error.message}`);
            hataliSayisi++;
        }
    }
}

// İşlem sonrası durum
const afterStats = db.prepare(`
    SELECT 
        COUNT(*) as count,
        SUM(miktar * alisFiyati) as total_value
    FROM stok
`).get();

console.log('\n' + '='.repeat(80));
console.log('ÖZET');
console.log('='.repeat(80));
console.log(`📊 Kontrol edilen ürün sayısı: ${Object.keys(yedekStokListesi).length}`);
console.log(`✅ Zaten var olan ürün sayısı: ${zatenVarSayisi}`);
console.log(`🆕 Eklenen yeni ürün sayısı: ${eklenenSayisi}`);
console.log(`❌ Hatalı veri sayısı: ${hataliSayisi}`);

console.log(`\n📊 İşlem sonrası sistem durumu:`);
console.log(`   Toplam ürün sayısı: ${afterStats.count} (${afterStats.count - currentStats.count} artış)`);
console.log(`   Toplam değer: ${(afterStats.total_value || 0).toLocaleString('tr-TR')} TL`);

if (eklenenUrunler.length > 0) {
    console.log('\n🆕 EKLENEN ÜRÜNLER:');
    console.log('-'.repeat(80));
    eklenenUrunler.forEach((urun, index) => {
        console.log(`${index + 1}. ${urun.barkod} - ${urun.ad} (${urun.marka}) - Miktar: ${urun.miktar}`);
    });
}

// Varyant kontrolü
console.log('\n📊 VARYANT KONTROLÜ:');
const varyantlar = db.prepare(`
    SELECT 
        barkod,
        COUNT(*) as sayi,
        GROUP_CONCAT(ad || ' (' || COALESCE(marka, 'Markasız') || ')', ', ') as urunler
    FROM stok
    GROUP BY barkod
    HAVING COUNT(*) > 1
    ORDER BY sayi DESC
    LIMIT 5
`).all();

if (varyantlar.length > 0) {
    console.log('Aynı barkodlu varyant ürünler:');
    varyantlar.forEach(v => {
        console.log(`- ${v.barkod}: ${v.sayi} varyant`);
        console.log(`  ${v.urunler}`);
    });
} else {
    console.log('Varyant ürün yok.');
}

db.close();

console.log('\n✅ İçe aktarma işlemi tamamlandı!');