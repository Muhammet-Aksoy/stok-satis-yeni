const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

// Read the missing products file
const missingProductsFile = path.join(__dirname, 'eksik_urunler.json');
const dbFile = path.join(__dirname, 'veritabani.db');

if (!fs.existsSync(missingProductsFile)) {
    console.error('❌ eksik_urunler.json file not found!');
    process.exit(1);
}

if (!fs.existsSync(dbFile)) {
    console.error('❌ veritabani.db file not found!');
    process.exit(1);
}

// Read the missing products
const missingProductsData = JSON.parse(fs.readFileSync(missingProductsFile, 'utf8'));
const missingProducts = missingProductsData.products || [];

console.log(`📦 Found ${missingProducts.length} missing products to add`);

// Connect to database
const db = new Database(dbFile);

// Prepare the insert statement
const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO stok (
        barkod, ad, marka, miktar, alisFiyati, 
        satisFiyati, kategori, aciklama, urun_id, varyant_id,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Prepare update statement for existing products
const updateProduct = db.prepare(`
    UPDATE stok SET 
        ad = COALESCE(NULLIF(?, ''), ad),
        marka = COALESCE(NULLIF(?, ''), marka),
        miktar = miktar + ?,
        alisFiyati = CASE WHEN ? > 0 THEN ? ELSE alisFiyati END,
        satisFiyati = CASE WHEN ? > 0 THEN ? ELSE satisFiyati END,
        kategori = COALESCE(NULLIF(?, ''), kategori),
        aciklama = COALESCE(NULLIF(?, ''), aciklama),
        urun_id = COALESCE(NULLIF(?, ''), urun_id),
        varyant_id = COALESCE(NULLIF(?, ''), varyant_id),
        updated_at = ?
    WHERE barkod = ?
`);

// Check if product exists
const checkProduct = db.prepare('SELECT * FROM stok WHERE barkod = ?');

let addedCount = 0;
let updatedCount = 0;
let skippedCount = 0;

console.log('🔄 Starting to process missing products...');

// Process each missing product
for (const product of missingProducts) {
    try {
        // Skip if no barcode
        if (!product.barkod || product.barkod.trim() === '') {
            console.log(`⚠️ Skipping product without barcode: ${product.urun_adi || 'Unknown'}`);
            skippedCount++;
            continue;
        }

        const existingProduct = checkProduct.get(product.barkod);
        const currentTime = new Date().toISOString();

        if (existingProduct) {
            // Update existing product
            const result = updateProduct.run(
                product.urun_adi || '',
                product.marka || '',
                product.stok_miktari || 0,
                product.alisFiyati || 0,
                product.alisFiyati || 0,
                product.satisFiyati || 0,
                product.satisFiyati || 0,
                product.kategori || '',
                product.aciklama || '',
                product.urun_id || '',
                product.varyant_id || '',
                currentTime,
                product.barkod
            );
            
            if (result.changes > 0) {
                console.log(`🔄 Updated: ${product.barkod} - ${product.urun_adi || 'Unknown'}`);
                updatedCount++;
            } else {
                skippedCount++;
            }
        } else {
            // Add new product
            const result = insertProduct.run(
                product.barkod,
                product.urun_adi || '',
                product.marka || '',
                product.stok_miktari || 0,
                product.alisFiyati || 0,
                product.satisFiyati || 0,
                product.kategori || '',
                product.aciklama || '',
                product.urun_id || generateProductId(),
                product.varyant_id || '',
                product.created_at || currentTime,
                currentTime
            );
            
            if (result.changes > 0) {
                console.log(`➕ Added: ${product.barkod} - ${product.urun_adi || 'Unknown'}`);
                addedCount++;
            } else {
                console.log(`⚠️ Failed to add: ${product.barkod} - ${product.urun_adi || 'Unknown'}`);
                skippedCount++;
            }
        }
    } catch (error) {
        console.error(`❌ Error processing product ${product.barkod}:`, error.message);
        skippedCount++;
    }
}

// Close database
db.close();

console.log('\n📊 Summary:');
console.log(`✅ Added: ${addedCount} products`);
console.log(`🔄 Updated: ${updatedCount} products`);
console.log(`⚠️ Skipped: ${skippedCount} products`);
console.log(`📦 Total processed: ${addedCount + updatedCount + skippedCount} products`);

// Generate a unique product ID
function generateProductId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `urun_${timestamp}_${random}`;
}

console.log('\n✅ Missing products import completed!');