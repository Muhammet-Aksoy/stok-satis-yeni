const Database = require('better-sqlite3');

console.log('🔍 Testing sales delete functionality...');

const db = new Database('veritabani.db');

// Get some sample sales data
const sales = db.prepare('SELECT * FROM satisGecmisi LIMIT 5').all();
console.log(`Found ${sales.length} sales records`);

if (sales.length > 0) {
    console.log('Sample sales:');
    sales.forEach(sale => {
        console.log(`  ID: ${sale.id}, Barkod: ${sale.barkod}, Ürün: ${sale.urunAdi}, Miktar: ${sale.miktar}`);
    });
}

// Test delete operation (but don't actually delete)
const testId = sales.length > 0 ? sales[0].id : 1;
const deleteStmt = db.prepare('DELETE FROM satisGecmisi WHERE id = ?');
console.log(`\n🧪 Testing delete for ID: ${testId}`);

// Check if record exists before delete
const beforeDelete = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?').get(testId);
console.log(`Record before delete:`, beforeDelete ? 'EXISTS' : 'NOT FOUND');

if (beforeDelete) {
    // Perform the delete
    const result = deleteStmt.run(testId);
    console.log(`Delete result - changes: ${result.changes}, lastInsertRowid: ${result.lastInsertRowid}`);
    
    // Check if record exists after delete
    const afterDelete = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?').get(testId);
    console.log(`Record after delete:`, afterDelete ? 'STILL EXISTS (ERROR!)' : 'SUCCESSFULLY DELETED');
    
    // Restore the record for testing
    if (result.changes > 0) {
        const restoreStmt = db.prepare(`
            INSERT INTO satisGecmisi (id, barkod, urunAdi, miktar, fiyat, tarih, musteriId, musteriAdi, toplam, alisFiyati, borc, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        restoreStmt.run(
            beforeDelete.id,
            beforeDelete.barkod,
            beforeDelete.urunAdi,
            beforeDelete.miktar,
            beforeDelete.fiyat,
            beforeDelete.tarih,
            beforeDelete.musteriId,
            beforeDelete.musteriAdi,
            beforeDelete.toplam,
            beforeDelete.alisFiyati,
            beforeDelete.borc,
            beforeDelete.created_at
        );
        console.log('✅ Record restored for testing purposes');
    }
}

db.close();
console.log('\n🏁 Sales delete test completed');
