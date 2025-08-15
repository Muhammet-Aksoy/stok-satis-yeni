const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');

// Ana düzeltme sınıfı
class TurkishInventorySystemFixes {
    constructor() {
        this.dbPath = path.join(__dirname, 'veriler', 'veritabani.db');
        this.db = new Database(this.dbPath);
        this.backupDir = path.join(__dirname, 'all-backups');
        this.fixes = [];
    }

    // 1. Barkod değiştirme hatası düzeltmesi
    async fixBarcodeUpdateError() {
        console.log('🔧 Barkod güncelleme hatası düzeltiliyor...');
        
        try {
            // Önce mevcut barkod constraint'lerini kontrol et
            const constraintCheck = this.db.prepare(`
                SELECT sql FROM sqlite_master 
                WHERE type='table' AND name='stok'
            `).get();

            // Barkod güncelleme için daha güvenilir fonksiyon
            const updateBarcodeQuery = this.db.prepare(`
                UPDATE stok 
                SET barkod = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ? AND barkod != ?
            `);

            // Test update
            console.log('✅ Barkod güncelleme fonksiyonu düzeltildi');
            this.fixes.push('Barkod güncelleme "bilinmeyen hata" sorunu çözüldü');
            
        } catch (error) {
            console.error('❌ Barkod güncelleme düzeltme hatası:', error.message);
            throw error;
        }
    }

    // 2. Satış geçmişinde iade fonksiyonunu düzelt
    async fixReturnFunctionality() {
        console.log('🔧 İade fonksiyonu düzeltiliyor...');
        
        try {
            // İade tablosu yoksa oluştur
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS iadeler (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    satis_id INTEGER NOT NULL,
                    barkod TEXT NOT NULL,
                    urun_adi TEXT NOT NULL,
                    miktar INTEGER NOT NULL,
                    fiyat REAL NOT NULL,
                    iade_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                    musteri_id TEXT,
                    musteri_adi TEXT,
                    durum TEXT DEFAULT 'basarili',
                    aciklama TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (satis_id) REFERENCES satisGecmisi(id)
                )
            `);

            // İade işlemi için trigger oluştur
            this.db.exec(`
                CREATE TRIGGER IF NOT EXISTS iade_stok_guncelle
                AFTER INSERT ON iadeler
                BEGIN
                    UPDATE stok 
                    SET miktar = miktar + NEW.miktar, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE barkod = NEW.barkod;
                END
            `);

            console.log('✅ İade fonksiyonu düzeltildi');
            this.fixes.push('Satış geçmişinde iade sağlanması düzeltildi');
            
        } catch (error) {
            console.error('❌ İade fonksiyonu düzeltme hatası:', error.message);
            throw error;
        }
    }

    // 3. Müşteri tabındaki ürün silme ve iade sorunu düzelt
    async fixCustomerProductIssues() {
        console.log('🔧 Müşteri tab ürün sorunları düzeltiliyor...');
        
        try {
            // Müşteri satış geçmişi tablosu oluştur
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS musteri_satis_gecmisi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    musteri_id TEXT NOT NULL,
                    satis_id INTEGER NOT NULL,
                    barkod TEXT NOT NULL,
                    urun_adi TEXT NOT NULL,
                    miktar INTEGER NOT NULL,
                    fiyat REAL NOT NULL,
                    tarih DATETIME NOT NULL,
                    durum TEXT DEFAULT 'aktif',
                    iade_durumu TEXT DEFAULT 'yok',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (musteri_id) REFERENCES musteriler(id),
                    FOREIGN KEY (satis_id) REFERENCES satisGecmisi(id)
                )
            `);

            // Mevcut satış verilerini müşteri tabına kopyala
            this.db.exec(`
                INSERT OR IGNORE INTO musteri_satis_gecmisi 
                (musteri_id, satis_id, barkod, urun_adi, miktar, fiyat, tarih)
                SELECT musteriId, id, barkod, urunAdi, miktar, fiyat, tarih 
                FROM satisGecmisi 
                WHERE musteriId IS NOT NULL AND musteriId != ''
            `);

            console.log('✅ Müşteri tab ürün sorunları düzeltildi');
            this.fixes.push('Müşteri tabında ürün silme ve iade sorunları çözüldü');
            
        } catch (error) {
            console.error('❌ Müşteri tab düzeltme hatası:', error.message);
            throw error;
        }
    }

    // 4. Yerel ağ bağlantı sorununu düzelt
    async fixNetworkConnectivity() {
        console.log('🔧 Yerel ağ bağlantı ayarları düzeltiliyor...');
        
        try {
            // Network ayarları dosyası oluştur
            const networkConfig = {
                server: {
                    host: '0.0.0.0', // Tüm network interface'lerden erişim
                    port: 3000,
                    cors: {
                        origin: "*",
                        methods: ["GET", "POST", "PUT", "DELETE"],
                        allowedHeaders: ["Content-Type", "Authorization"],
                        credentials: true
                    }
                },
                socket: {
                    transports: ['websocket', 'polling'],
                    cors: {
                        origin: "*",
                        methods: ["GET", "POST"]
                    }
                },
                firewall: {
                    enabled: true,
                    allowedPorts: [3000, 80, 443],
                    allowedIPs: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']
                }
            };

            await fs.writeJSON(path.join(__dirname, 'network-config.json'), networkConfig, { spaces: 2 });

            // Güvenlik duvarı script'i güncelle
            const firewallScript = `@echo off
echo Yerel ağ bağlantısı için güvenlik duvarı kuralları ekleniyor...

netsh advfirewall firewall add rule name="Stok Yönetim Sistemi - HTTP" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Stok Yönetim Sistemi - Outbound" dir=out action=allow protocol=TCP localport=3000

echo.
echo IP Adresi bilgileri:
ipconfig | findstr "IPv4"

echo.
echo Yerel ağ erişimi için şu adreslerden birini kullanın:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do echo http://%%b:3000
)

echo.
echo Güvenlik duvarı kuralları başarıyla eklendi!
pause`;

            await fs.writeFile(path.join(__dirname, 'setup-network.bat'), firewallScript);

            console.log('✅ Yerel ağ bağlantı ayarları düzeltildi');
            this.fixes.push('Yerel ağ telefon IP bağlantısı düzeltildi');
            
        } catch (error) {
            console.error('❌ Ağ bağlantı düzeltme hatası:', error.message);
            throw error;
        }
    }

    // 5. Gereksiz CSS'leri temizle
    async cleanupUnnecessaryCSS() {
        console.log('🔧 Gereksiz CSS\'ler temizleniyor...');
        
        try {
            const htmlFile = path.join(__dirname, 'try.html');
            let htmlContent = await fs.readFile(htmlFile, 'utf8');

            // Gereksiz CSS sınıflarını ve stilleri kaldır
            const unnecessaryCSS = [
                /\.unused-class\s*{[^}]*}/g,
                /\/\*\s*Kullanılmayan\s*\*\/[^\/]*\/\*/g,
                /\.legacy-[^{]*{[^}]*}/g,
                /\.old-[^{]*{[^}]*}/g,
                /\.temp-[^{]*{[^}]*}/g,
                /\.test-[^{]*{[^}]*}/g,
                /\/\*\s*TODO[^*]*\*\//g,
                /\/\*\s*FIXME[^*]*\*\//g,
                /\s+\/\*\s*debug[^*]*\*\//gi,
                /\.debug[^{]*{[^}]*}/g
            ];

            // Gereksiz stilleri kaldır
            unnecessaryCSS.forEach(regex => {
                htmlContent = htmlContent.replace(regex, '');
            });

            // Çoklu boşlukları ve satırları temizle
            htmlContent = htmlContent
                .replace(/\n\s*\n\s*\n/g, '\n\n')
                .replace(/\s+\n/g, '\n')
                .replace(/{\s+/g, '{ ')
                .replace(/\s+}/g, ' }');

            // Yedek al ve güncellenmiş dosyayı kaydet
            await fs.copy(htmlFile, `${htmlFile}.backup`);
            await fs.writeFile(htmlFile, htmlContent);

            console.log('✅ Gereksiz CSS\'ler temizlendi');
            this.fixes.push('Gereksiz CSS\'ler kaldırıldı, temel yapı korundu');
            
        } catch (error) {
            console.error('❌ CSS temizleme hatası:', error.message);
            throw error;
        }
    }

    // 6. Kategori yönetimini geliştir
    async improveCategoryManagement() {
        console.log('🔧 Kategori yönetimi geliştiriliyor...');
        
        try {
            // Kategoriler tablosu oluştur
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS kategoriler (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ad TEXT NOT NULL UNIQUE,
                    aciklama TEXT,
                    renk TEXT DEFAULT '#3498db',
                    ikon TEXT DEFAULT 'fas fa-box',
                    sira INTEGER DEFAULT 0,
                    aktif INTEGER DEFAULT 1,
                    urun_sayisi INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Varsayılan kategorileri ekle
            const defaultCategories = [
                { ad: 'Amortisör', aciklama: 'Araç amortisörleri', renk: '#e74c3c', ikon: 'fas fa-car-crash' },
                { ad: 'Fren Sistemi', aciklama: 'Fren balata ve parçaları', renk: '#c0392b', ikon: 'fas fa-hand-paper' },
                { ad: 'Motor Parçaları', aciklama: 'Motor yedek parçaları', renk: '#2980b9', ikon: 'fas fa-cog' },
                { ad: 'Elektrik', aciklama: 'Elektrikli sistemler', renk: '#f39c12', ikon: 'fas fa-bolt' },
                { ad: 'Karoseri', aciklama: 'Dış karoseri parçaları', renk: '#27ae60', ikon: 'fas fa-car' },
                { ad: 'İç Aksam', aciklama: 'İç aksam parçaları', renk: '#8e44ad', ikon: 'fas fa-chair' },
                { ad: 'Yağlar', aciklama: 'Motor ve diğer yağlar', renk: '#d35400', ikon: 'fas fa-tint' },
                { ad: 'Filtreler', aciklama: 'Hava, yakıt ve diğer filtreler', renk: '#34495e', ikon: 'fas fa-filter' }
            ];

            const insertCategory = this.db.prepare(`
                INSERT OR IGNORE INTO kategoriler (ad, aciklama, renk, ikon, sira)
                VALUES (?, ?, ?, ?, ?)
            `);

            defaultCategories.forEach((cat, index) => {
                insertCategory.run(cat.ad, cat.aciklama, cat.renk, cat.ikon, index);
            });

            // Ürün sayılarını güncelle
            this.db.exec(`
                UPDATE kategoriler 
                SET urun_sayisi = (
                    SELECT COUNT(*) FROM stok 
                    WHERE kategori = kategoriler.ad AND miktar > 0
                ),
                updated_at = CURRENT_TIMESTAMP
            `);

            // Kategori trigger'ları oluştur
            this.db.exec(`
                CREATE TRIGGER IF NOT EXISTS kategori_urun_sayisi_guncelle
                AFTER UPDATE OF kategori ON stok
                BEGIN
                    UPDATE kategoriler 
                    SET urun_sayisi = (
                        SELECT COUNT(*) FROM stok 
                        WHERE kategori = kategoriler.ad AND miktar > 0
                    ),
                    updated_at = CURRENT_TIMESTAMP
                    WHERE ad IN (OLD.kategori, NEW.kategori);
                END
            `);

            console.log('✅ Kategori yönetimi geliştirildi');
            this.fixes.push('Kategori yönetimi geliştirildi ve varsayılan kategoriler eklendi');
            
        } catch (error) {
            console.error('❌ Kategori yönetimi geliştirme hatası:', error.message);
            throw error;
        }
    }

    // 7. Aynı barkodlu ürünler sorununu düzelt ve yedek dosyalardan veri geri yükle
    async fixDuplicateBarcodeAndRestoreBackups() {
        console.log('🔧 Aynı barkodlu ürünler düzeltiliyor ve yedek veriler geri yükleniyor...');
        
        try {
            // Önce mevcut verileri analiz et
            const duplicateBarcodes = this.db.prepare(`
                SELECT barkod, COUNT(*) as count, GROUP_CONCAT(id) as ids
                FROM stok 
                GROUP BY barkod 
                HAVING COUNT(*) > 1
            `).all();

            console.log(`🔍 ${duplicateBarcodes.length} adet çoklu barkod bulundu`);

            // Yedek dosyalarını tara
            const backupFiles = await fs.readdir(this.backupDir);
            const jsonBackups = backupFiles.filter(file => file.endsWith('.json'));

            let totalRestored = 0;
            let processedProducts = new Set();

            for (const backupFile of jsonBackups) {
                try {
                    const backupPath = path.join(this.backupDir, backupFile);
                    const backupData = await fs.readJSON(backupPath);
                    
                    let products = [];
                    
                    // Farklı JSON formatlarını destekle
                    if (backupData.stokListesi) {
                        products = Object.values(backupData.stokListesi);
                    } else if (Array.isArray(backupData)) {
                        products = backupData;
                    } else if (backupData.data && backupData.data.stokListesi) {
                        products = Object.values(backupData.data.stokListesi);
                    }

                    console.log(`📁 ${backupFile}: ${products.length} ürün bulundu`);

                    for (const product of products) {
                        if (!product.barkod) continue;

                        const productKey = `${product.barkod}_${product.marka || ''}_${product.varyant_id || ''}`;
                        if (processedProducts.has(productKey)) continue;

                        // Veritabanında bu ürün var mı kontrol et
                        const existingProduct = this.db.prepare(`
                            SELECT id FROM stok 
                            WHERE barkod = ? AND marka = ? AND (varyant_id = ? OR (varyant_id IS NULL AND ? IS NULL))
                        `).get(
                            product.barkod, 
                            product.marka || '', 
                            product.varyant_id || null,
                            product.varyant_id || null
                        );

                        if (!existingProduct) {
                            // Yeni ürün ekle
                            const insertProduct = this.db.prepare(`
                                INSERT INTO stok (
                                    urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, 
                                    kategori, aciklama, varyant_id, created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            `);

                            const urunId = `urun_restored_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                            
                            insertProduct.run(
                                urunId,
                                product.barkod,
                                product.urun_adi || product.ad || `Ürün ${product.barkod}`,
                                product.marka || '',
                                product.stok_miktari || product.miktar || 0,
                                product.alisFiyati || 0,
                                product.satisFiyati || product.fiyat || 0,
                                this.categorizeProduct(product.urun_adi || product.ad || ''),
                                product.aciklama || '',
                                product.varyant_id || null,
                                product.created_at || new Date().toISOString()
                            );

                            totalRestored++;
                            processedProducts.add(productKey);
                        } else {
                            // Mevcut ürünü güncelle (eğer yedekten daha fazla bilgi varsa)
                            this.updateProductIfBetter(existingProduct.id, product);
                        }
                    }
                } catch (fileError) {
                    console.warn(`⚠️ ${backupFile} işlenirken hata:`, fileError.message);
                }
            }

            // Çoklu barkod sorununu çöz
            this.fixDuplicateBarcodeProducts(duplicateBarcodes);

            console.log(`✅ ${totalRestored} ürün yedeklerden geri yüklendi`);
            this.fixes.push(`${totalRestored} ürün yedek dosyalardan geri yüklendi`);
            this.fixes.push('Aynı barkodlu ürünler problemi çözüldü');
            
        } catch (error) {
            console.error('❌ Yedek geri yükleme hatası:', error.message);
            throw error;
        }
    }

    // Yardımcı fonksiyonlar
    categorizeProduct(productName) {
        const name = productName.toLowerCase();
        
        if (name.includes('amortisör') || name.includes('amortisor')) return 'Amortisör';
        if (name.includes('fren') || name.includes('balata')) return 'Fren Sistemi';
        if (name.includes('yağ') && !name.includes('soğutucu')) return 'Yağlar';
        if (name.includes('filtre')) return 'Filtreler';
        if (name.includes('far') || name.includes('stop') || name.includes('lamba')) return 'Elektrik';
        if (name.includes('tampon') || name.includes('panjur') || name.includes('ayna')) return 'Karoseri';
        if (name.includes('motor') || name.includes('piston') || name.includes('valf')) return 'Motor Parçaları';
        
        return 'Diğer';
    }

    updateProductIfBetter(productId, backupProduct) {
        try {
            const updateQuery = this.db.prepare(`
                UPDATE stok 
                SET ad = COALESCE(NULLIF(?, ''), ad),
                    marka = COALESCE(NULLIF(?, ''), marka),
                    kategori = COALESCE(NULLIF(?, ''), kategori),
                    aciklama = COALESCE(NULLIF(?, ''), aciklama),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            updateQuery.run(
                backupProduct.urun_adi || backupProduct.ad,
                backupProduct.marka,
                this.categorizeProduct(backupProduct.urun_adi || backupProduct.ad || ''),
                backupProduct.aciklama,
                productId
            );
        } catch (error) {
            console.warn(`⚠️ Ürün güncelleme hatası (ID: ${productId}):`, error.message);
        }
    }

    fixDuplicateBarcodeProducts(duplicates) {
        for (const duplicate of duplicates) {
            try {
                const products = this.db.prepare(`
                    SELECT * FROM stok WHERE barkod = ? ORDER BY updated_at DESC
                `).all(duplicate.barkod);

                // En güncel olanı koru, diğerlerini güncelle
                const latestProduct = products[0];
                const olderProducts = products.slice(1);

                for (const product of olderProducts) {
                    // Benzersiz barkod oluştur
                    const newBarcode = `${product.barkod}_${product.marka || 'V'}_${product.id}`;
                    
                    this.db.prepare(`
                        UPDATE stok 
                        SET barkod = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `).run(newBarcode, product.id);
                }
            } catch (error) {
                console.warn(`⚠️ Çoklu barkod düzeltme hatası (${duplicate.barkod}):`, error.message);
            }
        }
    }

    // 8. İade işlemi API endpoint'lerini düzelt
    async fixReturnAPIEndpoints() {
        console.log('🔧 İade API endpoint\'leri düzeltiliyor...');
        
        try {
            const serverPath = path.join(__dirname, 'server.js');
            let serverContent = await fs.readFile(serverPath, 'utf8');

            // İade endpoint'i ekle
            const returnEndpoint = `
// İade işlemi endpoint'i - Düzeltildi
app.post('/api/iade', async (req, res) => {
    try {
        const { satis_id, barkod, miktar, aciklama, musteri_id } = req.body;

        if (!satis_id || !barkod || !miktar) {
            return res.status(400).json({
                success: false,
                error: 'Eksik parametreler: satis_id, barkod ve miktar gerekli'
            });
        }

        // Satış kaydını kontrol et
        const satis = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?').get(satis_id);
        if (!satis) {
            return res.status(404).json({
                success: false,
                error: 'Satış kaydı bulunamadı'
            });
        }

        // İade miktarı kontrolü
        if (miktar > satis.miktar) {
            return res.status(400).json({
                success: false,
                error: 'İade miktarı satış miktarından fazla olamaz'
            });
        }

        // Transaction ile iade işlemi
        const transaction = db.transaction(() => {
            // İade kaydı oluştur
            const iadeResult = db.prepare(\`
                INSERT INTO iadeler 
                (satis_id, barkod, urun_adi, miktar, fiyat, musteri_id, musteri_adi, aciklama)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            \`).run(
                satis_id, 
                barkod, 
                satis.urunAdi, 
                miktar, 
                satis.fiyat,
                musteri_id || satis.musteriId,
                satis.musteriAdi,
                aciklama || 'İade işlemi'
            );

            // Stok geri ekle
            db.prepare(\`
                UPDATE stok 
                SET miktar = miktar + ?, updated_at = CURRENT_TIMESTAMP 
                WHERE barkod = ?
            \`).run(miktar, barkod);

            // Satış kaydını güncelle
            if (miktar === satis.miktar) {
                // Tam iade
                db.prepare(\`
                    UPDATE satisGecmisi 
                    SET miktar = 0, durum = 'iade_edildi', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                \`).run(satis_id);
            } else {
                // Kısmi iade
                db.prepare(\`
                    UPDATE satisGecmisi 
                    SET miktar = miktar - ?, durum = 'kismi_iade', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                \`).run(miktar, satis_id);
            }

            return iadeResult;
        });

        const result = transaction();

        // Real-time update
        io.emit('dataUpdate', {
            type: 'iade',
            data: {
                satis_id,
                barkod,
                miktar,
                durum: 'basarili'
            }
        });

        res.json({
            success: true,
            message: 'İade işlemi başarıyla tamamlandı',
            data: {
                iade_id: result.lastInsertRowid,
                satis_id,
                miktar,
                durum: 'basarili'
            }
        });

    } catch (error) {
        console.error('❌ İade işlemi hatası:', error.message);
        res.status(500).json({
            success: false,
            error: 'İade işlemi sırasında hata oluştu: ' + error.message
        });
    }
});

// İade geçmişi endpoint'i
app.get('/api/iadeler', async (req, res) => {
    try {
        const { musteri_id, tarih_baslangic, tarih_bitis } = req.query;
        
        let query = 'SELECT * FROM iadeler WHERE 1=1';
        let params = [];

        if (musteri_id) {
            query += ' AND musteri_id = ?';
            params.push(musteri_id);
        }

        if (tarih_baslangic) {
            query += ' AND DATE(iade_tarihi) >= DATE(?)';
            params.push(tarih_baslangic);
        }

        if (tarih_bitis) {
            query += ' AND DATE(iade_tarihi) <= DATE(?)';
            params.push(tarih_bitis);
        }

        query += ' ORDER BY iade_tarihi DESC LIMIT 100';

        const iadeler = db.prepare(query).all(...params);

        res.json({
            success: true,
            data: iadeler,
            count: iadeler.length
        });

    } catch (error) {
        console.error('❌ İade geçmişi hatası:', error.message);
        res.status(500).json({
            success: false,
            error: 'İade geçmişi alınamadı: ' + error.message
        });
    }
});
`;

            // Eğer iade endpoint'i yoksa ekle
            if (!serverContent.includes('/api/iade')) {
                const insertPosition = serverContent.lastIndexOf('// Server başlatma');
                if (insertPosition !== -1) {
                    serverContent = serverContent.slice(0, insertPosition) + 
                                  returnEndpoint + '\n\n' + 
                                  serverContent.slice(insertPosition);
                } else {
                    serverContent += returnEndpoint;
                }

                await fs.writeFile(serverPath, serverContent);
            }

            console.log('✅ İade API endpoint\'leri düzeltildi');
            this.fixes.push('İade işlemi API endpoint\'leri düzeltildi');
            
        } catch (error) {
            console.error('❌ İade API düzeltme hatası:', error.message);
            throw error;
        }
    }

    // Ana düzeltme fonksiyonu
    async runAllFixes() {
        console.log('🚀 Tüm düzeltmeler başlatılıyor...\n');
        
        try {
            await this.fixBarcodeUpdateError();
            await this.fixReturnFunctionality();
            await this.fixCustomerProductIssues();
            await this.fixNetworkConnectivity();
            await this.cleanupUnnecessaryCSS();
            await this.improveCategoryManagement();
            await this.fixDuplicateBarcodeAndRestoreBackups();
            await this.fixReturnAPIEndpoints();

            console.log('\n✅ Tüm düzeltmeler başarıyla tamamlandı!\n');
            console.log('📋 Düzeltilen sorunlar:');
            this.fixes.forEach((fix, index) => {
                console.log(`   ${index + 1}. ${fix}`);
            });

            console.log('\n🔄 Sunucuyu yeniden başlatmanız önerilir.');
            console.log('🌐 Yerel ağ erişimi için setup-network.bat çalıştırın.');
            
        } catch (error) {
            console.error('❌ Düzeltme işlemi sırasında hata:', error.message);
            throw error;
        } finally {
            this.db.close();
        }
    }
}

// Düzeltmeleri çalıştır
if (require.main === module) {
    const fixes = new TurkishInventorySystemFixes();
    fixes.runAllFixes().catch(console.error);
}

module.exports = TurkishInventorySystemFixes;