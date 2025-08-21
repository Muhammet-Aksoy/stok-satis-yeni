const Database = require('better-sqlite3');

console.log('🧪 Testing complete sales flow...');

const db = new Database('veritabani.db');

// First, let's add a test sale to the database
console.log('➕ Adding a test sale...');
const insertSale = db.prepare(`
    INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, tarih, musteriId, musteriAdi, toplam, alisFiyati, borc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const testSale = {
    barkod: 'TEST123',
    urunAdi: 'Test Ürün',
    miktar: 1,
    fiyat: 10.50,
    tarih: new Date().toISOString(),
    musteriId: 'test_musteri',
    musteriAdi: 'Test Müşteri',
    toplam: 10.50,
    alisFiyati: 5.00,
    borc: 0,
    created_at: new Date().toISOString()
};

const insertResult = insertSale.run(
    testSale.barkod,
    testSale.urunAdi,
    testSale.miktar,
    testSale.fiyat,
    testSale.tarih,
    testSale.musteriId,
    testSale.musteriAdi,
    testSale.toplam,
    testSale.alisFiyati,
    testSale.borc,
    testSale.created_at
);

console.log(`✅ Test sale inserted with ID: ${insertResult.lastInsertRowid}`);

// Now test the delete
const saleId = insertResult.lastInsertRowid;
console.log(`🗑️ Testing delete for sale ID: ${saleId}`);

const deleteStmt = db.prepare('DELETE FROM satisGecmisi WHERE id = ?');
const deleteResult = deleteStmt.run(saleId);

console.log(`Delete result - changes: ${deleteResult.changes}`);

// Verify deletion
const checkStmt = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?');
const afterDelete = checkStmt.get(saleId);

console.log(`Record after delete:`, afterDelete ? 'STILL EXISTS (ERROR!)' : 'SUCCESSFULLY DELETED');

// Check all sales
const allSales = db.prepare('SELECT COUNT(*) as count FROM satisGecmisi').get();
console.log(`Total sales in database: ${allSales.count}`);

db.close();
console.log('🏁 Sales flow test completed');
