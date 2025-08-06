const fs = require('fs-extra');
const path = require('path');
const Database = require('better-sqlite3');

console.log('🧹 Tüm veriler temizleniyor...');

// Veri dizini
const dataDir = path.join(__dirname, 'veriler');

async function clearAllData() {
    try {
        // 1. Database'i temizle
        const dbPath = path.join(dataDir, 'veritabani.db');
        if (fs.existsSync(dbPath)) {
            const db = new Database(dbPath);
            
            // Tüm tabloları temizle
            const tables = ['stok', 'satisGecmisi', 'musteriler', 'borclarim'];
            
            tables.forEach(table => {
                try {
                    db.prepare(`DELETE FROM ${table}`).run();
                    console.log(`✅ ${table} tablosu temizlendi`);
                } catch (error) {
                    console.log(`⚠️ ${table} tablosu temizlenemedi:`, error.message);
                }
            });
            
            // Database'i optimize et
            db.exec('VACUUM');
            db.exec('PRAGMA optimize');
            db.close();
            
            console.log('✅ Database temizlendi ve optimize edildi');
        }
        
        // 2. JSON dosyalarını temizle
        const jsonFiles = [
            'Data.json',
            'stok.json', 
            'satisGecmisi.json',
            'musteriler.json',
            'tumVeriler.json',
            'tumVeriler_backup.json',
            'tumVeriler_fixed_backup.json',
            'YEDEKVER?LER.json'
        ];
        
        jsonFiles.forEach(file => {
            const filePath = path.join(dataDir, file);
            if (fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, '[]');
                console.log(`✅ ${file} temizlendi`);
            }
        });
        
        // 3. Backup dosyalarını temizle
        const backupDir = path.join(dataDir, 'backups');
        if (fs.existsSync(backupDir)) {
            const backupFiles = fs.readdirSync(backupDir);
            backupFiles.forEach(file => {
                if (file.endsWith('.db') || file.endsWith('.json')) {
                    fs.removeSync(path.join(backupDir, file));
                    console.log(`🗑️ Backup dosyası silindi: ${file}`);
                }
            });
        }
        
        // 4. LocalStorage'ı temizle (frontend için)
        console.log('💡 Frontend localStorage\'ı da temizlenmeli');
        
        console.log('🎉 Tüm veriler başarıyla temizlendi!');
        console.log('📝 Sistem artık temiz durumda ve kullanıma hazır.');
        
    } catch (error) {
        console.error('❌ Veri temizleme hatası:', error);
    }
}

clearAllData(); 