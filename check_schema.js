const Database = require('better-sqlite3');
const db = new Database('veritabani.db');

console.log('🔍 Checking database schema...');

// Get stok table schema
const stokSchema = db.prepare("PRAGMA table_info(stok)").all();
console.log('\n📊 Stok table columns:');
stokSchema.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

// Get satisGecmisi table schema
const satisSchema = db.prepare("PRAGMA table_info(satisGecmisi)").all();
console.log('\n📊 SatisGecmisi table columns:');
satisSchema.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

// Check sample data
const sampleStok = db.prepare("SELECT * FROM stok LIMIT 3").all();
console.log('\n📦 Sample stok data:');
console.log(sampleStok);

db.close();