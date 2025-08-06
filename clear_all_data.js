const fs = require('fs-extra');
const path = require('path');
const Database = require('better-sqlite3');

console.log('🗑️ Tüm veriler temizleniyor...');

try {
    // 1. Veritabanını temizle
    const dbPath = path.join(__dirname, 'veriler', 'veritabani.db');
    if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath);
        
        // Tüm tabloları temizle
        const tables = ['stok', 'satisGecmisi', 'musteriler', 'borclarim'];
        tables.forEach(table => {
            try {
                db.prepare(`DELETE FROM ${table}`).run();
                console.log(`✅ ${table} tablosu temizlendi`);
            } catch (error) {
                console.log(`⚠️ ${table} tablosu temizlenirken hata:`, error.message);
            }
        });
        
        // Veritabanını optimize et
        db.exec('VACUUM');
        db.exec('PRAGMA optimize');
        db.close();
        console.log('✅ Veritabanı temizlendi ve optimize edildi');
    }
    
    // 2. JSON dosyalarını temizle
    const jsonFiles = [
        'stok.json',
        'satisGecmisi.json', 
        'musteriler.json',
        'borclarim.json',
        'tumVeriler.json',
        'Data.json'
    ];
    
    jsonFiles.forEach(file => {
        const filePath = path.join(__dirname, 'veriler', file);
        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '{}');
            console.log(`✅ ${file} temizlendi`);
        }
    });
    
    // 3. LocalStorage temizleme için HTML dosyası oluştur
    const clearLocalStorageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>LocalStorage Temizle</title>
</head>
<body>
    <h1>LocalStorage Temizleniyor...</h1>
    <script>
        // LocalStorage'ı temizle
        localStorage.removeItem('saban_data');
        localStorage.clear();
        console.log('✅ LocalStorage temizlendi');
        alert('LocalStorage temizlendi! Bu sayfayı kapatabilirsiniz.');
    </script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(__dirname, 'clear-localstorage.html'), clearLocalStorageHTML);
    console.log('✅ LocalStorage temizleme dosyası oluşturuldu');
    
    // 4. Cache dosyalarını temizle
    const cacheFiles = [
        'veritabani.db-shm',
        'veritabani.db-wal'
    ];
    
    cacheFiles.forEach(file => {
        const filePath = path.join(__dirname, 'veriler', file);
        if (fs.existsSync(filePath)) {
            fs.removeSync(filePath);
            console.log(`✅ ${file} silindi`);
        }
    });
    
    console.log('🎉 Tüm veriler başarıyla temizlendi!');
    console.log('📝 LocalStorage temizlemek için: clear-localstorage.html dosyasını tarayıcıda açın');
    
} catch (error) {
    console.error('❌ Veri temizleme hatası:', error);
} 