const Database = require('better-sqlite3');

console.log('🔍 Checking existing sales...');

const db = new Database('veritabani.db');

// Check existing sales
const salesCount = db.prepare('SELECT COUNT(*) as count FROM satisGecmisi').get();
console.log(`📊 Total sales in database: ${salesCount.count}`);

if (salesCount.count > 0) {
    const recentSales = db.prepare('SELECT * FROM satisGecmisi ORDER BY id DESC LIMIT 5').all();
    console.log('\n📋 Recent sales:');
    recentSales.forEach(sale => {
        console.log(`  ID: ${sale.id}, Barkod: ${sale.barkod}, Ürün: ${sale.urunAdi}, Miktar: ${sale.miktar}`);
    });
    
    // Test delete with existing record
    if (recentSales.length > 0) {
        const testId = recentSales[0].id;
        console.log(`\n🧪 Testing delete with existing record ID: ${testId}`);
        
        // First backup the record
        const backup = recentSales[0];
        
        // Delete it
        const deleteStmt = db.prepare('DELETE FROM satisGecmisi WHERE id = ?');
        const deleteResult = deleteStmt.run(testId);
        console.log(`Delete result - changes: ${deleteResult.changes}`);
        
        // Check if deleted
        const checkStmt = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?');
        const afterDelete = checkStmt.get(testId);
        console.log(`Record after delete:`, afterDelete ? 'STILL EXISTS (ERROR!)' : 'SUCCESSFULLY DELETED');
        
        // Restore the record
        const restoreStmt = db.prepare(`
            INSERT INTO satisGecmisi (id, barkod, urunAdi, miktar, fiyat, tarih, musteriId, musteriAdi, toplam, alisFiyati, borc, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        try {
            restoreStmt.run(
                backup.id,
                backup.barkod,
                backup.urunAdi,
                backup.miktar,
                backup.fiyat,
                backup.tarih,
                backup.musteriId,
                backup.musteriAdi,
                backup.toplam,
                backup.alisFiyati,
                backup.borc,
                backup.created_at
            );
            console.log('✅ Record restored');
        } catch (error) {
            console.log('⚠️ Could not restore record:', error.message);
        }
    }
} else {
    console.log('ℹ️  No existing sales records found');
}

db.close();
console.log('\n🏁 Sales check completed');
