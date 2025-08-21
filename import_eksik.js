const fs = require('fs');
const Database = require('better-sqlite3');

console.log('📦 Starting missing products import...');

// Read missing products
const missingData = JSON.parse(fs.readFileSync('eksik_urunler.json', 'utf8'));
const products = missingData.products || [];
console.log(`Found ${products.length} missing products`);

// Connect to database
const db = new Database('veritabani.db');

// Prepare statements
const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO stok (
        barkod, ad, marka, miktar, alisFiyati, 
        satisFiyati, kategori, aciklama, urun_id,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateStmt = db.prepare(`
    UPDATE stok SET 
        ad = COALESCE(NULLIF(?, ''), ad),
        marka = COALESCE(NULLIF(?, ''), marka),
        miktar = miktar + ?,
        alisFiyati = CASE WHEN ? > 0 THEN ? ELSE alisFiyati END,
        satisFiyati = CASE WHEN ? > 0 THEN ? ELSE satisFiyati END,
        kategori = COALESCE(NULLIF(?, ''), kategori),
        aciklama = COALESCE(NULLIF(?, ''), aciklama),
        updated_at = ?
    WHERE barkod = ?
`);

const checkStmt = db.prepare('SELECT barkod FROM stok WHERE barkod = ?');

let added = 0, updated = 0, skipped = 0;

for (const product of products) {
    if (!product.barkod || !product.barkod.trim()) {
        skipped++;
        continue;
    }
    
    const exists = checkStmt.get(product.barkod);
    const now = new Date().toISOString();
    
    try {
        if (exists) {
            const result = updateStmt.run(
                product.urun_adi || '',
                product.marka || '',
                product.stok_miktari || 0,
                product.alisFiyati || 0,
                product.alisFiyati || 0,
                product.satisFiyati || 0,
                product.satisFiyati || 0,
                product.kategori || '',
                product.aciklama || '',
                now,
                product.barkod
            );
            if (result.changes > 0) updated++;
            else skipped++;
        } else {
            const productId = `urun_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
            const result = insertStmt.run(
                product.barkod,
                product.urun_adi || '',
                product.marka || '',
                product.stok_miktari || 0,
                product.alisFiyati || 0,
                product.satisFiyati || 0,
                product.kategori || '',
                product.aciklama || '',
                product.urun_id || productId,
                product.created_at || now,
                now
            );
            if (result.changes > 0) added++;
            else skipped++;
        }
    } catch (error) {
        console.error(`Error with ${product.barkod}:`, error.message);
        skipped++;
    }
}

db.close();
console.log(`✅ Results: ${added} added, ${updated} updated, ${skipped} skipped`);
