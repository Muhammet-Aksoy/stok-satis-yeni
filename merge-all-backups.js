const fs = require('fs');
const path = require('path');

console.log('🔄 Tüm backup dosyaları birleştiriliyor...');

// Tüm backup dosyalarını bul
const backupFiles = [];

// Ana dizindeki backup dosyaları
const mainDirFiles = fs.readdirSync(__dirname);
mainDirFiles.forEach(file => {
    if (file.includes('backup') && file.endsWith('.json')) {
        backupFiles.push(path.join(__dirname, file));
    }
});

// Veriler klasöründeki backup dosyaları
const verilerDir = path.join(__dirname, 'veriler');
if (fs.existsSync(verilerDir)) {
    const verilerFiles = fs.readdirSync(verilerDir);
    verilerFiles.forEach(file => {
        if (file.includes('backup') && file.endsWith('.json')) {
            backupFiles.push(path.join(verilerDir, file));
        }
    });
}

// Backups klasöründeki dosyalar
const backupsDir = path.join(__dirname, 'veriler', 'backups');
if (fs.existsSync(backupsDir)) {
    const backupsDirFiles = fs.readdirSync(backupsDir);
    backupsDirFiles.forEach(file => {
        if (file.endsWith('.json')) {
            backupFiles.push(path.join(backupsDir, file));
        }
    });
}

// All-backups klasöründeki dosyalar
const allBackupsDir = path.join(__dirname, 'all-backups');
if (fs.existsSync(allBackupsDir)) {
    const allBackupFiles = fs.readdirSync(allBackupsDir);
    allBackupFiles.forEach(file => {
        if (file.endsWith('.json')) {
            backupFiles.push(path.join(allBackupsDir, file));
        }
    });
}

console.log(`📁 ${backupFiles.length} backup dosyası bulundu`);

// Birleştirilmiş veri yapısı
const mergedData = {
    timestamp: new Date().toISOString(),
    version: '2.0',
    source: 'merged-all-backups',
    stokListesi: {},
    satisGecmisi: [],
    musteriler: {},
    borclarim: {}
};

let processedFiles = 0;
let errorFiles = 0;

// Her backup dosyasını işle
backupFiles.forEach((filePath, index) => {
    try {
        console.log(`🔄 İşleniyor (${index + 1}/${backupFiles.length}): ${path.basename(filePath)}`);
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let backupData;
        
        try {
            backupData = JSON.parse(fileContent);
        } catch (parseError) {
            console.warn(`⚠️ JSON parse hatası: ${path.basename(filePath)} - ${parseError.message}`);
            errorFiles++;
            return;
        }
        
        // Stok verilerini birleştir
        if (backupData.stokListesi) {
            Object.entries(backupData.stokListesi).forEach(([key, product]) => {
                if (product.barkod) {
                    // Barkod bazlı unique key oluştur
                    const uniqueKey = `${product.barkod}_${product.marka || ''}_${product.varyant_id || ''}`;
                    
                    // Eğer daha önce eklenmediyse veya daha güncel ise ekle
                    if (!mergedData.stokListesi[uniqueKey] || 
                        new Date(product.updated_at || product.created_at) > 
                        new Date(mergedData.stokListesi[uniqueKey].updated_at || mergedData.stokListesi[uniqueKey].created_at)) {
                        mergedData.stokListesi[uniqueKey] = product;
                    }
                }
            });
        }
        
        // Satış geçmişini birleştir
        if (backupData.satisGecmisi && Array.isArray(backupData.satisGecmisi)) {
            backupData.satisGecmisi.forEach(sale => {
                if (sale.barkod && sale.tarih) {
                    // Duplicate kontrolü
                    const exists = mergedData.satisGecmisi.some(existingSale => 
                        existingSale.barkod === sale.barkod &&
                        existingSale.tarih === sale.tarih &&
                        existingSale.miktar === sale.miktar &&
                        existingSale.fiyat === sale.fiyat
                    );
                    
                    if (!exists) {
                        mergedData.satisGecmisi.push(sale);
                    }
                }
            });
        }
        
        // Müşterileri birleştir
        if (backupData.musteriler) {
            Object.entries(backupData.musteriler).forEach(([key, customer]) => {
                if (customer.ad) {
                    // Ad ve telefon bazlı unique kontrolü
                    const existingKey = Object.keys(mergedData.musteriler).find(k => 
                        mergedData.musteriler[k].ad === customer.ad &&
                        mergedData.musteriler[k].telefon === customer.telefon
                    );
                    
                    if (!existingKey) {
                        mergedData.musteriler[key] = customer;
                    } else if (new Date(customer.updated_at || customer.created_at) > 
                              new Date(mergedData.musteriler[existingKey].updated_at || mergedData.musteriler[existingKey].created_at)) {
                        mergedData.musteriler[existingKey] = customer;
                    }
                }
            });
        }
        
        // Borçları birleştir
        if (backupData.borclarim) {
            Object.entries(backupData.borclarim).forEach(([key, debt]) => {
                if (debt.alacakli && debt.miktar) {
                    // Alacaklı, miktar ve tarih bazlı unique kontrolü
                    const exists = Object.values(mergedData.borclarim).some(existingDebt =>
                        existingDebt.alacakli === debt.alacakli &&
                        existingDebt.miktar === debt.miktar &&
                        existingDebt.tarih === debt.tarih
                    );
                    
                    if (!exists) {
                        mergedData.borclarim[key] = debt;
                    }
                }
            });
        }
        
        processedFiles++;
        
    } catch (error) {
        console.error(`❌ Dosya işleme hatası: ${path.basename(filePath)} - ${error.message}`);
        errorFiles++;
    }
});

// Satış geçmişini tarihe göre sırala
mergedData.satisGecmisi.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

// İstatistikleri göster
console.log('\n📊 Birleştirme İstatistikleri:');
console.log(`✅ Başarıyla işlenen dosyalar: ${processedFiles}`);
console.log(`❌ Hatalı dosyalar: ${errorFiles}`);
console.log(`📦 Toplam ürün: ${Object.keys(mergedData.stokListesi).length}`);
console.log(`💰 Toplam satış: ${mergedData.satisGecmisi.length}`);
console.log(`👥 Toplam müşteri: ${Object.keys(mergedData.musteriler).length}`);
console.log(`💳 Toplam borç: ${Object.keys(mergedData.borclarim).length}`);

// Birleştirilmiş dosyayı kaydet
const outputFile = `merged_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(outputFile, JSON.stringify(mergedData, null, 2));

console.log(`\n✅ Birleştirilmiş backup dosyası oluşturuldu: ${outputFile}`);
console.log(`📄 Dosya boyutu: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);

// Özet dosyası oluştur
const summary = {
    created: new Date().toISOString(),
    processedFiles: processedFiles,
    errorFiles: errorFiles,
    stats: {
        products: Object.keys(mergedData.stokListesi).length,
        sales: mergedData.satisGecmisi.length,
        customers: Object.keys(mergedData.musteriler).length,
        debts: Object.keys(mergedData.borclarim).length
    },
    sourceFiles: backupFiles.map(f => path.basename(f))
};

fs.writeFileSync(`merge_summary_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, JSON.stringify(summary, null, 2));

console.log('\n🎉 Birleştirme işlemi tamamlandı!');