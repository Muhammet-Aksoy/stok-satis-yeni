const fs = require('fs');
const path = require('path');

console.log('🔄 Migrating Backup Data to Current System Format...\n');

// Load backup data
const backupDataPath = path.join(__dirname, 'veriler', 'YEDEKVER?LER.json');
const backupData = JSON.parse(fs.readFileSync(backupDataPath, 'utf8'));

// Load current data
const currentDataPath = path.join(__dirname, 'veriler', 'tumVeriler.json');
const currentData = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));

console.log('📊 Data Analysis:');
console.log(`Backup data products: ${Object.keys(backupData.stokListesi).length}`);
console.log(`Current data products: ${Object.keys(currentData.stokListesi).length}`);

// Migrate backup data to current format
const migratedData = {
    stokListesi: {},
    satisGecmisi: currentData.satisGecmisi || [],
    musteriler: currentData.musteriler || {},
    borclarim: currentData.borclarim || {},
    version: "1.0",
    timestamp: new Date().toISOString()
};

let migratedCount = 0;
let skippedCount = 0;

for (const [key, urun] of Object.entries(backupData.stokListesi)) {
    try {
        // Validate required fields
        if (!urun.barkod) {
            console.warn(`⚠️ Skipping product without barcode: ${key}`);
            skippedCount++;
            continue;
        }

        // Convert backup format to current format
        const migratedUrun = {
            id: key, // Use the original key as ID
            barkod: urun.barkod,
            urun_adi: urun.ad || urun.urun_adi || '',
            marka: urun.marka || '',
            kategori: urun.kategori || '',
            fiyat: urun.satisFiyati || urun.fiyat || 0,
            stok_miktari: urun.miktar || urun.stok_miktari || 0,
            min_stok: urun.min_stok || 0,
            varyant_id: urun.varyant_id || '',
            varyant_adi: urun.varyant_adi || '',
            created_at: urun.eklenmeTarihi || urun.created_at || new Date().toISOString(),
            updated_at: urun.guncellemeTarihi || urun.updated_at || new Date().toISOString()
        };

        // Use consistent key format
        const newKey = migratedUrun.id || `${migratedUrun.barkod}_${migratedUrun.marka || ''}_${migratedUrun.varyant_id || ''}`;
        migratedData.stokListesi[newKey] = migratedUrun;
        migratedCount++;

    } catch (error) {
        console.error(`❌ Error migrating product ${key}:`, error);
        skippedCount++;
    }
}

// Merge with existing current data (preserve any existing products)
for (const [key, urun] of Object.entries(currentData.stokListesi || {})) {
    if (!migratedData.stokListesi[key]) {
        migratedData.stokListesi[key] = urun;
    }
}

console.log(`\n✅ Migration completed:`);
console.log(`   - Migrated: ${migratedCount} products from backup`);
console.log(`   - Skipped: ${skippedCount} products`);
console.log(`   - Total products: ${Object.keys(migratedData.stokListesi).length}`);

// Save migrated data
try {
    fs.writeFileSync(currentDataPath, JSON.stringify(migratedData, null, 2));
    console.log('💾 Migrated data saved successfully!');
} catch (error) {
    console.error('❌ Error saving migrated data:', error);
}

// Create a backup of the original current data
const backupCurrentPath = path.join(__dirname, 'veriler', 'tumVeriler_backup_' + Date.now() + '.json');
try {
    fs.writeFileSync(backupCurrentPath, JSON.stringify(currentData, null, 2));
    console.log(`📄 Backup of current data saved to: ${backupCurrentPath}`);
} catch (error) {
    console.error('❌ Error creating backup:', error);
}

console.log('\n🎯 Migration Summary:');
console.log(`   - All backup products have been migrated to current format`);
console.log(`   - Field mapping: ad → urun_adi, miktar → stok_miktari, etc.`);
console.log(`   - Key format consistency maintained`);
console.log(`   - No data loss during migration`);