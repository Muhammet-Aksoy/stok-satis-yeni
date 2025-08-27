const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

// Database and files configuration
const dbFile = path.join(__dirname, 'veriler', 'veritabani.db');
const yedekVerilerFile = path.join(__dirname, 'yedekveriler.json');

console.log('🔄 Yedek verilerden eksik ürünleri import etme işlemi başlatılıyor...');

// Check if files exist
if (!fs.existsSync(yedekVerilerFile)) {
    console.error('❌ yedekveriler.json dosyası bulunamadı!');
    process.exit(1);
}

if (!fs.existsSync(dbFile)) {
    console.error('❌ veritabani.db dosyası bulunamadı!');
    process.exit(1);
}

// Read backup data
console.log('📁 Yedek veriler okunuyor...');
const yedekVeriler = JSON.parse(fs.readFileSync(yedekVerilerFile, 'utf8'));
const yedekUrunler = yedekVeriler.stokListesi || {};

console.log(`📦 Yedek verilerde ${Object.keys(yedekUrunler).length} ürün bulundu`);

// Connect to database
const db = new Database(dbFile);

// Get current products from database
console.log('🔍 Mevcut stok verisi kontrol ediliyor...');
const mevcutUrunler = db.prepare('SELECT * FROM stok').all();
console.log(`📋 Veritabanında ${mevcutUrunler.length} ürün mevcut`);

// Create barcode index for efficient lookup
const mevcutBarkodlar = new Map();
mevcutUrunler.forEach(urun => {
    if (urun.barkod) {
        if (!mevcutBarkodlar.has(urun.barkod)) {
            mevcutBarkodlar.set(urun.barkod, []);
        }
        mevcutBarkodlar.get(urun.barkod).push(urun);
    }
});

// Helper function to generate unique product ID
function generateUrunId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `urun_${timestamp}_${random}`;
}

// Helper function to generate variant ID
function generateVaryantId() {
    return Math.random().toString(36).substr(2, 8);
}

// Helper function to normalize string for comparison
function normalizeString(str) {
    if (!str) return '';
    return str.toString().trim().toLowerCase();
}

// Helper function to check if two products are the same
function areProductsSame(product1, product2) {
    const name1 = normalizeString(product1.ad || product1.urun_adi || product1.urunAdi);
    const name2 = normalizeString(product2.ad || product2.urun_adi || product2.urunAdi);
    const brand1 = normalizeString(product1.marka);
    const brand2 = normalizeString(product2.marka);
    
    return name1 === name2 && brand1 === brand2;
}

// Prepare SQL statements
const insertUrun = db.prepare(`
    INSERT INTO stok (
        urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, 
        kategori, aciklama, varyant_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const updateUrun = db.prepare(`
    UPDATE stok SET 
        miktar = miktar + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
`);

// Statistics
let stats = {
    processed: 0,
    newProducts: 0,
    variantProducts: 0,
    updatedProducts: 0,
    skippedProducts: 0,
    errors: 0
};

console.log('\n🔄 Ürün işleme başlıyor...\n');

// Process each product from backup
const transaction = db.transaction(() => {
    for (const [yedekKey, yedekUrun] of Object.entries(yedekUrunler)) {
        stats.processed++;
        
        try {
            // Skip products without barcode
            if (!yedekUrun.barkod) {
                console.log(`⏭️ Barkod eksik, atlanıyor: ${yedekUrun.ad || 'İsimsiz ürün'}`);
                stats.skippedProducts++;
                continue;
            }
            
            const yedekBarkod = yedekUrun.barkod.toString().trim();
            const yedekAd = yedekUrun.ad || yedekUrun.urun_adi || yedekUrun.urunAdi || '';
            const yedekMarka = yedekUrun.marka || '';
            const yedekMiktar = parseInt(yedekUrun.miktar) || 0;
            const yedekAlis = parseFloat(yedekUrun.alisFiyati) || 0;
            const yedekSatis = parseFloat(yedekUrun.satisFiyati) || 0;
            const yedekKategori = yedekUrun.kategori || '';
            const yedekAciklama = yedekUrun.aciklama || '';
            
            // Check if barcode exists in current database
            const mevcutUrunlerWithSameBarkod = mevcutBarkodlar.get(yedekBarkod) || [];
            
            if (mevcutUrunlerWithSameBarkod.length === 0) {
                // Barcode doesn't exist - add as new product
                const yeniUrunId = generateUrunId();
                
                insertUrun.run(
                    yeniUrunId,
                    yedekBarkod,
                    yedekAd,
                    yedekMarka,
                    yedekMiktar,
                    yedekAlis,
                    yedekSatis,
                    yedekKategori,
                    yedekAciklama,
                    null // no variant ID for new products
                );
                
                console.log(`✅ Yeni ürün eklendi: ${yedekBarkod} - ${yedekAd} (${yedekMarka})`);
                stats.newProducts++;
                
                // Add to our barcode map for future checks
                mevcutBarkodlar.set(yedekBarkod, [{ 
                    barkod: yedekBarkod, 
                    ad: yedekAd, 
                    marka: yedekMarka 
                }]);
                
            } else {
                // Barcode exists - check if it's the same product
                let exactMatch = null;
                
                for (const mevcutUrun of mevcutUrunlerWithSameBarkod) {
                    if (areProductsSame(yedekUrun, mevcutUrun)) {
                        exactMatch = mevcutUrun;
                        break;
                    }
                }
                
                if (exactMatch) {
                    // Exact same product - just update quantity if needed
                    if (yedekMiktar > 0) {
                        updateUrun.run(yedekMiktar, exactMatch.id);
                        console.log(`🔄 Miktar güncellendi: ${yedekBarkod} - ${yedekAd} (+${yedekMiktar})`);
                        stats.updatedProducts++;
                    } else {
                        console.log(`⏭️ Aynı ürün mevcut, miktar 0: ${yedekBarkod} - ${yedekAd}`);
                        stats.skippedProducts++;
                    }
                } else {
                    // Same barcode but different product - add as variant
                    const yeniUrunId = generateUrunId();
                    const varyantId = generateVaryantId();
                    
                    insertUrun.run(
                        yeniUrunId,
                        yedekBarkod,
                        yedekAd,
                        yedekMarka,
                        yedekMiktar,
                        yedekAlis,
                        yedekSatis,
                        yedekKategori,
                        yedekAciklama,
                        varyantId
                    );
                    
                    console.log(`🔀 Varyant ürün eklendi: ${yedekBarkod} - ${yedekAd} (${yedekMarka}) [Varyant: ${varyantId}]`);
                    stats.variantProducts++;
                    
                    // Add to our barcode map
                    mevcutBarkodlar.get(yedekBarkod).push({ 
                        barkod: yedekBarkod, 
                        ad: yedekAd, 
                        marka: yedekMarka 
                    });
                }
            }
            
        } catch (error) {
            console.error(`❌ Hata işlenirken: ${yedekUrun.barkod} - ${error.message}`);
            stats.errors++;
        }
        
        // Progress indicator
        if (stats.processed % 50 === 0) {
            console.log(`📊 İşlenen: ${stats.processed}/${Object.keys(yedekUrunler).length}`);
        }
    }
});

// Execute transaction
try {
    transaction();
    console.log('\n✅ İşlem başarıyla tamamlandı!\n');
} catch (error) {
    console.error('\n❌ İşlem sırasında hata oluştu:', error.message);
    process.exit(1);
}

// Close database
db.close();

// Print final statistics
console.log('📊 İşlem Özeti:');
console.log('================');
console.log(`👀 Toplam işlenen ürün: ${stats.processed}`);
console.log(`✅ Yeni ürün eklendi: ${stats.newProducts}`);
console.log(`🔀 Varyant ürün eklendi: ${stats.variantProducts}`);
console.log(`🔄 Miktar güncellendi: ${stats.updatedProducts}`);
console.log(`⏭️ Atlanan ürün: ${stats.skippedProducts}`);
console.log(`❌ Hata sayısı: ${stats.errors}`);
console.log(`\n🎯 Toplam ${stats.newProducts + stats.variantProducts} yeni ürün/varyant eklendi!`);

if (stats.errors > 0) {
    console.log('\n⚠️ Bazı ürünlerde hata oluştu. Logları kontrol edin.');
    process.exit(1);
} else {
    console.log('\n🎉 Tüm ürünler başarıyla işlendi!');
}