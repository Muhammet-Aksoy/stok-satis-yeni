const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

// Database path
const dbPath = path.join(__dirname, 'veriler', 'veritabani.db');

async function fixBarcodeConstraint() {
    try {
        console.log('🔧 Starting barcode constraint fix...');
        
        // Check if database exists
        if (!fs.existsSync(dbPath)) {
            console.log('✅ Database does not exist, no migration needed');
            return;
        }
        
        // Open database
        const db = new Database(dbPath);
        console.log('✅ Database connected:', dbPath);
        
        // Check if UNIQUE constraint exists on barkod column
        const tableInfo = db.prepare("PRAGMA table_info(stok)").all();
        const barkodColumn = tableInfo.find(col => col.name === 'barkod');
        
        if (!barkodColumn) {
            console.log('⚠️ Barkod column not found, skipping migration');
            return;
        }
        
        console.log('📊 Current barkod column info:', barkodColumn);
        
        // Check if UNIQUE constraint exists
        const indexes = db.prepare("PRAGMA index_list(stok)").all();
        const uniqueIndexes = db.prepare("PRAGMA index_info(stok)").all();
        
        console.log('📋 Current indexes:', indexes);
        
        // Create new table without UNIQUE constraint
        console.log('🔄 Creating new table structure...');
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS stok_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barkod TEXT NOT NULL,
                ad TEXT NOT NULL,
                marka TEXT,
                miktar INTEGER DEFAULT 0,
                alisFiyati REAL DEFAULT 0,
                satisFiyati REAL DEFAULT 0,
                kategori TEXT,
                aciklama TEXT,
                varyant_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Copy data from old table to new table
        console.log('📦 Copying data to new table...');
        db.exec(`
            INSERT INTO stok_new (id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at)
            SELECT id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at
            FROM stok
        `);
        
        // Drop old table
        console.log('🗑️ Dropping old table...');
        db.exec('DROP TABLE stok');
        
        // Rename new table to original name
        console.log('🔄 Renaming new table...');
        db.exec('ALTER TABLE stok_new RENAME TO stok');
        
        // Create indices for better performance
        console.log('📊 Creating indices...');
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_stok_barkod ON stok(barkod);
            CREATE INDEX IF NOT EXISTS idx_stok_marka ON stok(marka);
            CREATE INDEX IF NOT EXISTS idx_stok_kategori ON stok(kategori);
        `);
        
        // Verify the fix
        const newTableInfo = db.prepare("PRAGMA table_info(stok)").all();
        const newBarkodColumn = newTableInfo.find(col => col.name === 'barkod');
        
        console.log('✅ New barkod column info:', newBarkodColumn);
        
        // Test inserting duplicate barcodes
        console.log('🧪 Testing duplicate barcode insertion...');
        try {
            db.exec(`
                INSERT INTO stok (barkod, ad, marka, miktar, alisFiyati, satisFiyati)
                VALUES ('TEST123', 'Test Product 1', 'Test Brand', 10, 5.00, 10.00)
            `);
            
            db.exec(`
                INSERT INTO stok (barkod, ad, marka, miktar, alisFiyati, satisFiyati)
                VALUES ('TEST123', 'Test Product 2', 'Test Brand', 5, 3.00, 8.00)
            `);
            
            console.log('✅ Successfully inserted duplicate barcodes');
            
            // Clean up test data
            db.exec("DELETE FROM stok WHERE barkod = 'TEST123'");
            console.log('🧹 Cleaned up test data');
            
        } catch (error) {
            console.error('❌ Failed to insert duplicate barcodes:', error.message);
        }
        
        console.log('✅ Barcode constraint fix completed successfully!');
        console.log('📊 Database now supports multiple products with the same barcode');
        
    } catch (error) {
        console.error('❌ Error during barcode constraint fix:', error);
        throw error;
    }
}

// Run the migration
if (require.main === module) {
    fixBarcodeConstraint()
        .then(() => {
            console.log('🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { fixBarcodeConstraint };