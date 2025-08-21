const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🔍 TÜM YEDEK DOSYALARINDAN EKSİK ÜRÜN ANALİZİ\n');

// Tüm backup dizinlerini tanımla
const backupDirectories = [
    'veriler',
    'backups',
    'all-backups',
    'backup_jsons'
];

// JSON dosyalarını bul
function findJsonFiles(dir) {
    const files = [];
    try {
        if (!fs.existsSync(dir)) {
            console.log(`⚠️ ${dir} dizini bulunamadı`);
            return files;
        }
        
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isFile() && item.endsWith('.json') && !item.includes('.db')) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        console.log(`⚠️ ${dir} dizini okunamadı: ${error.message}`);
    }
    return files;
}

// Tüm JSON dosyalarını topla
let allJsonFiles = [];
backupDirectories.forEach(dir => {
    const files = findJsonFiles(dir);
    allJsonFiles = allJsonFiles.concat(files);
});

console.log(`📁 Toplam ${allJsonFiles.length} JSON dosyası bulundu:`);
allJsonFiles.forEach((file, index) => {
    const stats = fs.statSync(file);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   ${index + 1}. ${file} (${sizeMB} MB)`);
});

// Veritabanına bağlan
const db = new Database('veritabani.db');

// Mevcut sistemdeki ürünleri al
console.log('\n📊 Mevcut sistem durumu kontrol ediliyor...');
const currentProducts = new Map();
const existingProducts = db.prepare('SELECT barkod, marka FROM stok').all();

existingProducts.forEach(product => {
    const key = `${product.barkod}|${product.marka || ''}`;
    currentProducts.set(key, true);
});

console.log(`✅ Sistemde ${existingProducts.length} ürün mevcut`);

// Tüm backup dosyalarından ürünleri topla
const allBackupProducts = new Map();
let totalProcessedFiles = 0;
let totalProductsFound = 0;

console.log('\n🔄 Backup dosyaları işleniyor...\n');

for (const jsonFile of allJsonFiles) {
    try {
        console.log(`📄 İşleniyor: ${path.basename(jsonFile)}`);
        
        const content = fs.readFileSync(jsonFile, 'utf8');
        let data;
        
        try {
            data = JSON.parse(content);
        } catch (parseError) {
            console.log(`   ⚠️ JSON parse hatası: ${parseError.message}`);
            continue;
        }
        
        let products = [];
        
        // Farklı JSON formatlarını handle et
        if (data.stokListesi) {
            // Sabancioglu backup format veya normal format
            if (typeof data.stokListesi === 'object') {
                products = Object.values(data.stokListesi);
            }
        } else if (Array.isArray(data)) {
            products = data;
        } else if (typeof data === 'object') {
            // Direct object format
            products = Object.values(data);
        }
        
        let fileProductCount = 0;
        products.forEach(product => {
            if (product && (product.barkod || product.urun_adi || product.ad)) {
                const barkod = product.barkod || '';
                const marka = product.marka || '';
                const urunAdi = product.urun_adi || product.ad || '';
                
                if (barkod || urunAdi) {
                    const key = `${barkod}|${marka}`;
                    
                    // Ürün bilgilerini sakla (en son bulunanı kullan)
                    allBackupProducts.set(key, {
                        barkod: barkod,
                        urun_adi: urunAdi,
                        marka: marka,
                        stok_miktari: product.stok_miktari || product.miktar || 0,
                        alisFiyati: product.alisFiyati || 0,
                        satisFiyati: product.satisFiyati || 0,
                        kategori: product.kategori || '',
                        aciklama: product.aciklama || '',
                        urun_id: product.urun_id || '',
                        varyant_id: product.varyant_id || '',
                        created_at: product.created_at || '',
                        updated_at: product.updated_at || '',
                        source_file: path.basename(jsonFile)
                    });
                    fileProductCount++;
                }
            }
        });
        
        console.log(`   ✅ ${fileProductCount} ürün bulundu`);
        totalProductsFound += fileProductCount;
        totalProcessedFiles++;
        
    } catch (error) {
        console.log(`   ❌ Hata: ${error.message}`);
    }
}

console.log('\n' + '='.repeat(80));
console.log('BACKUP ANALİZ SONUÇLARI');
console.log('='.repeat(80));
console.log(`📁 İşlenen dosya sayısı: ${totalProcessedFiles}/${allJsonFiles.length}`);
console.log(`📦 Backup'larda bulunan toplam ürün: ${allBackupProducts.size} (unique)`);
console.log(`🏪 Sistemde mevcut ürün: ${currentProducts.size}`);

// Eksik ürünleri tespit et
const missingProducts = [];
for (const [key, product] of allBackupProducts) {
    if (!currentProducts.has(key)) {
        missingProducts.push(product);
    }
}

console.log(`❌ Eksik ürün sayısı: ${missingProducts.length}`);

if (missingProducts.length > 0) {
    console.log('\n🔍 İLK 20 EKSİK ÜRÜN:');
    console.log('-'.repeat(80));
    
    missingProducts.slice(0, 20).forEach((product, index) => {
        console.log(`${index + 1}. ${product.barkod} - ${product.urun_adi} (${product.marka || 'Marka yok'})`);
        console.log(`   Kaynak: ${product.source_file} | Stok: ${product.stok_miktari} | Fiyat: ${product.alisFiyati} TL`);
    });
    
    if (missingProducts.length > 20) {
        console.log(`   ... ve ${missingProducts.length - 20} ürün daha`);
    }
    
    // Eksik ürünleri kaydet
    const missingProductsJson = {
        timestamp: new Date().toISOString(),
        total_missing: missingProducts.length,
        products: missingProducts
    };
    
    fs.writeFileSync('eksik_urunler.json', JSON.stringify(missingProductsJson, null, 2), 'utf8');
    console.log(`\n💾 Eksik ürünler 'eksik_urunler.json' dosyasına kaydedildi`);
    
    // Marka bazında analiz
    const brandAnalysis = {};
    missingProducts.forEach(product => {
        const brand = product.marka || 'Marka Yok';
        if (!brandAnalysis[brand]) {
            brandAnalysis[brand] = 0;
        }
        brandAnalysis[brand]++;
    });
    
    console.log('\n📊 MARKA BAZINDA EKSİK ÜRÜN ANALİZİ:');
    console.log('-'.repeat(50));
    Object.entries(brandAnalysis)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([brand, count]) => {
            console.log(`${brand}: ${count} ürün`);
        });
    
    // Kullanıcıya ekleme seçeneği sun
    console.log('\n' + '='.repeat(80));
    console.log('🚀 EKSİK ÜRÜNLERİ SİSTEME EKLEMEK İSTER MİSİNİZ?');
    console.log('='.repeat(80));
    console.log(`Bu işlem ${missingProducts.length} ürünü sisteme ekleyecektir.`);
    console.log('Devam etmek için: node add_missing_products.js');
    
} else {
    console.log('\n🎉 Tüm backup ürünleri sistemde mevcut!');
}

db.close();
console.log('\n✅ Analiz tamamlandı!');