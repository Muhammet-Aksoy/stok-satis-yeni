const Database = require('better-sqlite3');
const path = require('path');

try {
    const dbPath = path.join(__dirname, 'veriler', 'veritabani.db');
    console.log('Testing database at:', dbPath);
    
    const db = new Database(dbPath);
    
    // Check tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Available tables:', tables.map(t => t.name));
    
    // Check stok table
    if (tables.some(t => t.name === 'stok')) {
        const stokCount = db.prepare('SELECT COUNT(*) as count FROM stok').get().count;
        console.log('Stok count:', stokCount);
        
        if (stokCount > 0) {
            const sampleStok = db.prepare('SELECT * FROM stok LIMIT 1').get();
            console.log('Sample stok record:', sampleStok);
        }
    }
    
    // Check musteriler table
    if (tables.some(t => t.name === 'musteriler')) {
        const musteriCount = db.prepare('SELECT COUNT(*) as count FROM musteriler').get().count;
        console.log('Musteri count:', musteriCount);
    }
    
    // Check satisGecmisi table
    if (tables.some(t => t.name === 'satisGecmisi')) {
        const satisCount = db.prepare('SELECT COUNT(*) as count FROM satisGecmisi').get().count;
        console.log('Satis count:', satisCount);
    }
    
    db.close();
    console.log('Database test completed successfully');
    
} catch (error) {
    console.error('Database test failed:', error.message);
    process.exit(1);
}