const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');

// Server configuration - ULTRA OPTIMIZED
const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000, // Reduced from 60000
    pingInterval: 15000, // Reduced from 25000
    upgrade: true,
    rememberUpgrade: true,
    maxHttpBufferSize: 1e6, // 1MB limit
    allowEIO3: true
});

// Database configuration - ULTRA OPTIMIZED
const dbPath = path.join(__dirname, 'veriler', 'veritabani.db');
let db = null;
// Migration: if legacy root database exists but new path doesn't, copy it once
const legacyDbPath = path.join(__dirname, 'veritabani.db');
try {
    if (fs.existsSync(legacyDbPath) && !fs.existsSync(dbPath)) {
        fs.ensureDirSync(path.dirname(dbPath));
        fs.copyFileSync(legacyDbPath, dbPath);
        console.log('📦 Migrated legacy database from veritabani.db to veriler/veritabani.db');
    }
} catch (e) {
    console.warn('⚠️ Legacy DB migration warning:', e.message);
}

// Performance optimizations - Geliştirilmiş
const CACHE_SIZE = 2000; // Cache size for frequently accessed data
const SYNC_INTERVAL = 10000; // 10 seconds for faster sync
const MAX_CONNECTIONS = 200; // Increased connection limit
const SYNC_TIMEOUT = 5000; // 5 seconds timeout for sync operations

// In-memory cache for frequently accessed data
const memoryCache = new Map();
const cacheTimeout = 5 * 60 * 1000; // 5 minutes

// Connection limiter
let activeConnections = 0;

// Email configuration for daily backups
const emailConfig = require('./email-config');

// Email transporter
let transporter = null;
try {
    transporter = nodemailer.createTransport(emailConfig);
} catch (error) {
    console.warn('⚠️ Email configuration not set up:', error.message);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Statik dosyalar: index ve istemci için tüm cihazlara servis
app.use(express.static(path.join(__dirname)));

// Ana sayfa yönlendirmesi
app.get('/', (req, res) => {
    res.redirect('/try.html');
});

// Database initialization with ULTRA OPTIMIZED performance
function initializeDatabase() {
    try {
        // Ensure data directory exists
        fs.ensureDirSync(path.dirname(dbPath));
        
        // Initialize database with ULTRA OPTIMIZED settings
        db = new Database(dbPath);
        console.log('✅ Database connected:', dbPath);
        
        // ULTRA OPTIMIZED database settings
        db.exec('PRAGMA foreign_keys = ON');
        db.exec('PRAGMA journal_mode = WAL');
        db.exec('PRAGMA synchronous = NORMAL');
        db.exec('PRAGMA cache_size = 50000'); // Increased from 10000
        db.exec('PRAGMA temp_store = MEMORY');
        db.exec('PRAGMA mmap_size = 536870912'); // Increased to 512MB
        db.exec('PRAGMA page_size = 4096');
        db.exec('PRAGMA auto_vacuum = INCREMENTAL');
        db.exec('PRAGMA incremental_vacuum = 1000');
        db.exec('PRAGMA optimize');
        
        // Create tables with proper schema first
        db.exec(`
            CREATE TABLE IF NOT EXISTS stok (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                urun_id TEXT UNIQUE NOT NULL,
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
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS musteriler (
                id TEXT PRIMARY KEY,
                ad TEXT NOT NULL,
                telefon TEXT,
                adres TEXT,
                bakiye REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS satisGecmisi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barkod TEXT NOT NULL,
                urunAdi TEXT,
                miktar INTEGER DEFAULT 0,
                fiyat REAL DEFAULT 0,
                tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
                musteriId TEXT,
                musteriAdi TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS borclarim (
                id TEXT PRIMARY KEY,
                alacakli TEXT NOT NULL,
                miktar REAL DEFAULT 0,
                aciklama TEXT,
                tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
                odemeTarihi DATETIME,
                durum TEXT DEFAULT 'Ödenmedi',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Database tables created successfully');
        
        // Create indexes for faster queries after tables are created
        try {
            db.exec('CREATE INDEX IF NOT EXISTS idx_stok_barkod ON stok(barkod)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_stok_urun_id ON stok(urun_id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_satis_tarih ON satisGecmisi(tarih)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_satis_barkod ON satisGecmisi(barkod)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_musteri_id ON musteriler(id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_borc_tarih ON borclarim(tarih)');
            
            console.log('✅ Database indexes created for faster queries');
        } catch (error) {
            console.warn('⚠️ Index creation error:', error.message);
        }

        // Schema migration: ensure satisGecmisi has borc, toplam, alisFiyati columns
        try {
            const satisCols = db.prepare("PRAGMA table_info(satisGecmisi)").all();
            const colNames = new Set(satisCols.map(c => c.name));
            console.log('📊 Satış geçmişi tablo sütunları:', colNames);
            
            if (!colNames.has('borc')) {
                console.log('➕ Borc sütunu ekleniyor...');
                db.exec("ALTER TABLE satisGecmisi ADD COLUMN borc INTEGER DEFAULT 0");
            }
            if (!colNames.has('toplam')) {
                console.log('➕ Toplam sütunu ekleniyor...');
                db.exec("ALTER TABLE satisGecmisi ADD COLUMN toplam REAL DEFAULT 0");
            }
            if (!colNames.has('alisFiyati')) {
                console.log('➕ AlisFiyati sütunu ekleniyor...');
                db.exec("ALTER TABLE satisGecmisi ADD COLUMN alisFiyati REAL DEFAULT 0");
            }
            
            // Son durumu kontrol et
            const finalCols = db.prepare("PRAGMA table_info(satisGecmisi)").all();
            console.log('✅ Final satış geçmişi tablo sütunları:', finalCols.map(c => c.name));
        } catch (error) {
            console.warn('⚠️ Schema migration warning (satisGecmisi):', error.message);
        }
        
        // Update existing products to have urun_id if missing
        try {
            // First check if urun_id column exists
            const stokCols = db.prepare("PRAGMA table_info(stok)").all();
            const hasUrunId = stokCols.some(col => col.name === 'urun_id');
            
            if (!hasUrunId) {
                console.log('➕ urun_id sütunu ekleniyor...');
                db.exec("ALTER TABLE stok ADD COLUMN urun_id TEXT");
            }
            
            const productsWithoutUrunId = db.prepare('SELECT * FROM stok WHERE urun_id IS NULL OR urun_id = ""').all();
            console.log(`🔄 Updating ${productsWithoutUrunId.length} products with urun_id...`);
            
            productsWithoutUrunId.forEach(product => {
                const urun_id = generateUrunId();
                db.prepare('UPDATE stok SET urun_id = ? WHERE id = ?').run(urun_id, product.id);
            });
            
            if (productsWithoutUrunId.length > 0) {
                console.log(`✅ Updated ${productsWithoutUrunId.length} products with urun_id`);
            }
        } catch (error) {
            console.warn('⚠️ Error updating products with urun_id:', error.message);
        }
        
        // Preload frequently accessed data into cache
        preloadCache();
        
        } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

// Generate unique product ID
function generateUrunId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `urun_${timestamp}_${random}`;
}

// Cache management functions
function preloadCache() {
    try {
        console.log('📦 Preloading data into cache...');
        
        // Cache stock data
        const stokRows = db.prepare('SELECT * FROM stok ORDER BY updated_at DESC LIMIT 100').all();
        memoryCache.set('stok_recent', {
            data: stokRows,
            timestamp: Date.now()
        });
        
        // Cache recent sales
        const satisRows = db.prepare('SELECT * FROM satisGecmisi ORDER BY tarih DESC LIMIT 50').all();
        memoryCache.set('satis_recent', {
            data: satisRows,
            timestamp: Date.now()
        });
        
        console.log('✅ Cache preloaded successfully');
    } catch (error) {
        console.error('❌ Cache preload error:', error);
    }
}

function getCachedData(key) {
    const cached = memoryCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
        return cached.data;
    }
    return null;
}

function setCachedData(key, data) {
    memoryCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
    
    // Limit cache size
    if (memoryCache.size > CACHE_SIZE) {
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
    }
}

// Initialize database
initializeDatabase();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
    
    // Send initial connection confirmation
    socket.emit('connected', {
        message: 'Başarıyla bağlandı',
        timestamp: new Date().toISOString(),
        socketId: socket.id
    });
    
    // Handle data requests with robust error handling
            socket.on('requestData', () => {
            try {
                // console.log('📡 Data request from client:', socket.id);
                
                const data = db.transaction(() => {
                    let stokListesi = {};
                    let satisGecmisi = [];
                    let musteriler = {};
                    let borclarim = {};
                    
                    // Get stok data - FIXED: Use consistent key format with validation
                    try {
                        const stokRows = db.prepare('SELECT * FROM stok ORDER BY updated_at DESC').all();
                        console.log(`📦 Loading ${stokRows.length} stock items from database...`);
                        
                        stokRows.forEach(row => { 
                            const key = row.id || `${row.barkod}_${row.marka || ''}_${row.varyant_id || ''}`;
                            
                            if (!row.barkod) {
                                console.warn('⚠️ Skipping product without barcode:', row);
                                return;
                            }
                            
                            // Eski sistemden gelen verileri düzelt
                            let urunAdi = row.ad;
                            if (urunAdi === 'Bilinmeyen Ürün' || !urunAdi) {
                                // Barkod'dan ürün adı oluştur
                                urunAdi = `Ürün ${row.barkod}`;
                            }
                            
                            // Stok miktarını düzelt
                            let stokMiktari = row.miktar;
                            if (stokMiktari === 0 || stokMiktari === null) {
                                stokMiktari = 1; // Varsayılan stok miktarı
                            }
                            
                            stokListesi[key] = {
                                id: row.id,
                                barkod: row.barkod,
                                urun_adi: urunAdi,
                                marka: row.marka || '',
                                stok_miktari: stokMiktari,
                                alisFiyati: row.alisFiyati || 0,
                                satisFiyati: row.satisFiyati || 0,
                                kategori: row.kategori || '',
                                aciklama: row.aciklama || '',
                                urun_id: row.urun_id,
                                varyant_id: row.varyant_id || '',
                                created_at: row.created_at,
                                updated_at: row.updated_at
                            };
                        });
                        
                        console.log(`✅ Successfully loaded ${Object.keys(stokListesi).length} products`);
                    } catch (error) {
                        console.error('❌ Error loading stock data:', error);
                        // Fallback to JSON file if database fails
                        try {
                            const jsonData = JSON.parse(fs.readFileSync('veriler/tumVeriler.json', 'utf8'));
                            stokListesi = jsonData.stokListesi || {};
                            console.log(`📄 Fallback: Loaded ${Object.keys(stokListesi).length} products from JSON`);
                        } catch (jsonError) {
                            console.error('❌ Failed to load from JSON fallback:', jsonError);
                        }
                    }
                    
                    // Get satis data
                    try {
                        satisGecmisi = db.prepare('SELECT * FROM satisGecmisi ORDER BY tarih DESC').all();
                        
                        // Duplicate kontrolü ve veri temizleme
                        const uniqueSales = [];
                        const seenSales = new Set();
                        
                        satisGecmisi.forEach(sale => {
                            const saleKey = `${sale.barkod}_${sale.tarih}_${sale.miktar}_${sale.fiyat}`;
                            if (!seenSales.has(saleKey)) {
                                seenSales.add(saleKey);
                                uniqueSales.push(sale);
                            }
                        });
                        
                        satisGecmisi = uniqueSales;
                        // Enrich missing purchase prices for sales from stock (display-only)
                        try {
                            const getAlisFromStock = db.prepare('SELECT alisFiyati FROM stok WHERE barkod = ?');
                            satisGecmisi.forEach(sale => {
                                const currentAlis = parseFloat(sale.alisFiyati) || 0;
                                if ((currentAlis === 0 || Number.isNaN(currentAlis)) && sale.barkod) {
                                    const row = getAlisFromStock.get(sale.barkod);
                                    if (row && (row.alisFiyati || row.alisFiyati === 0)) {
                                        sale.alisFiyati = row.alisFiyati || 0;
                                    }
                                }
                            });
                        } catch (e) {
                            console.warn('⚠️ Could not enrich sales with purchase prices:', e.message);
                        }
                        console.log(`📊 Loaded ${satisGecmisi.length} unique sales from database`);
                        
                    } catch (e) {
                        console.warn('⚠️ Satis query error:', e.message);
                        satisGecmisi = [];
                    }
                    
                    // Get musteriler data
                    try {
                        const musteriRows = db.prepare('SELECT * FROM musteriler ORDER BY updated_at DESC').all();
                        musteriRows.forEach(row => { musteriler[row.id] = row; });
                    } catch (e) {
                        console.warn('⚠️ Musteri query error:', e.message);
                        // Fallback
                        const musteriRows = db.prepare('SELECT * FROM musteriler ORDER BY id DESC').all();
                        musteriRows.forEach(row => { musteriler[row.id] = row; });
                    }
                    
                    // Get borclarim data
                    try {
                        const borcRows = db.prepare('SELECT * FROM borclarim ORDER BY tarih DESC').all();
                        borcRows.forEach(row => { borclarim[row.id] = row; });
                    } catch (e) {
                        console.warn('⚠️ Borc query error:', e.message);
                    }
                    
                    return { stokListesi, satisGecmisi, musteriler, borclarim };
                })();
                
                socket.emit('dataResponse', {
                    success: true,
                    data: data,
                    timestamp: new Date().toISOString(),
                    count: {
                        stok: Object.keys(data.stokListesi).length,
                        satis: data.satisGecmisi.length,
                        musteri: Object.keys(data.musteriler).length,
                        borc: Object.keys(data.borclarim).length
                    }
                });
                
                // console.log('✅ Data sent to client:', socket.id);
                
            } catch (error) {
                console.error('❌ Data request error:', error);
                socket.emit('dataResponse', {
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Handle data updates with duplicate prevention
        socket.on('dataUpdate', (data) => {
            try {
                console.log('📡 Data update received:', data.type);
                
                switch(data.type) {
                    case 'satis-add':
                        // Duplicate kontrolü
                        const existingSale = db.prepare(`
                            SELECT * FROM satisGecmisi 
                            WHERE barkod = ? AND tarih = ? AND miktar = ? AND fiyat = ?
                        `).get(data.data.barkod, data.data.tarih, data.data.miktar, data.data.fiyat);
                        
                        if (!existingSale) {
                            // Satışı ekle
                            const alisFiyati = parseFloat(data.data.alisFiyati) || 0;
                            const miktar = parseInt(data.data.miktar) || 0;
                            const fiyat = parseFloat(data.data.fiyat) || 0;
                            const toplam = parseFloat(data.data.toplam) || (fiyat * miktar) || 0;
                            const borc = data.data.borc ? 1 : 0;
                            const result = db.prepare(`
                                INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, alisFiyati, toplam, borc, tarih, musteriId, musteriAdi)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                data.data.barkod,
                                data.data.urunAdi || '',
                                miktar,
                                fiyat,
                                alisFiyati,
                                toplam,
                                borc,
                                data.data.tarih,
                                data.data.musteriId || '',
                                data.data.musteriAdi || ''
                            );
                            
                            console.log('✅ Satış eklendi:', data.data.barkod);
                        } else {
                            console.log('⚠️ Duplicate satış atlandı:', data.data.barkod);
                        }
                        break;
                        
                    case 'stok-add':
                    case 'stok-update':
                        // Eğer kayıt zaten DB id'sine sahipse, DB'ye tekrar yazma, yalnızca yayınla
                        if (data.data && data.data.id) {
                            io.emit('dataUpdated', {
                                type: data.type,
                                data: data.data,
                                timestamp: new Date().toISOString()
                            });
                            break;
                        }
                        // Stok güncelleme - FIX: varyantlar barkod bazında ezilmesin
                        const stokData = data.data;
                        const targetId = stokData.id || stokData.urun_id || null;
                        let targetProduct = null;
                        if (targetId) {
                            targetProduct = db.prepare('SELECT * FROM stok WHERE id = ? OR urun_id = ?').get(targetId, targetId);
                        }
                        if (!targetProduct) {
                            // Try composite match
                            targetProduct = db.prepare('SELECT * FROM stok WHERE barkod = ? AND (marka = ? OR (? IS NULL AND marka IS NULL)) AND (varyant_id = ? OR (? IS NULL AND varyant_id IS NULL))')
                                .get(stokData.barkod, stokData.marka || null, stokData.marka || null, stokData.varyant_id || null, stokData.varyant_id || null);
                        }
                        if (targetProduct) {
                            db.prepare(`
                                UPDATE stok SET 
                                    ad = ?, marka = ?, miktar = ?, alisFiyati = ?, 
                                    satisFiyati = ?, kategori = ?, aciklama = ?, 
                                    varyant_id = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                stokData.urun_adi || stokData.ad,
                                stokData.marka || targetProduct.marka || '',
                                stokData.stok_miktari || stokData.miktar || targetProduct.miktar || 0,
                                stokData.alisFiyati ?? targetProduct.alisFiyati ?? 0,
                                (stokData.fiyat ?? stokData.satisFiyati) ?? targetProduct.satisFiyati ?? 0,
                                stokData.kategori ?? targetProduct.kategori ?? '',
                                stokData.aciklama ?? targetProduct.aciklama ?? '',
                                stokData.varyant_id ?? targetProduct.varyant_id ?? '',
                                targetProduct.id
                            );
                        } else {
                            // Yeni ekle
                            db.prepare(`
                                INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                generateUrunId(),
                                stokData.barkod,
                                stokData.urun_adi || stokData.ad,
                                stokData.marka || '',
                                stokData.stok_miktari || stokData.miktar || 0,
                                stokData.alisFiyati || 0,
                                stokData.fiyat || stokData.satisFiyati || 0,
                                stokData.kategori || '',
                                stokData.aciklama || '',
                                stokData.varyant_id || ''
                            );
                        }
                        break;
                        
                    case 'musteri-add':
                    case 'musteri-update':
                        // Müşteri güncelleme
                        const musteriData = data.data;
                        const existingMusteri = db.prepare('SELECT * FROM musteriler WHERE id = ?').get(musteriData.id);
                        
                        if (existingMusteri) {
                            db.prepare(`
                                UPDATE musteriler SET 
                                    ad = ?, telefon = ?, adres = ?, bakiye = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                musteriData.ad,
                                musteriData.telefon || '',
                                musteriData.adres || '',
                                musteriData.bakiye || 0,
                                musteriData.id
                            );
                        } else {
                            db.prepare(`
                                INSERT INTO musteriler (id, ad, telefon, adres, bakiye)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(
                                musteriData.id,
                                musteriData.ad,
                                musteriData.telefon || '',
                                musteriData.adres || '',
                                musteriData.bakiye || 0
                            );
                        }
                        break;
                        
                    case 'borc-add':
                    case 'borc-update':
                        // Borç güncelleme
                        const borcData = data.data;
                        const existingBorc = db.prepare('SELECT * FROM borclarim WHERE id = ?').get(borcData.id);
                        
                        if (existingBorc) {
                            db.prepare(`
                                UPDATE borclarim SET 
                                    alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, odemeTarihi = ?, durum = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                borcData.alacakli,
                                borcData.miktar,
                                borcData.aciklama,
                                borcData.tarih,
                                borcData.odemeTarihi,
                                borcData.durum,
                                borcData.id
                            );
                        } else {
                            db.prepare(`
                                INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                borcData.id,
                                borcData.alacakli,
                                borcData.miktar,
                                borcData.aciklama,
                                borcData.tarih,
                                borcData.odemeTarihi,
                                borcData.durum
                            );
                        }
                        break;
                }
                
                // Broadcast to all other clients
                socket.broadcast.emit('dataUpdate', {
                    ...data,
                    source: socket.id
                });
                
            } catch (error) {
                console.error('❌ Data update error:', error);
            }
        });
        
        // Handle backup sync events
        socket.on('backup-synced', (data) => {
            try {
                console.log('🔄 Backup sync event received');
                
                // Broadcast to all clients
                socket.broadcast.emit('dataUpdated', {
                    type: 'backup-synced',
                    data: data.data,
                    timestamp: new Date().toISOString()
                });
                
                socket.emit('backupSyncResponse', {
                    success: true,
                    message: 'Backup sync completed',
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('❌ Backup sync error:', error);
                socket.emit('backupSyncResponse', {
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
});

// API Routes

// Health check endpoint for offline mode
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        timestamp: new Date().toISOString(),
        database: db ? 'connected' : 'disconnected'
    });
});

app.get('/api/test', (req, res) => {
    try {
        // Database connection test
        const dbTest = db.prepare('SELECT 1 as test').get();
        
        // Table structure test
        const stokColumns = db.prepare("PRAGMA table_info(stok)").all();
        const musteriColumns = db.prepare("PRAGMA table_info(musteriler)").all();
        
        // Data count test
        const stokCount = db.prepare('SELECT COUNT(*) as count FROM stok').get();
        const musteriCount = db.prepare('SELECT COUNT(*) as count FROM musteriler').get();
        const satisCount = db.prepare('SELECT COUNT(*) as count FROM satisGecmisi').get();
        const borcCount = db.prepare('SELECT COUNT(*) as count FROM borclarim').get();
        
        res.json({
            success: true,
            message: 'API çalışıyor',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                test: dbTest.test
            },
            tables: {
                stok: {
                    exists: stokColumns.length > 0,
                    columns: stokColumns.map(col => col.name),
                    count: stokCount.count,
                    hasUpdatedAt: stokColumns.some(col => col.name === 'updated_at')
                },
                musteriler: {
                    exists: musteriColumns.length > 0,
                    columns: musteriColumns.map(col => col.name),
                    count: musteriCount.count,
                    hasUpdatedAt: musteriColumns.some(col => col.name === 'updated_at')
                },
                satisGecmisi: {
                    count: satisCount.count
                },
                borclarim: {
                    count: borcCount.count
                }
            },
            socket: {
                connected: io.engine.clientsCount,
                rooms: Object.keys(io.sockets.adapter.rooms)
            }
        });
        
    } catch (error) {
        console.error('❌ Test endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Test başarısız',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});



// GET endpoint for all data
app.get('/api/data', async (req, res) => {
    try {
        console.log('📊 Data fetch request received');
        
        // Get all data from database
        const stokListesi = db.prepare('SELECT * FROM stok ORDER BY ad').all();
        const satisGecmisi = db.prepare('SELECT * FROM satisGecmisi ORDER BY tarih DESC').all();
        const musteriler = db.prepare('SELECT * FROM musteriler ORDER BY ad').all();
        const borclarim = db.prepare('SELECT * FROM borclarim ORDER BY tarih DESC').all();
        
        console.log('🔍 Debug: Veri sayıları:', {
            stok: stokListesi.length,
            satis: satisGecmisi.length,
            musteri: musteriler.length,
            borc: borclarim.length
        });
        
        console.log('🔍 Debug: Veri sayıları:', {
            stok: stokListesi.length,
            satis: satisGecmisi.length,
            musteri: musteriler.length,
            borc: borclarim.length
        });
        
        // Müşteri adlarını ekle
        const musteriMap = {};
        musteriler.forEach(m => musteriMap[m.id] = m.ad);
        
        satisGecmisi.forEach(satis => {
            if (satis.musteriId && musteriMap[satis.musteriId]) {
                satis.musteriAdi = musteriMap[satis.musteriId];
            }
        });
        
        // Convert to expected format
        const stokData = {};
        stokListesi.forEach(urun => {
            stokData[urun.urun_id] = {
                barkod: urun.barkod,
                ad: urun.ad,
                marka: urun.marka,
                miktar: urun.miktar,
                alisFiyati: urun.alisFiyati,
                satisFiyati: urun.satisFiyati,
                kategori: urun.kategori,
                aciklama: urun.aciklama,
                varyant_id: urun.varyant_id,
                eklenmeTarihi: urun.eklenmeTarihi,
                guncellemeTarihi: urun.guncellemeTarihi
            };
        });
        
        const musteriData = {};
        musteriler.forEach(musteri => {
            musteriData[musteri.id] = {
                ad: musteri.ad,
                telefon: musteri.telefon,
                adres: musteri.adres,
                bakiye: musteri.bakiye,
                eklenmeTarihi: musteri.eklenmeTarihi,
                guncellemeTarihi: musteri.guncellemeTarihi
            };
        });
        
        const response = {
            stokListesi: stokData,
            satisGecmisi: satisGecmisi,
            musteriler: musteriData,
            borclarim: borclarim,
            version: '1.0',
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ Data fetch completed:', {
            stok: Object.keys(stokData).length,
            satis: satisGecmisi.length,
            musteri: Object.keys(musteriData).length,
            borc: borclarim.length
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Data fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Data fetch error: ' + error.message
        });
    }
});

// GET endpoint for stock check - NEW: Ürün kontrolü
app.get('/api/stok-kontrol', async (req, res) => {
    try {
        const { barkod, marka, varyant_id } = req.query;
        
        if (!barkod) {
            return res.status(400).json({
                success: false,
                message: 'Barkod parametresi gerekli',
                timestamp: new Date().toISOString()
            });
        }
        
        // Ürünü kontrol et
        const product = db.prepare('SELECT * FROM stok WHERE barkod = ? AND marka = ? AND (varyant_id = ? OR (varyant_id IS NULL AND ? IS NULL))').get(
            barkod, marka || '', varyant_id || null, varyant_id || null
        );
        
        res.json({
            success: true,
            exists: !!product,
            product: product,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Stok kontrol hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Stok kontrol hatası',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET endpoint for sale check - NEW: Satış kontrolü
app.get('/api/satis-kontrol', async (req, res) => {
    try {
        const { id, satisId } = req.query;
        const saleId = id || satisId;
        
        // Eğer ID yoksa, tüm satışları getir
        if (!saleId) {
            const sales = db.prepare('SELECT * FROM satisGecmisi ORDER BY id DESC LIMIT 100').all();
            return res.json({
                success: true,
                data: sales,
                count: sales.length,
                message: sales.length > 0 ? 'Satışlar bulundu' : 'Henüz satış yok',
                timestamp: new Date().toISOString()
            });
        }
        
        // Belirli satışı kontrol et
        const sale = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?').get(saleId);
        
        res.json({
            success: true,
            exists: !!sale,
            sale: sale,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Satış kontrol hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Satış kontrol hatası',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET endpoint for customer check - NEW: Müşteri kontrolü
app.get('/api/musteri-kontrol', async (req, res) => {
    try {
        const { id, musteriId } = req.query;
        const customerId = id || musteriId;
        
        // Eğer ID yoksa, tüm müşterileri getir
        if (!customerId) {
            const customers = db.prepare('SELECT * FROM musteriler ORDER BY ad').all();
            return res.json({
                success: true,
                data: customers,
                count: customers.length,
                message: customers.length > 0 ? 'Müşteriler bulundu' : 'Henüz müşteri yok',
                timestamp: new Date().toISOString()
            });
        }
        
        // Belirli müşteriyi kontrol et
        const customer = db.prepare('SELECT * FROM musteriler WHERE id = ?').get(customerId);
        
        res.json({
            success: true,
            exists: !!customer,
            customer: customer,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Müşteri kontrol hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Müşteri kontrol hatası',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET endpoint for debt check - NEW: Borç kontrolü
app.get('/api/borc-kontrol', async (req, res) => {
    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Borç ID parametresi gerekli',
                timestamp: new Date().toISOString()
            });
        }
        
        // Borcu kontrol et
        const debt = db.prepare('SELECT * FROM borclarim WHERE id = ?').get(id);
        
        res.json({
            success: true,
            exists: !!debt,
            debt: debt,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Borç kontrol hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Borç kontrol hatası',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/urunler-barkod/:barkod - Aynı barkodlu ürünleri getir
app.get('/api/urunler-barkod/:barkod', async (req, res) => {
    try {
        const barkod = req.params.barkod;
        console.log('🔍 Barkod ile ürün aranıyor:', barkod);
        
        const products = db.prepare('SELECT * FROM stok WHERE barkod = ? ORDER BY updated_at DESC').all(barkod);
        
        res.json({
            success: true,
            data: products,
            count: products.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Barkod arama hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Barkod arama hatası',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET endpoint for all data - ULTRA OPTIMIZED
app.get('/api/tum-veriler', async (req, res) => {
    try {
        // Check cache first
        const cachedData = getCachedData('tum_veriler');
        if (cachedData) {
            console.log('⚡ Serving from cache');
            return res.json({
                success: true,
                data: cachedData,
                count: {
                    stok: Object.keys(cachedData.stokListesi || {}).length,
                    satis: (cachedData.satisGecmisi || []).length,
                    musteri: Object.keys(cachedData.musteriler || {}).length,
                    borc: Object.keys(cachedData.borclarim || {}).length
                },
                source: 'cache'
            });
        }
        
        console.log('📊 Loading all data from database...');
        
        const data = db.transaction(() => {
            let stokListesi = {};
            let satisGecmisi = [];
            let musteriler = {};
            let borclarim = {};
            
            // Get stok data with caching
            try {
                const stokRows = db.prepare('SELECT * FROM stok ORDER BY updated_at DESC').all();
                console.log(`�� Loading ${stokRows.length} stock items...`);
                
                stokRows.forEach(row => { 
                    const key = row.id || `${row.barkod}_${row.marka || ''}_${row.varyant_id || ''}`;
                    
                    if (!row.barkod) {
                        console.warn('⚠️ Skipping product without barcode:', row);
                        return;
                    }
                    
                    // Eski sistemden gelen verileri düzelt
                    let urunAdi = row.ad;
                    if (urunAdi === 'Bilinmeyen Ürün' || !urunAdi) {
                        // Barkod'dan ürün adı oluştur
                        urunAdi = `Ürün ${row.barkod}`;
                    }
                    
                    // Stok miktarını düzelt
                    let stokMiktari = row.miktar;
                    if (stokMiktari === 0 || stokMiktari === null) {
                        stokMiktari = 1; // Varsayılan stok miktarı
                    }
                    
                    stokListesi[key] = {
                        id: row.id,
                        barkod: row.barkod,
                        urun_adi: urunAdi,
                        marka: row.marka || '',
                        stok_miktari: stokMiktari,
                        alisFiyati: row.alisFiyati || 0,
                        satisFiyati: row.satisFiyati || 0,
                        kategori: row.kategori || '',
                        aciklama: row.aciklama || '',
                        urun_id: row.urun_id,
                        varyant_id: row.varyant_id || '',
                        created_at: row.created_at,
                        updated_at: row.updated_at
                    };
                });
                
                console.log(`✅ Successfully loaded ${Object.keys(stokListesi).length} products`);
            } catch (error) {
                console.error('❌ Error loading stock data:', error);
            }
            
            // Get satis data with duplicate prevention
            try {
                satisGecmisi = db.prepare('SELECT * FROM satisGecmisi ORDER BY tarih DESC').all();
                
                // Duplicate kontrolü ve veri temizleme
                const uniqueSales = [];
                const seenSales = new Set();
                
                satisGecmisi.forEach(sale => {
                    const saleKey = `${sale.barkod}_${sale.tarih}_${sale.miktar}_${sale.fiyat}`;
                    if (!seenSales.has(saleKey)) {
                        seenSales.add(saleKey);
                        uniqueSales.push(sale);
                    }
                });
                
                satisGecmisi = uniqueSales;
                // Enrich missing purchase prices for sales from stock (display-only)
                try {
                    const getAlisFromStock = db.prepare('SELECT alisFiyati FROM stok WHERE barkod = ?');
                    satisGecmisi.forEach(sale => {
                        const currentAlis = parseFloat(sale.alisFiyati) || 0;
                        if ((currentAlis === 0 || Number.isNaN(currentAlis)) && sale.barkod) {
                            const row = getAlisFromStock.get(sale.barkod);
                            if (row && (row.alisFiyati || row.alisFiyati === 0)) {
                                sale.alisFiyati = row.alisFiyati || 0;
                            }
                        }
                    });
                } catch (e) {
                    console.warn('⚠️ Could not enrich sales with purchase prices:', e.message);
                }
                console.log(`📊 Loaded ${satisGecmisi.length} unique sales from database`);
                
            } catch (e) {
                console.warn('⚠️ Satis query error:', e.message);
                satisGecmisi = [];
            }
            
            // Get musteriler data
            try {
                const musteriRows = db.prepare('SELECT * FROM musteriler ORDER BY updated_at DESC').all();
                musteriRows.forEach(row => { musteriler[row.id] = row; });
            } catch (e) {
                console.warn('⚠️ Musteri query error:', e.message);
            }
            
            // Get borclarim data
            try {
                const borcRows = db.prepare('SELECT * FROM borclarim ORDER BY tarih DESC').all();
                borcRows.forEach(row => { borclarim[row.id] = row; });
            } catch (e) {
                console.warn('⚠️ Borc query error:', e.message);
            }
            
            return { stokListesi, satisGecmisi, musteriler, borclarim };
        })();
        
        // Cache the result
        setCachedData('tum_veriler', data);
        
        const count = {
            stok: Object.keys(data.stokListesi).length,
            satis: data.satisGecmisi.length,
            musteri: Object.keys(data.musteriler).length,
            borc: Object.keys(data.borclarim).length
        };
        
        console.log('📊 Data loaded successfully:', count);
        
        res.json({
            success: true,
            data: data,
            count: count,
            source: 'database'
        });
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        res.status(500).json({
            success: false,
            error: 'Veri yüklenirken hata oluştu'
        });
    }
});

// POST endpoint for bulk data synchronization
app.post('/api/tum-veriler', async (req, res) => {
    try {
        const { stokListesi, satisGecmisi, musteriler, borclarim } = req.body;
        
        if (!stokListesi || !satisGecmisi || !musteriler || !borclarim) {
            return res.status(400).json({
                success: false,
                error: 'Eksik veri parametreleri',
                timestamp: new Date().toISOString()
            });
        }
        
        // console.log('📡 POST /api/tum-veriler - Bulk sync started');
        // console.log('📊 Import data summary:', {
        //     stok: Object.keys(stokListesi).length,
        //     satis: satisGecmisi.length,
        //     musteri: Object.keys(musteriler).length,
        //     borc: Object.keys(borclarim).length
        // });
        
        const result = db.transaction(() => {
            let updatedCount = 0;
            let insertedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            
            // Sync stok data with improved deduplication
            for (const [key, urun] of Object.entries(stokListesi)) {
                try {
                    // Handle key format consistently - extract barkod from urun object, not from key
                    const barkod = urun.barkod;
                    const marka = urun.marka || '';
                    const varyant_id = urun.varyant_id || '';
                    
                    if (!barkod) {
                        console.warn('⚠️ Skipping product without barcode:', urun);
                        skippedCount++;
                        continue;
                    }
                    
                    // Check for existing record with same barcode, marka, and varyant_id
                    const existing = db.prepare('SELECT id FROM stok WHERE barkod = ? AND marka = ? AND varyant_id = ?').get(barkod, marka, varyant_id);
                    
                    if (existing) {
                        // Update existing record only if data is different
                        const currentData = db.prepare('SELECT * FROM stok WHERE id = ?').get(existing.id);
                        const hasChanges = (
                            currentData.ad !== (urun.urun_adi || urun.ad || '') ||
                            currentData.miktar !== (parseInt(urun.stok_miktari || urun.miktar) || 0) ||
                            currentData.satisFiyati !== (parseFloat(urun.fiyat) || 0) ||
                            currentData.alisFiyati !== (parseFloat(urun.alisFiyati) || 0) ||
                            currentData.kategori !== (urun.kategori || '')
                        );
                        
                        if (hasChanges) {
                            // Ensure proper data types and handle null/undefined values
                            // Map frontend format back to database format
                            const ad = urun.urun_adi || urun.ad || '';
                            const miktar = parseInt(urun.stok_miktari || urun.miktar) || 0;
                            const satisFiyati = parseFloat(urun.fiyat) || 0;
                            const alisFiyati = parseFloat(urun.alisFiyati) || 0;
                            const kategori = urun.kategori || '';
                            
                            db.prepare(`
                                UPDATE stok SET 
                                    ad = ?, miktar = ?, satisFiyati = ?, alisFiyati = ?, 
                                    kategori = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE barkod = ? AND marka = ? AND varyant_id = ?
                            `).run(ad, miktar, satisFiyati, alisFiyati, kategori, barkod, marka, varyant_id);
                            updatedCount++;
                        } else {
                            skippedCount++; // No changes needed
                        }
                    } else {
                        // Insert new record - allow multiple products with same barcode
                        // Ensure proper data types and handle null/undefined values
                        // Map frontend format to database format
                        const ad = urun.urun_adi || urun.ad || '';
                        const miktar = parseInt(urun.stok_miktari || urun.miktar) || 0;
                        const satisFiyati = parseFloat(urun.fiyat) || 0;
                        const alisFiyati = parseFloat(urun.alisFiyati) || 0;
                        const kategori = urun.kategori || '';
                        
                        db.prepare(`
                            INSERT INTO stok (barkod, ad, marka, miktar, satisFiyati, alisFiyati, kategori, varyant_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(barkod, ad, marka, miktar, satisFiyati, alisFiyati, kategori, varyant_id);
                        insertedCount++;
                    }
                } catch (e) {
                    console.warn(`⚠️ Stok sync error for ${key}:`, e.message);
                    errorCount++;
                }
            }
            
            // Sync satis data with improved deduplication
            for (const satis of satisGecmisi) {
                try {
                    if (!satis.barkod || !satis.miktar) {
                        console.warn('⚠️ Skipping invalid sales record:', satis);
                        skippedCount++;
                        continue;
                    }
                    
                    // Use composite key for sales deduplication (barkod + tarih + miktar + fiyat)
                    const existing = db.prepare(`
                        SELECT id FROM satisGecmisi 
                        WHERE barkod = ? AND tarih = ? AND miktar = ? AND fiyat = ?
                    `).get(satis.barkod, satis.tarih, satis.miktar, satis.fiyat);
                    
                    if (!existing) {
                        // Ensure proper data types and handle null/undefined values
                        const barkod = satis.barkod || '';
                        const miktar = parseInt(satis.miktar) || 0;
                        const fiyat = parseFloat(satis.fiyat) || 0;
                        const alisFiyati = parseFloat(satis.alisFiyati) || 0;
                        const musteriId = satis.musteriId || null;
                        const tarih = satis.tarih || new Date().toISOString();
                        const borc = satis.borc ? 1 : 0;
                        const toplam = parseFloat(satis.toplam) || 0;
                        
                        db.prepare(`
                            INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, alisFiyati, toplam, borc, tarih, musteriId, musteriAdi)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(barkod, satis.urunAdi || '', miktar, fiyat, alisFiyati, toplam, borc, tarih, musteriId, satis.musteriAdi || '');
                        insertedCount++;
                    } else {
                        skippedCount++; // Duplicate sales record
                    }
                } catch (e) {
                    console.warn(`⚠️ Satis sync error for ${satis.id}:`, e.message);
                    errorCount++;
                }
            }
            
            // Sync musteriler data with improved deduplication
            for (const [id, musteri] of Object.entries(musteriler)) {
                try {
                    if (!id || !musteri.ad) {
                        console.warn('⚠️ Skipping invalid customer record:', musteri);
                        skippedCount++;
                        continue;
                    }
                    
                    const existing = db.prepare('SELECT id FROM musteriler WHERE id = ?').get(id);
                    
                    if (existing) {
                        // Update only if data is different
                        const currentData = db.prepare('SELECT * FROM musteriler WHERE id = ?').get(id);
                        const hasChanges = (
                            currentData.ad !== (musteri.ad || '') ||
                            currentData.telefon !== (musteri.telefon || '') ||
                            currentData.adres !== (musteri.adres || '') ||
                            currentData.bakiye !== (parseFloat(musteri.bakiye) || 0)
                        );
                        
                        if (hasChanges) {
                            // Ensure proper data types and handle null/undefined values
                            const ad = musteri.ad || '';
                            const telefon = musteri.telefon || '';
                            const adres = musteri.adres || '';
                            const bakiye = parseFloat(musteri.bakiye) || 0;
                            
                            db.prepare(`
                                UPDATE musteriler SET 
                                    ad = ?, telefon = ?, adres = ?, bakiye = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(ad, telefon, adres, bakiye, id);
                            updatedCount++;
                        } else {
                            skippedCount++; // No changes needed
                        }
                    } else {
                        // Insert new customer
                        // Ensure proper data types and handle null/undefined values
                        const ad = musteri.ad || '';
                        const telefon = musteri.telefon || '';
                        const adres = musteri.adres || '';
                        const bakiye = parseFloat(musteri.bakiye) || 0;
                        
                        db.prepare(`
                            INSERT INTO musteriler (id, ad, telefon, adres, bakiye)
                            VALUES (?, ?, ?, ?, ?)
                        `).run(id, ad, telefon, adres, bakiye);
                        insertedCount++;
                    }
                } catch (e) {
                    console.warn(`⚠️ Musteri sync error for ${id}:`, e.message);
                    errorCount++;
                }
            }
            
            // Sync borclarim data with improved deduplication
            for (const [id, borc] of Object.entries(borclarim)) {
                try {
                    if (!id) {
                        console.warn('⚠️ Skipping invalid debt record (no ID):', borc);
                        skippedCount++;
                        continue;
                    }
                    
                    const existing = db.prepare('SELECT id FROM borclarim WHERE id = ?').get(id);
                    
                    if (existing) {
                        // Update only if data is different
                        const currentData = db.prepare('SELECT * FROM borclarim WHERE id = ?').get(id);
                        const hasChanges = (
                            currentData.alacakli !== (borc.alacakli || borc.musteriAdi || '') ||
                            currentData.miktar !== (parseFloat(borc.miktar) || 0) ||
                            currentData.aciklama !== (borc.aciklama || '') ||
                            currentData.tarih !== (borc.tarih || new Date().toISOString())
                        );
                        
                        if (hasChanges) {
                            // Ensure proper data types and handle null/undefined values
                            const alacakli = borc.alacakli || borc.musteriAdi || '';
                            const miktar = parseFloat(borc.miktar) || 0;
                            const aciklama = borc.aciklama || '';
                            const tarih = borc.tarih || new Date().toISOString();
                            const odemeTarihi = borc.odemeTarihi || null;
                            const durum = borc.durum || 'Ödenmedi';
                            
                            db.prepare(`
                                UPDATE borclarim SET 
                                    alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, 
                                    odemeTarihi = ?, durum = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(alacakli, miktar, aciklama, tarih, odemeTarihi, durum, id);
                            updatedCount++;
                        } else {
                            skippedCount++; // No changes needed
                        }
                    } else {
                        // Insert new debt record
                        // Ensure proper data types and handle null/undefined values
                        const alacakli = borc.alacakli || borc.musteriAdi || '';
                        const miktar = parseFloat(borc.miktar) || 0;
                        const aciklama = borc.aciklama || '';
                        const tarih = borc.tarih || new Date().toISOString();
                        const odemeTarihi = borc.odemeTarihi || null;
                        const durum = borc.durum || 'Ödenmedi';
                        
                        db.prepare(`
                            INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).run(id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum);
                        insertedCount++;
                    }
                } catch (e) {
                    console.warn(`⚠️ Borc sync error for ${id}:`, e.message);
                    errorCount++;
                }
            }
            
            return { updatedCount, insertedCount, skippedCount, errorCount };
        })();
        
        console.log('📊 Sync result:', result);
        
        res.json({
            success: true,
            message: 'Veriler başarıyla senkronize edildi',
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tum veriler POST error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/database-status', (req, res) => {
    try {
        const status = {
            connected: db !== null,
            path: dbPath,
            tables: [],
            indexes: []
        };
        
        if (db) {
            // Get table info
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            status.tables = tables.map(t => t.name);
            
            // Get index info
            const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
            status.indexes = indexes.map(i => i.name);
            
            // Test connection
            const test = db.prepare('SELECT 1 as test').get();
            status.test = test.test;
        }
        
        res.json({
            success: true,
            status: status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Database status error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
    try {
        const debug = {
            server: {
                status: 'running',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version,
                platform: process.platform
            },
            database: {
                status: db !== null ? 'connected' : 'disconnected',
                path: dbPath,
                tables: []
            }
        };

        if (db) {
            // Get table information
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            debug.database.tables = tables.map(table => {
                try {
                    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
                    return {
                        name: table.name,
                        count: count,
                        status: 'ok'
                    };
                } catch (e) {
                    return {
                        name: table.name,
                        count: 0,
                        status: 'error'
                    };
                }
            });
        }

        res.json({
            success: true,
            debug: debug,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced backup function
async function sendDailyBackup() {
    try {
        console.log('🔄 Günlük yedekleme başlatılıyor...');
        
        // Create backup directory
        const backupDir = path.join(__dirname, 'veriler', 'backups');
        fs.ensureDirSync(backupDir);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup_${timestamp}.db`);
        const jsonBackupPath = path.join(backupDir, `backup_${timestamp}.json`);
        
        // Copy database
        fs.copyFileSync(dbPath, backupPath);
        
        // Create JSON backup
        const backupData = {
            timestamp: new Date().toISOString(),
            stokListesi: {},
            satisGecmisi: [],
            musteriler: {},
            borclarim: {}
        };
        
        // Get all data - ESKİ SİSTEM FORMATI
        const stokRows = db.prepare('SELECT * FROM stok').all();
        stokRows.forEach(row => {
            // Eski sistem formatı: barkod_marka_varyant_id
            const compositeKey = `${row.barkod}_${row.marka || ''}_${row.varyant_id || ''}`;
            backupData.stokListesi[compositeKey] = {
                barkod: row.barkod,
                urun_adi: row.ad,
                marka: row.marka,
                stok_miktari: row.miktar,
                alisFiyati: row.alisFiyati,
                satisFiyati: row.satisFiyati,
                kategori: row.kategori,
                aciklama: row.aciklama,
                urun_id: row.urun_id,
                varyant_id: row.varyant_id,
                created_at: row.created_at,
                updated_at: row.updated_at
            };
        });
        
        const satisRows = db.prepare('SELECT * FROM satisGecmisi ORDER BY tarih DESC').all();
        backupData.satisGecmisi = satisRows;
        
        const musteriRows = db.prepare('SELECT * FROM musteriler').all();
        musteriRows.forEach(row => {
            backupData.musteriler[row.id] = {
                ad: row.ad,
                telefon: row.telefon,
                adres: row.adres,
                aciklama: row.aciklama,
                bakiye: row.bakiye,
                created_at: row.created_at,
                updated_at: row.updated_at
            };
        });
        
        const borcRows = db.prepare('SELECT * FROM borclarim ORDER BY tarih DESC').all();
        borcRows.forEach(row => {
            backupData.borclarim[row.id] = {
                alacakli: row.alacakli,
                miktar: row.miktar,
                aciklama: row.aciklama,
                tarih: row.tarih,
                odemeTarihi: row.odemeTarihi,
                durum: row.durum,
                created_at: row.created_at,
                updated_at: row.updated_at
            };
        });
        
        // Save JSON backup
        fs.writeFileSync(jsonBackupPath, JSON.stringify(backupData, null, 2));
        
        // Get database stats
        const stats = {
            stokCount: Object.keys(backupData.stokListesi).length,
            satisCount: backupData.satisGecmisi.length,
            musteriCount: Object.keys(backupData.musteriler).length,
            borcCount: Object.keys(backupData.borclarim).length
        };
        
        console.log('✅ Yedekleme tamamlandı:');
        console.log(`   📁 Veritabanı: ${path.basename(backupPath)}`);
        console.log(`   📄 JSON: ${path.basename(jsonBackupPath)}`);
        console.log(`   📊 İstatistikler: ${stats.stokCount} ürün, ${stats.satisCount} satış, ${stats.musteriCount} müşteri, ${stats.borcCount} borç`);
        
        // Send email if transporter is configured
        if (transporter) {
            const mailOptions = {
                from: emailConfig.auth.user,
                to: emailConfig.auth.user,
                subject: `Günlük Veri Yedeği - ${new Date().toLocaleDateString('tr-TR')}`,
                html: `
                    <h2>📊 Günlük Veri Yedeği</h2>
                    <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
                    <p><strong>Veritabanı İstatistikleri:</strong></p>
                    <ul>
                        <li>📦 Ürün Sayısı: ${stats.stokCount}</li>
                        <li>💰 Satış Sayısı: ${stats.satisCount}</li>
                        <li>👥 Müşteri Sayısı: ${stats.musteriCount}</li>
                        <li>💳 Borç Sayısı: ${stats.borcCount}</li>
                    </ul>
                    <p><strong>Yedek Dosyaları:</strong></p>
                    <ul>
                        <li>Veritabanı: ${path.basename(backupPath)}</li>
                        <li>JSON: ${path.basename(jsonBackupPath)}</li>
                    </ul>
                    <p><em>Bu yedek dosyaları bilgisayarınızda saklanmaktadır.</em></p>
                `,
                attachments: [
                    {
                        filename: `backup_${timestamp}.db`,
                        path: backupPath
                    },
                    {
                        filename: `backup_${timestamp}.json`,
                        path: jsonBackupPath
                    }
                ]
            };
            
            await transporter.sendMail(mailOptions);
            console.log('✅ Yedekleme email gönderildi');
        } else {
            console.warn('⚠️ Email transporter yapılandırılmamış, sadece dosya yedeği oluşturuldu');
        }
        
        // Clean up old backups (keep last 10 files)
        const files = fs.readdirSync(backupDir);
        const backupFiles = files
            .filter(f => f.startsWith('daily_backup_'))
            .sort()
            .reverse();
            
        if (backupFiles.length > 10) {
            const filesToDelete = backupFiles.slice(10);
            filesToDelete.forEach(file => {
                fs.removeSync(path.join(backupDir, file));
                console.log(`🗑️ Eski yedek silindi: ${file}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Günlük yedekleme hatası:', error);
    }
}

// Schedule daily backup at 23:00
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 0) {
        sendDailyBackup();
    }
}, 60000); // Check every minute

// POST /api/backup-manual - Manuel yedekleme
app.post('/api/backup-manual', async (req, res) => {
    try {
        console.log('🔄 Manuel yedekleme isteği alındı');
        await sendDailyBackup();
        
        res.json({
            success: true,
            message: 'Manuel yedekleme başarıyla tamamlandı',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Manuel yedekleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Manuel yedekleme başarısız',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Excel export endpoint
app.post('/api/export-excel', async (req, res) => {
    try {
        console.log('📊 Excel export isteği alındı');
        const { tables } = req.body; // ['stok', 'satisGecmisi', 'musteriler', 'borclarim']
        
        const workbook = XLSX.utils.book_new();
        
        // Stok verilerini export et
        if (!tables || tables.includes('stok')) {
            const stokData = db.prepare('SELECT * FROM stok ORDER BY id').all();
            const stokWS = XLSX.utils.json_to_sheet(stokData);
            XLSX.utils.book_append_sheet(workbook, stokWS, 'Stok');
        }
        
        // Satış verilerini export et  
        if (!tables || tables.includes('satisGecmisi')) {
            const satisData = db.prepare('SELECT * FROM satisGecmisi ORDER BY id DESC').all();
            const satisWS = XLSX.utils.json_to_sheet(satisData);
            XLSX.utils.book_append_sheet(workbook, satisWS, 'Satış Geçmişi');
        }
        
        // Müşteri verilerini export et
        if (!tables || tables.includes('musteriler')) {
            const musteriData = db.prepare('SELECT * FROM musteriler ORDER BY ad').all();
            const musteriWS = XLSX.utils.json_to_sheet(musteriData);
            XLSX.utils.book_append_sheet(workbook, musteriWS, 'Müşteriler');
        }
        
        // Borç verilerini export et
        if (!tables || tables.includes('borclarim')) {
            const borcData = db.prepare('SELECT * FROM borclarim ORDER BY tarih DESC').all();
            const borcWS = XLSX.utils.json_to_sheet(borcData);
            XLSX.utils.book_append_sheet(workbook, borcWS, 'Borçlarım');
        }
        
        // Özet sayfası ekle
        const summary = {
            'Rapor Tarihi': new Date().toLocaleString('tr-TR'),
            'Toplam Ürün': db.prepare('SELECT COUNT(*) as count FROM stok').get().count,
            'Toplam Satış': db.prepare('SELECT COUNT(*) as count FROM satisGecmisi').get().count,
            'Toplam Müşteri': db.prepare('SELECT COUNT(*) as count FROM musteriler').get().count,
            'Toplam Borç': db.prepare('SELECT COUNT(*) as count FROM borclarim').get().count,
            'Toplam Stok Değeri': db.prepare('SELECT SUM(alisFiyati * miktar) as total FROM stok').get().total || 0
        };
        
        const summaryWS = XLSX.utils.json_to_sheet([summary]);
        XLSX.utils.book_append_sheet(workbook, summaryWS, 'Özet');
        
        // Dosya adı oluştur
        const fileName = `Sabancioglu_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(__dirname, 'backups', fileName);
        
        // Backups klasörünü oluştur
        await fs.ensureDir(path.join(__dirname, 'backups'));
        
        // Excel dosyasını kaydet
        XLSX.writeFile(workbook, filePath);
        
        console.log('✅ Excel export tamamlandı:', fileName);
        
        res.json({
            success: true,
            message: 'Excel export başarıyla tamamlandı',
            fileName: fileName,
            filePath: filePath,
            fileSize: (await fs.stat(filePath)).size,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Excel export hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Excel export hatası: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Excel dosyasını download et
app.get('/api/download-excel/:fileName', async (req, res) => {
    try {
        const { fileName } = req.params;
        const filePath = path.join(__dirname, 'backups', fileName);
        
        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Dosya bulunamadı'
            });
        }
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('❌ Excel download hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Download hatası: ' + error.message
        });
    }
});

// Kategori endpoint'leri
app.get('/api/categories', async (req, res) => {
    try {
        // Mevcut kategorileri getir
        const categories = db.prepare(`
            SELECT kategori, COUNT(*) as count 
            FROM stok 
            WHERE kategori IS NOT NULL AND kategori != '' 
            GROUP BY kategori 
            ORDER BY count DESC
        `).all();
        
        // Varsayılan kategoriler
        const defaultCategories = [
            'Amortisör', 'Fren Sistemi', 'Motor Parçaları', 'Elektrik',
            'Kaporta', 'İç Aksam', 'Şanzıman', 'Direksiyon', 
            'Yakıt Sistemi', 'Soğutma', 'Kalorifer', 'Lastik/Jant'
        ];
        
        res.json({
            success: true,
            categories: categories,
            defaultCategories: defaultCategories,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Kategori listesi hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Kategori listesi alınamadı: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.post('/api/categorize-products', async (req, res) => {
    try {
        const { categoryMappings } = req.body; // { "keyword": "category" }
        
        let updateCount = 0;
        const updateStmt = db.prepare('UPDATE stok SET kategori = ? WHERE ad LIKE ? OR aciklama LIKE ?');
        
        Object.entries(categoryMappings).forEach(([keyword, category]) => {
            const likePattern = `%${keyword}%`;
            const result = updateStmt.run(category, likePattern, likePattern);
            updateCount += result.changes;
        });
        
        res.json({
            success: true,
            message: `${updateCount} ürün kategorize edildi`,
            updatedCount: updateCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Kategorizasyon hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Kategorizasyon hatası: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/products-by-category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        
        const products = db.prepare('SELECT * FROM stok WHERE kategori = ? ORDER BY ad').all(category);
        
        res.json({
            success: true,
            category: category,
            products: products,
            count: products.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Kategoriye göre ürün getirme hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Kategoriye göre ürün getirme hatası: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Toplu satış endpoint'i
app.post('/api/satis-toplu', async (req, res) => {
    try {
        const { items, musteriId, musteriAdi } = req.body;
        // items: [{ barkod, miktar, urunAdi, fiyat, alisFiyati }]
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Satış kalemi listesi gerekli',
                timestamp: new Date().toISOString()
            });
        }
        
        const salesResults = [];
        const stockUpdates = [];
        let totalAmount = 0;
        
        const transaction = db.transaction(() => {
            for (const item of items) {
                const { barkod, miktar, urunAdi, fiyat, alisFiyati } = item;
                
                // Stok kontrolü
                const stockItem = db.prepare('SELECT * FROM stok WHERE barkod = ?').get(barkod);
                if (!stockItem) {
                    throw new Error(`Ürün bulunamadı: ${barkod}`);
                }
                
                if (stockItem.miktar < miktar) {
                    throw new Error(`Yetersiz stok: ${stockItem.ad} (Mevcut: ${stockItem.miktar}, İstenilen: ${miktar})`);
                }
                
                // Satış kaydı ekle
                const toplam = (parseFloat(fiyat) || 0) * (parseInt(miktar) || 0);
                const saleId = db.prepare(`
                    INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, alisFiyati, toplam, borc, tarih, musteriId, musteriAdi, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(barkod, urunAdi || stockItem.ad, miktar, fiyat, alisFiyati || stockItem.alisFiyati, toplam, 0, new Date().toISOString(), musteriId, musteriAdi).lastInsertRowid;
                
                // Stok güncelle
                const newStock = stockItem.miktar - miktar;
                db.prepare('UPDATE stok SET miktar = ?, updated_at = CURRENT_TIMESTAMP WHERE barkod = ?').run(newStock, barkod);
                
                salesResults.push({
                    saleId: saleId,
                    barkod: barkod,
                    urunAdi: urunAdi || stockItem.ad,
                    miktar: miktar,
                    fiyat: fiyat,
                    newStock: newStock
                });
                
                totalAmount += fiyat * miktar;
            }
        });
        
        transaction();
        
        console.log(`✅ Toplu satış tamamlandı: ${items.length} kalem, toplam: ${totalAmount.toFixed(2)} ₺`);
        
        res.json({
            success: true,
            message: `${items.length} ürün başarıyla satıldı`,
            sales: salesResults,
            totalAmount: totalAmount,
            itemCount: items.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Toplu satış hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Toplu satış hatası: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Gelişmiş backup analiz endpoint
app.get('/api/backup-analysis', async (req, res) => {
    try {
        console.log('🔍 Backup analizi başlatılıyor...');
        
        const analysis = {
            database: {
                size: (await fs.stat(dbPath)).size,
                tables: {},
                lastModified: (await fs.stat(dbPath)).mtime
            },
            backup_files: [],
            schema: {},
            integrity: {}
        };
        
        // Tablo analizi
        const tables = ['stok', 'satisGecmisi', 'musteriler', 'borclarim'];
        for (const table of tables) {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
            
            // Her tablo için schema kontrol et
            const schema = db.prepare(`PRAGMA table_info(${table})`).all();
            const hasUpdatedAt = schema.some(column => column.name === 'updated_at');
            
            analysis.database.tables[table] = {
                records: count,
                columns: schema.length,
                last_updated: hasUpdatedAt ? 
                    db.prepare(`SELECT MAX(updated_at) as last FROM ${table} WHERE updated_at IS NOT NULL`).get()?.last || null :
                    'N/A (no updated_at column)'
            };
        }
        
        // Backup dosyaları analizi
        const backupDir = path.join(__dirname, 'backups');
        if (await fs.pathExists(backupDir)) {
            const files = await fs.readdir(backupDir);
            
            for (const file of files) {
                if (file.endsWith('.json') || file.endsWith('.db') || file.endsWith('.xlsx')) {
                    const filePath = path.join(backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    analysis.backup_files.push({
                        name: file,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: path.extname(file)
                    });
                }
            }
        }
        
        // Schema analizi
        const schema = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
        analysis.schema = schema.reduce((acc, table) => {
            acc[table.name] = table.sql;
            return acc;
        }, {});
        
        // Veri bütünlüğü kontrolü
        analysis.integrity = {
            orphaned_sales: db.prepare(`
                SELECT COUNT(*) as count 
                FROM satisGecmisi s 
                LEFT JOIN stok st ON s.barkod = st.barkod 
                WHERE st.barkod IS NULL
            `).get().count,
            
            duplicate_barcodes: db.prepare(`
                SELECT COUNT(*) as count 
                FROM (
                    SELECT barkod, COUNT(*) 
                    FROM stok 
                    GROUP BY barkod 
                    HAVING COUNT(*) > 1
                )
            `).get().count,
            
            invalid_customers: db.prepare(`
                SELECT COUNT(*) as count 
                FROM satisGecmisi 
                WHERE musteriId IS NOT NULL 
                AND musteriId NOT IN (SELECT id FROM musteriler)
            `).get().count
        };
        
        console.log('✅ Backup analizi tamamlandı');
        
        res.json({
            success: true,
            analysis: analysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Backup analizi hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Analiz hatası: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/stok-ekle - Tek ürün ekle
app.post('/api/stok-ekle', async (req, res) => {
    try {
        const urun = req.body;
        console.log('📦 Yeni ürün ekleniyor:', urun.barkod, urun.ad);
        
        // Validate required fields
        if (!urun.barkod || !urun.ad) {
            return res.status(400).json({
                success: false,
                message: 'Barkod ve ürün adı zorunludur',
                timestamp: new Date().toISOString()
            });
        }
        
        // Ensure proper data types and handle null/undefined values
        const barkod = urun.barkod || '';
        const ad = urun.ad || '';
        const marka = urun.marka || '';
        const miktar = parseInt(urun.miktar) || 0;
        const alisFiyati = parseFloat(urun.alisFiyati) || 0;
        const satisFiyati = parseFloat(urun.satisFiyati) || 0;
        const kategori = urun.kategori || '';
        const aciklama = urun.aciklama || '';
        const varyant_id = urun.varyant_id || '';
        
        // Generate unique product ID
        const urun_id = generateUrunId();
        
        // Check if exact same product exists (barcode + brand + variant combination)
        const existingProduct = db.prepare('SELECT * FROM stok WHERE barkod = ? AND marka = ? AND varyant_id = ?').get(barkod, marka, varyant_id);
        
        if (existingProduct) {
            // Exact same product exists - warn user and offer to update
            res.status(409).json({ 
                success: false, 
                message: `Bu ürün zaten mevcut: ${existingProduct.ad}`,
                existingProduct: existingProduct,
                conflict: true,
                timestamp: new Date().toISOString()
            });
            return;
        } else {
            // Check if barcode exists with different properties
            const existingBarcodeProducts = db.prepare('SELECT * FROM stok WHERE barkod = ?').all(barkod);
            
            // If force_add is true, allow adding even with same barcode
            if (urun.force_add) {
                // Insert new product with unique urun_id (allows multiple products with same barcode but different properties)
                const result = db.prepare(`
                    INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id);
                
                // Get the inserted product with its ID
                const insertedProduct = db.prepare('SELECT * FROM stok WHERE urun_id = ?').get(urun_id);
                
                // Real-time sync to all clients
                io.emit('dataUpdated', {
                    type: 'stok-add',
                    data: insertedProduct,
                    timestamp: new Date().toISOString()
                });
                
                res.status(201).json({ 
                    success: true, 
                    message: 'Yeni ürün başarıyla eklendi (aynı barkod)', 
                    data: insertedProduct,
                    isUpdate: false,
                    existingVariants: existingBarcodeProducts.length,
                    timestamp: new Date().toISOString()
                });
                return;
            }
            
            // Insert new product with unique urun_id (allows multiple products with same barcode but different properties)
            const result = db.prepare(`
                INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id);
            
            // Get the inserted product with its ID
            const insertedProduct = db.prepare('SELECT * FROM stok WHERE barkod = ? AND marka = ? AND varyant_id = ?').get(barkod, marka, varyant_id);
            
            // Real-time sync to all clients - FIX: broadcast to all clients
            io.emit('dataUpdated', {
                type: 'stok-add',
                data: insertedProduct,
                timestamp: new Date().toISOString()
            });
            
            res.status(201).json({ 
                success: true, 
                message: existingBarcodeProducts.length > 0 ? 
                    `Yeni ürün eklendi. Bu barkod ile ${existingBarcodeProducts.length} farklı ürün mevcut.` : 
                    'Yeni ürün başarıyla eklendi', 
                data: insertedProduct,
                isUpdate: false,
                existingVariants: existingBarcodeProducts.length,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Ürün eklenirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ürün eklenirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/stok-guncelle - Ürün güncelle
app.put('/api/stok-guncelle', async (req, res) => {
    try {
        const urun = req.body;
        console.log('🔄 Ürün güncelleniyor:', urun.barkod);
        
        // Ensure proper data types and handle null/undefined values
        const barkod = urun.barkod || '';
        const ad = urun.ad || '';
        const marka = urun.marka || '';
        const miktar = parseInt(urun.miktar) || 0;
        const alisFiyati = parseFloat(urun.alisFiyati) || 0;
        const satisFiyati = parseFloat(urun.satisFiyati) || 0;
        const kategori = urun.kategori || '';
        const aciklama = urun.aciklama || '';
        const varyant_id = urun.varyant_id || '';
        const id = urun.id; // Use ID for precise update
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Ürün ID gerekli',
                timestamp: new Date().toISOString()
            });
        }
        
        const result = db.prepare(`
            UPDATE stok SET 
                ad = ?, marka = ?, miktar = ?, alisFiyati = ?, satisFiyati = ?, 
                kategori = ?, aciklama = ?, varyant_id = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, id);
        
        if (result.changes > 0) {
            // Get the updated product with its ID
            const updatedProduct = db.prepare('SELECT * FROM stok WHERE id = ?').get(id);
            
            // Real-time sync to all clients - FIX: broadcast to all clients
            io.emit('dataUpdated', {
                type: 'stok-update',
                data: updatedProduct,
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                message: 'Ürün başarıyla güncellendi', 
                data: updatedProduct,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Ürün bulunamadı', 
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Ürün güncellenirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ürün güncellenirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/stok-varyantlar/:barkod - Aynı barkodlu ürün varyantlarını getir
app.get('/api/stok-varyantlar/:barkod', async (req, res) => {
    try {
        const { barkod } = req.params;
        console.log('🔍 Barkod varyantları aranıyor:', barkod);
        
        const variants = db.prepare('SELECT * FROM stok WHERE barkod = ? ORDER BY marka, varyant_id').all(barkod);
        
        res.json({
            success: true,
            data: variants,
            count: variants.length,
            barkod: barkod,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Varyant arama hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Varyant arama hatası',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/stok-sil/:id - Ürün sil (ID tabanlı)
app.delete('/api/stok-sil/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query; // force=true ise satışlı ürünü de sil
        console.log('🗑️ Ürün siliniyor (ID):', id);
        
        // Get product info before deletion for sync
        const productToDelete = db.prepare('SELECT * FROM stok WHERE id = ?').get(id);
        
        if (!productToDelete) {
            return res.status(404).json({ 
                success: false,
                message: 'Ürün bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
        // Satış kontrolü - eğer ürün satılmışsa uyar
        if (!force) {
            const salesCount = db.prepare('SELECT COUNT(*) as count FROM satisGecmisi WHERE barkod = ?').get(productToDelete.barkod).count;
            
            if (salesCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Bu ürün daha önce ${salesCount} kez satılmış. Silmek için force=true parametresi ekleyin veya ürünü iade işlemi yapın.`,
                    barkod: productToDelete.barkod,
                    salesCount: salesCount,
                    canDelete: false,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        const result = db.prepare('DELETE FROM stok WHERE id = ?').run(id);
        
        if (result.changes > 0) {
            // Real-time sync to all clients - FIX: broadcast to all clients with product info
            io.emit('dataUpdated', {
                type: 'stok-delete',
                data: { id, barkod: productToDelete.barkod, productInfo: productToDelete },
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                message: 'Ürün başarıyla silindi',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Ürün bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Ürün silinirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ürün silinirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/stok-sil-barkod/:barkod - Ürün sil (Barkod tabanlı - backward compatibility)
app.delete('/api/stok-sil-barkod/:barkod', async (req, res) => {
    try {
        const { barkod } = req.params;
        const { force } = req.query; // force=true ise satışlı ürünü de sil
        console.log('🗑️ Ürün siliniyor (Barkod):', barkod);
        
        // Get products with this barcode before deletion
        const productsToDelete = db.prepare('SELECT * FROM stok WHERE barkod = ?').all(barkod);
        
        if (productsToDelete.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Ürün bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
        // Satış kontrolü - eğer ürün satılmışsa uyar
        if (!force) {
            const salesCount = db.prepare('SELECT COUNT(*) as count FROM satisGecmisi WHERE barkod = ?').get(barkod).count;
            
            if (salesCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Bu ürün daha önce ${salesCount} kez satılmış. Silmek için force=true parametresi ekleyin veya ürünü iade işlemi yapın.`,
                    barkod: barkod,
                    salesCount: salesCount,
                    canDelete: false,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        const result = db.prepare('DELETE FROM stok WHERE barkod = ?').run(barkod);
        
        if (result.changes > 0) {
            // Real-time sync to all clients - FIX: broadcast to all clients
            io.emit('dataUpdated', {
                type: 'stok-delete-all-variants',
                data: { barkod, deletedProducts: productsToDelete },
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                message: `${result.changes} ürün başarıyla silindi`,
                deletedCount: result.changes,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Ürün bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Ürün silinirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ürün silinirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Satış ekleme endpoint'i - STOK GÜNCELLEME İLE BİRLİKTE
app.post('/api/satis-ekle', async (req, res) => {
    try {
        const satis = req.body;
        
        console.log('💰 Yeni satış ekleniyor:', satis.barkod, satis.miktar);
        
        // Validate required fields
        if (!satis.barkod || !satis.miktar || satis.miktar <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Barkod ve miktar zorunludur ve miktar 0\'dan büyük olmalıdır'
            });
        }
        
        // Transaction ile güvenli işlem
        const result = db.transaction(() => {
            // 1. Stok kontrolü ve güncelleme
            console.log('🔍 Ürün aranıyor:', { 
                barkod: satis.barkod, 
                marka: satis.marka, 
                varyant_id: satis.varyant_id,
                id: satis.id 
            });
            
            let stokUrunu = null;
            if (satis.id) {
                stokUrunu = db.prepare('SELECT * FROM stok WHERE id = ?').get(satis.id);
                console.log('🔍 ID ile arama sonucu:', stokUrunu ? 'Bulundu' : 'Bulunamadı');
            }
            if (!stokUrunu) {
                // Önce sadece barkod ile ara
                stokUrunu = db.prepare('SELECT * FROM stok WHERE barkod = ?').get(satis.barkod);
                console.log('🔍 Barkod ile arama sonucu:', stokUrunu ? 'Bulundu' : 'Bulunamadı');
                
                if (stokUrunu) {
                    console.log('🔍 Bulunan ürün:', { 
                        id: stokUrunu.id, 
                        barkod: stokUrunu.barkod, 
                        ad: stokUrunu.ad,
                        marka: stokUrunu.marka,
                        miktar: stokUrunu.miktar
                    });
                }
                
                // Eğer bulunamadıysa ve marka/varyant bilgisi varsa detaylı ara
                if (!stokUrunu && (satis.marka || satis.varyant_id)) {
                    stokUrunu = db.prepare('SELECT * FROM stok WHERE barkod = ? AND (marka = ? OR (? IS NULL AND marka IS NULL)) AND (varyant_id = ? OR (? IS NULL AND varyant_id IS NULL))')
                        .get(
                            satis.barkod,
                            satis.marka || null,
                            satis.marka || null,
                            satis.varyant_id || null,
                            satis.varyant_id || null
                        );
                    console.log('🔍 Detaylı arama sonucu:', stokUrunu ? 'Bulundu' : 'Bulunamadı');
                }
            }
            
            if (!stokUrunu) {
                console.log('❌ Ürün bulunamadı. Mevcut ürünler:');
                const allProducts = db.prepare('SELECT id, barkod, ad, marka FROM stok LIMIT 5').all();
                allProducts.forEach(p => console.log('  -', p));
                throw new Error('Ürün bulunamadı');
            }
            
            if (stokUrunu.miktar < satis.miktar) {
                throw new Error('Yetersiz stok');
            }
            
            // Stok miktarını güncelle
            const yeniMiktar = stokUrunu.miktar - satis.miktar;
            db.prepare('UPDATE stok SET miktar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(yeniMiktar, stokUrunu.id);
            
            // 2. Duplicate satış kontrolü
            const existingSale = db.prepare(`
                SELECT * FROM satisGecmisi 
                WHERE barkod = ? AND tarih = ? AND miktar = ? AND fiyat = ?
            `).get(satis.barkod, satis.tarih, satis.miktar, satis.fiyat);
            
            if (existingSale) {
                console.log('⚠️ Duplicate sale detected, skipping:', satis);
                return { 
                    success: true, 
                    message: 'Satış zaten mevcut',
                    data: existingSale,
                    stokGuncellendi: true
                };
            }
            
            // 3. Satışı ekle
            const toplam = (parseFloat(satis.fiyat) || 0) * (parseInt(satis.miktar) || 0);
            const alisFiyati = parseFloat(satis.alisFiyati ?? stokUrunu.alisFiyati ?? 0) || 0;
            const borc = satis.borc ? 1 : 0;
            
            console.log('💰 Satış ekleme detayları:', {
                barkod: satis.barkod,
                urunAdi: satis.urunAdi || stokUrunu.ad,
                miktar: satis.miktar,
                fiyat: satis.fiyat,
                alisFiyati: alisFiyati,
                toplam: toplam,
                borc: borc,
                tarih: satis.tarih,
                musteriId: satis.musteriId || '',
                musteriAdi: satis.musteriAdi || ''
            });
            
            const satisResult = db.prepare(`
                INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, alisFiyati, toplam, borc, tarih, musteriId, musteriAdi)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                satis.barkod,
                satis.urunAdi || stokUrunu.ad,
                satis.miktar,
                satis.fiyat,
                alisFiyati,
                toplam,
                borc,
                satis.tarih,
                satis.musteriId || '',
                satis.musteriAdi || ''
            );
            
            // Eklenen satışı al
            const newSale = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?').get(satisResult.lastInsertRowid);
            
            return {
                success: true,
                message: 'Satış başarıyla kaydedildi',
                data: newSale,
                stokGuncellendi: true,
                yeniStokMiktari: yeniMiktar
            };
        })();
        
        // Cache'i temizle
        memoryCache.delete('tum_veriler');
        
        // Real-time sync
        io.emit('dataUpdate', {
            type: 'satis-add',
            data: result.data,
            stokGuncellendi: result.stokGuncellendi,
            yeniStokMiktari: result.yeniStokMiktari,
            source: req.socket?.remoteAddress || 'unknown'
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Satış ekleme hatası:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Satış eklenirken hata oluştu' 
        });
    }
});

// POST /api/musteri-ekle - Müşteri ekle
app.post('/api/musteri-ekle', async (req, res) => {
    try {
        const musteri = req.body;
        console.log('👥 Yeni müşteri ekleniyor:', musteri.id, musteri.ad);
        
        // Generate ID if not provided
        if (!musteri.id) {
            musteri.id = 'MST' + Date.now();
        }
        
        // Validate required fields
        if (!musteri.ad) {
            return res.status(400).json({
                success: false,
                message: 'Müşteri adı zorunludur',
                timestamp: new Date().toISOString()
            });
        }
        
        // Ensure proper data types and handle null/undefined values
        const id = musteri.id || '';
        const ad = musteri.ad || '';
        const telefon = musteri.telefon || '';
        const adres = musteri.adres || '';
        const bakiye = parseFloat(musteri.bakiye) || 0;
        
        const result = db.prepare(`
            INSERT OR REPLACE INTO musteriler (id, ad, telefon, adres, bakiye, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(id, ad, telefon, adres, bakiye);
        
        // Real-time sync to all clients - FIX: broadcast to all clients
        io.emit('dataUpdated', {
            type: 'musteri-add',
            data: musteri,
            timestamp: new Date().toISOString()
        });
        
        res.status(201).json({ 
            success: true, 
            message: 'Müşteri başarıyla eklendi', 
            data: musteri,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Müşteri eklenirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Müşteri eklenirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/backup-email - Manuel email backup
app.post('/api/backup-email', async (req, res) => {
    try {
        console.log('📧 Manuel email backup başlatılıyor...');
        
        await sendDailyBackup();
        
        res.json({
            success: true,
            message: 'Email backup başarıyla gönderildi',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Manuel email backup hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Email backup gönderilemedi',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/musteri-sil/:id - Müşteri sil
app.delete('/api/musteri-sil/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Müşteri siliniyor:', id);
        
        const result = db.prepare('DELETE FROM musteriler WHERE id = ?').run(id);
        
        if (result.changes > 0) {
            // Real-time sync to all clients - FIX: broadcast to all clients
            io.emit('dataUpdated', {
                type: 'musteri-delete',
                data: { id },
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                message: 'Müşteri başarıyla silindi',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Müşteri bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Müşteri silinirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Müşteri silinirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/satis-guncelle/:id - Satış güncelle
app.put('/api/satis-guncelle/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { urunAdi, miktar, fiyat, toplam, tarih } = req.body;
        const idInt = parseInt(id);
        console.log('🔄 Satış güncelleniyor:', idInt);
        
        const updateData = {
            urunAdi: urunAdi || null,
            miktar: parseInt(miktar) || 1,
            fiyat: parseFloat(fiyat) || 0,
            toplam: parseFloat(toplam) || (parseInt(miktar) * parseFloat(fiyat)),
            tarih: tarih || new Date().toISOString()
        };
        
        const result = db.prepare(`
            UPDATE satisGecmisi 
            SET urunAdi = ?, miktar = ?, fiyat = ?, toplam = ?, tarih = ?
            WHERE id = ?
        `).run(updateData.urunAdi, updateData.miktar, updateData.fiyat, updateData.toplam, updateData.tarih, idInt);
        
        if (result.changes > 0) {
            // Get updated record
            const updatedSale = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?').get(idInt);
            
            // Real-time sync to all clients
            io.emit('dataUpdated', {
                type: 'satis-update',
                data: updatedSale,
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true,
                message: 'Satış başarıyla güncellendi',
                data: updatedSale,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false,
                message: 'Satış bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error updating sale:', error);
        res.status(500).json({
            success: false,
            message: 'Satış güncellenirken hata oluştu',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/satis-sil/:id - Satış sil
app.delete('/api/satis-sil/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idInt = parseInt(id);
        console.log('🗑️ Satış siliniyor:', idInt);
        
        const result = db.prepare('DELETE FROM satisGecmisi WHERE id = ?').run(idInt);
        
        if (result.changes > 0) {
            // Real-time sync to all clients - FIX: emit to all clients, not just specific room
            io.emit('dataUpdated', {
                type: 'satis-delete',
                data: { satisId: id },
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                message: 'Satış başarıyla silindi',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Satış bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Satış silinirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Satış silinirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/satis-iade - Satış iade
app.post('/api/satis-iade', async (req, res) => {
    try {
        const { satisId, barkod, miktar, urunAdi, alisFiyati } = req.body;
        console.log('🔄 İade işlemi başlatılıyor:', satisId);
        
        // Validate required fields
        if (!satisId || !barkod || !miktar) {
            return res.status(400).json({
                success: false,
                message: 'Satış ID, barkod ve miktar zorunludur',
                timestamp: new Date().toISOString()
            });
        }
        
        // Önce satışı kontrol et - ID'yi integer'a çevir
        const satisIdInt = parseInt(satisId);
        const existingSale = db.prepare('SELECT * FROM satisGecmisi WHERE id = ?').get(satisIdInt);
        
        if (!existingSale) {
            return res.status(404).json({
                success: false,
                message: 'Satış kaydı bulunamadı',
                satisId: satisId,
                timestamp: new Date().toISOString()
            });
        }
        
        // Satışı veritabanından sil
        const deleteResult = db.prepare('DELETE FROM satisGecmisi WHERE id = ?').run(existingSale.id);
        console.log(`✅ Satış ID ${existingSale.id} iade edildi`);
        
        if (deleteResult.changes === 0) {
            return res.status(500).json({
                success: false,
                message: 'Satış kaydı silinemedi',
                timestamp: new Date().toISOString()
            });
        }
        
        // Stok güncellemesi - barkodu satış kaydından al
        let stokGuncellemesi = null;
        const saleBarcode = existingSale.barkod;
        const saleQuantity = existingSale.miktar;
        
        // Mevcut stoku kontrol et
        const existingStock = db.prepare('SELECT * FROM stok WHERE barkod = ?').get(saleBarcode);
        
        if (existingStock) {
            // Mevcut stok miktarını artır
            const newAmount = existingStock.miktar + saleQuantity;
            const updateResult = db.prepare('UPDATE stok SET miktar = ?, updated_at = CURRENT_TIMESTAMP WHERE barkod = ?').run(newAmount, saleBarcode);
            
            if (updateResult.changes > 0) {
                // Güncellenmiş stok bilgisini al
                stokGuncellemesi = db.prepare('SELECT * FROM stok WHERE barkod = ?').get(saleBarcode);
            }
        } else {
            // Yeni ürün olarak ekle - sadece satış kaydında ürün varsa ve stokta yoksa
            const insertResult = db.prepare(`
                INSERT INTO stok (urun_id, barkod, ad, miktar, alisFiyati, satisFiyati, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
                generateUrunId(),
                saleBarcode, 
                existingSale.urunAdi || urunAdi || 'İade Edilen Ürün', 
                saleQuantity, 
                existingSale.alisFiyati || alisFiyati || 0,
                existingSale.fiyat || 0
            );
            
            if (insertResult.changes > 0) {
                stokGuncellemesi = db.prepare('SELECT * FROM stok WHERE barkod = ?').get(saleBarcode);
            }
        }
        
        // Real-time sync to all clients
        io.emit('dataUpdated', {
            type: 'satis-iade',
            data: { satisId: existingSale.id, barkod: saleBarcode, stokGuncellemesi },
            timestamp: new Date().toISOString()
        });
        
        res.json({ 
            success: true, 
            message: 'İade başarıyla tamamlandı',
            stokGuncellemesi,
            deletedSaleId: existingSale.id,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ İade işlemi hatası:', error);
        res.status(500).json({ 
            success: false, 
            message: 'İade işlemi başarısız', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: db !== null ? 'connected' : 'disconnected'
    });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
    res.json({
        success: true,
        message: 'API Documentation',
        endpoints: {
            'GET /api/test': 'API test ve database durumu',
            'GET /api/tum-veriler': 'Tüm verileri getir',
            'POST /api/tum-veriler': 'Tüm verileri kaydet',
            'POST /api/stok-ekle': 'Ürün ekle',
            'POST /api/satis-ekle': 'Satış kaydet',
            'POST /api/musteri-ekle': 'Müşteri ekle',
            'GET /api/database-status': 'Database durumu',
            'GET /health': 'Sistem sağlığı',
            'GET /': 'Ana sayfa',
            'GET /test': 'Test sayfası'
        },
        websocket: {
            'requestData': 'Veri isteği gönder',
            'dataUpdate': 'Veri güncelleme gönder',
            'connected': 'Bağlantı onayı al',
            'dataResponse': 'Veri yanıtı al',
            'updateResponse': 'Güncelleme yanıtı al'
        },
        timestamp: new Date().toISOString()
    });
});

// Stock update endpoint
app.put('/api/stok-guncelle', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: 'Database connection not available'
            });
        }
        
        const { barkod, ad, miktar, alisFiyati, satisFiyati, kategori, aciklama } = req.body;
        
        if (!barkod) {
            return res.status(400).json({
                success: false,
                message: 'Barkod gerekli'
            });
        }
        
        const updateStock = db.prepare(`
            UPDATE stok SET 
                ad = ?, miktar = ?, alisFiyati = ?, satisFiyati = ?, 
                kategori = ?, aciklama = ?, updated_at = CURRENT_TIMESTAMP
            WHERE barkod = ?
        `);
        
        const result = updateStock.run(
            ad || '',
            parseInt(miktar) || 0,
            parseFloat(alisFiyati) || 0,
            parseFloat(satisFiyati) || 0,
            kategori || '',
            aciklama || '',
            barkod
        );
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ürün bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: 'Ürün başarıyla güncellendi'
        });
    } catch (error) {
        console.error('❌ Error updating stock:', error);
        res.status(500).json({
            success: false,
            message: 'Ürün güncellenirken hata oluştu',
            error: error.message
        });
    }
});

// Stock delete endpoint
app.delete('/api/stok-sil/:barkod', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: 'Database connection not available'
            });
        }
        
        const { barkod } = req.params;
        
        if (!barkod) {
            return res.status(400).json({
                success: false,
                message: 'Barkod gerekli'
            });
        }
        
        const deleteStock = db.prepare('DELETE FROM stok WHERE barkod = ?');
        const result = deleteStock.run(barkod);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ürün bulunamadı'
            });
        }
        
        res.json({
            success: true,
            message: 'Ürün başarıyla silindi'
        });
    } catch (error) {
        console.error('❌ Error deleting stock:', error);
        res.status(500).json({
            success: false,
            message: 'Ürün silinirken hata oluştu',
            error: error.message
        });
    }
});

// Legacy endpoints for backward compatibility
app.get('/urunler', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: 'Database connection not available'
            });
        }
        
        const rows = db.prepare('SELECT * FROM stok').all();
        let stokData = {};
        rows.forEach(row => { 
            stokData[row.barkod] = {
                barkod: row.barkod,
                ad: row.ad,
                miktar: row.miktar,
                alisFiyati: row.alisFiyati,
                satisFiyati: row.satisFiyati,
                kategori: row.kategori,
                aciklama: row.aciklama,
                eklenmeTarihi: row.created_at
            };
        });
        
        res.json({
            success: true,
            data: stokData,
            message: 'Ürünler başarıyla getirildi'
        });
    } catch (error) {
        console.error('❌ Error getting products:', error);
        res.status(500).json({
            success: false,
            message: 'Ürünler okunurken hata oluştu',
            error: error.message
        });
    }
});

app.post('/urunler', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: 'Database connection not available'
            });
        }
        
        const { stokListesi } = req.body;
        if (!stokListesi || typeof stokListesi !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz veri formatı. stokListesi objesi bekleniyor.'
            });
        }
        
        const transaction = db.transaction(() => {
            // Instead of deleting all products, use INSERT OR REPLACE to preserve unique IDs and prevent data loss
            const insertOrReplaceStok = db.prepare(`
                INSERT OR REPLACE INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            let insertedCount = 0;
            for (const key in stokListesi) {
                const urun = stokListesi[key];
                try {
                    // Ensure we use the actual barcode from the product object
                    const barkod = urun.barkod || key;
                    
                    // Generate unique urun_id if not exists
                    const urun_id = urun.urun_id || `urun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    insertOrReplaceStok.run(
                        urun_id,
                        barkod,
                        urun.ad || '',
                        urun.marka || '',
                        parseInt(urun.miktar) || 0,
                        parseFloat(urun.alisFiyati) || 0,
                        parseFloat(urun.satisFiyati) || 0,
                        urun.kategori || '',
                        urun.aciklama || '',
                        urun.varyant_id || ''
                    );
                    insertedCount++;
                } catch (e) {
                    console.warn(`⚠️ Error inserting product ${key}:`, e.message);
                }
            }
            return insertedCount;
        });
        
        const count = transaction();
        
        res.json({
            success: true,
            message: 'Ürünler başarıyla kaydedildi',
            count: count
        });
    } catch (error) {
        console.error('❌ Error saving products:', error);
        res.status(500).json({
            success: false,
            message: 'Ürünler kaydedilirken hata oluştu',
            error: error.message
        });
    }
});

// Yeni API endpoint'leri
app.get('/api/categories', async (req, res) => {
    try {
        const categories = db.prepare('SELECT DISTINCT kategori FROM stok WHERE kategori IS NOT NULL AND kategori != "" ORDER BY kategori').all();
        res.json({
            success: true,
            data: categories.map(c => c.kategori)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/bulk-update', async (req, res) => {
    try {
        const { operation, products, value } = req.body;
        
        if (!operation || !products || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz parametreler'
            });
        }
        
        const transaction = db.transaction(() => {
            let updatedCount = 0;
            
            products.forEach(barkod => {
                try {
                    switch(operation) {
                        case 'price_update':
                            db.prepare('UPDATE stok SET satisFiyati = ? WHERE barkod = ?').run(value, barkod);
                            break;
                        case 'stock_update':
                            db.prepare('UPDATE stok SET miktar = ? WHERE barkod = ?').run(value, barkod);
                            break;
                        case 'category_update':
                            db.prepare('UPDATE stok SET kategori = ? WHERE barkod = ?').run(value, barkod);
                            break;
                    }
                    updatedCount++;
                } catch (e) {
                    console.warn(`⚠️ Error updating product ${barkod}:`, e.message);
                }
            });
            
            return updatedCount;
        });
        
        const count = transaction();
        
        res.json({
            success: true,
            message: `${count} ürün güncellendi`,
            count: count
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/stok-guncelle-barkod - Update existing product with same barcode
app.post('/api/stok-guncelle-barkod', async (req, res) => {
    try {
        const { barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id } = req.body;
        
        if (!barkod || !ad) {
            return res.status(400).json({
                success: false,
                message: 'Barkod ve ürün adı zorunludur',
                timestamp: new Date().toISOString()
            });
        }
        
        // Check if product exists
        const existingProduct = db.prepare('SELECT * FROM stok WHERE barkod = ?').get(barkod);
        
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Ürün bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
        // Update the existing product
        const result = db.prepare(`
            UPDATE stok SET 
                ad = ?, marka = ?, miktar = ?, alisFiyati = ?, satisFiyati = ?, 
                kategori = ?, aciklama = ?, varyant_id = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE barkod = ?
        `).run(ad, marka || '', miktar || 0, alisFiyati || 0, satisFiyati || 0, 
                kategori || '', aciklama || '', varyant_id || '', barkod);
        
        const updatedProduct = db.prepare('SELECT * FROM stok WHERE barkod = ?').get(barkod);
        
        // Real-time sync to all clients - FIX: broadcast to all clients
        io.emit('dataUpdated', {
            type: 'stok-update',
            data: updatedProduct,
            timestamp: new Date().toISOString()
        });
        
        res.json({ 
            success: true, 
            message: 'Ürün başarıyla güncellendi', 
            data: updatedProduct,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Reset database endpoint
app.post('/api/reset-database', async (req, res) => {
    try {
        const transaction = db.transaction(() => {
            // Clear all tables
            db.prepare('DELETE FROM stok').run();
            db.prepare('DELETE FROM musteriler').run();
            db.prepare('DELETE FROM satisGecmisi').run();
            
            // Reset auto-increment counters
            db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('stok', 'satisGecmisi')").run();
            
            return {
                stok: db.prepare('SELECT COUNT(*) as count FROM stok').get().count,
                musteriler: db.prepare('SELECT COUNT(*) as count FROM musteriler').get().count,
                satisGecmisi: db.prepare('SELECT COUNT(*) as count FROM satisGecmisi').get().count
            };
        });
        
        const counts = transaction();
        
        res.json({
            success: true,
            message: 'Tüm veriler başarıyla silindi',
            counts: counts
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test sayfası
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

// POST /api/borc-ekle - Borç ekle
app.post('/api/borc-ekle', async (req, res) => {
    try {
        const borc = req.body;
        console.log('💳 Borç ekleniyor:', borc);
        
        // Ensure proper data types and handle null/undefined values
        const id = borc.id || '';
        const alacakli = borc.musteriId || '';
        const miktar = parseFloat(borc.tutar) || 0;
        const aciklama = borc.aciklama || '';
        const tarih = borc.tarih || new Date().toISOString();
        
        const durum = borc.durum || 'Ödenmedi';
        
        const result = db.prepare(`
            INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, durum, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(id, alacakli, miktar, aciklama, tarih, durum);
        
        // Get the inserted debt record for proper sync
        const insertedDebt = db.prepare('SELECT * FROM borclarim WHERE id = ?').get(id);
        
        // Real-time sync to all clients - FIXED: Proper debt data structure
        io.emit('dataUpdated', {
            type: 'borc-add',
            data: {
                id: insertedDebt.id,
                alacakli: insertedDebt.alacakli,
                miktar: insertedDebt.miktar,
                aciklama: insertedDebt.aciklama,
                tarih: insertedDebt.tarih,
                odemeTarihi: insertedDebt.odemeTarihi,
                durum: insertedDebt.durum
            },
            timestamp: new Date().toISOString()
        });
        
        res.status(201).json({ 
            success: true, 
            message: 'Borç başarıyla eklendi', 
            data: {
                id: insertedDebt.id,
                alacakli: insertedDebt.alacakli,
                miktar: insertedDebt.miktar,
                aciklama: insertedDebt.aciklama,
                tarih: insertedDebt.tarih,
                odemeTarihi: insertedDebt.odemeTarihi,
                durum: insertedDebt.durum
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Borç eklenirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Borç eklenirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/borc-guncelle - Borç güncelle
app.put('/api/borc-guncelle', async (req, res) => {
    try {
        const borc = req.body;
        console.log('🔄 Borç güncelleniyor:', borc.id);
        
        // Ensure proper data types and handle null/undefined values
        const id = borc.id || '';
        const alacakli = borc.musteriId || '';
        const miktar = parseFloat(borc.tutar) || 0;
        const aciklama = borc.aciklama || '';
        const tarih = borc.tarih || new Date().toISOString();
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Borç ID gerekli',
                timestamp: new Date().toISOString()
            });
        }
        
        const durum = borc.durum || 'Ödenmedi';
        
        const result = db.prepare(`
            UPDATE borclarim SET 
                alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, durum = ?
            WHERE id = ?
        `).run(alacakli, miktar, aciklama, tarih, durum, id);
        
        if (result.changes > 0) {
            // Get the updated debt record
            const updatedDebt = db.prepare('SELECT * FROM borclarim WHERE id = ?').get(id);
            
            // Real-time sync to all clients - FIXED: Proper debt data structure
            io.emit('dataUpdated', {
                type: 'borc-update',
                data: {
                    id: updatedDebt.id,
                    alacakli: updatedDebt.alacakli,
                    miktar: updatedDebt.miktar,
                    aciklama: updatedDebt.aciklama,
                    tarih: updatedDebt.tarih,
                    odemeTarihi: updatedDebt.odemeTarihi,
                    durum: updatedDebt.durum
                },
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                message: 'Borç başarıyla güncellendi', 
                data: {
                    id: updatedDebt.id,
                    alacakli: updatedDebt.alacakli,
                    miktar: updatedDebt.miktar,
                    aciklama: updatedDebt.aciklama,
                    tarih: updatedDebt.tarih,
                    odemeTarihi: updatedDebt.odemeTarihi,
                    durum: updatedDebt.durum
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Borç bulunamadı', 
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Borç güncellenirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Borç güncellenirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/borc-sil/:id - Borç sil
app.delete('/api/borc-sil/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Borç siliniyor:', id);
        
        const result = db.prepare('DELETE FROM borclarim WHERE id = ?').run(id);
        
        if (result.changes > 0) {
            // Real-time sync to all clients - FIXED: Proper debt delete sync
            io.emit('dataUpdated', {
                type: 'borc-delete',
                data: { id },
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                message: 'Borç başarıyla silindi',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Borç bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Borç silinirken hata:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Borç silinirken hata', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});



// Network IP discovery endpoint
app.get('/api/network-info', (req, res) => {
    try {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        let localIPs = [];
        
        // Find all local IP addresses
        for (const name of Object.keys(networkInterfaces)) {
            for (const interface of networkInterfaces[name]) {
                if (interface.family === 'IPv4' && !interface.internal) {
                    localIPs.push({
                        interface: name,
                        ip: interface.address,
                        url: `http://${interface.address}:${PORT}`,
                        qrData: `http://${interface.address}:${PORT}`
                    });
                }
            }
        }
        
        res.json({
            success: true,
            networkInfo: {
                port: PORT,
                localIPs: localIPs,
                primaryIP: localIPs.length > 0 ? localIPs[0].ip : 'localhost',
                primaryURL: localIPs.length > 0 ? localIPs[0].url : `http://localhost:${PORT}`,
                hostname: os.hostname()
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Network info error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// QR Code connection page
app.get('/qr-connect', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr-connection.html'));
});

// Network info endpoint for mobile devices
app.get('/api/network-info', (req, res) => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIPs = [];
    
    // Find all local IP addresses
    for (const name of Object.keys(networkInterfaces)) {
        for (const interface of networkInterfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                localIPs.push({
                    interface: name,
                    ip: interface.address,
                    url: `http://${interface.address}:${PORT}`,
                    qrUrl: `http://${interface.address}:${PORT}/qr-connect`
                });
            }
        }
    }
    
    res.json({
        success: true,
        hostname: os.hostname(),
        port: PORT,
        networkInfo: {
            localIPs: localIPs,
            primaryIP: localIPs.length > 0 ? localIPs[0].ip : 'N/A',
            primaryURL: localIPs.length > 0 ? localIPs[0].url : `http://localhost:${PORT}`
        },
        localUrl: `http://localhost:${PORT}`,
        timestamp: new Date().toISOString()
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIPs = [];
    
    // Find all local IP addresses
    for (const name of Object.keys(networkInterfaces)) {
        for (const interface of networkInterfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                localIPs.push({
                    interface: name,
                    ip: interface.address,
                    url: `http://${interface.address}:${PORT}`
                });
            }
        }
    }
    
    const primaryIP = localIPs.length > 0 ? localIPs[0].ip : 'localhost';
    
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
    console.log(`🌐 HTTP: http://localhost:${PORT}`);
    console.log(`🌐 Primary Network: http://${primaryIP}:${PORT}`);
    console.log(`🧪 Test: http://localhost:${PORT}/test`);
    console.log(`📋 API Docs: http://localhost:${PORT}/api/test`);
    console.log(`📱 QR Connect: http://localhost:${PORT}/qr-connect`);
    
    // Log all available network interfaces
    if (localIPs.length > 0) {
        console.log('📶 Available Network URLs:');
        localIPs.forEach(ipInfo => {
            console.log(`   ${ipInfo.interface}: ${ipInfo.url}`);
        });
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    if (db) {
        db.close();
        console.log('✅ Database connection closed');
    }
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    if (db) {
        db.close();
        console.log('✅ Database connection closed');
    }
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

// Stok güncelleme endpoint'i - ID tabanlı güncelleme
app.put('/api/stok-guncelle/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        console.log('🔄 Stok güncelleniyor:', id);
        
        // ID ile ürünü bul
        const existingProduct = db.prepare('SELECT * FROM stok WHERE id = ?').get(id);
        
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Ürün bulunamadı',
                error: 'Ürün bulunamadı',
                timestamp: new Date().toISOString()
            });
        }
        
        // Barkod değişikliği kontrolü
        if (updateData.barkod && updateData.barkod !== existingProduct.barkod) {
            // Yeni barkod'un başka bir üründe kullanılıp kullanılmadığını kontrol et
            const duplicateBarcode = db.prepare('SELECT id FROM stok WHERE barkod = ? AND id != ?').get(updateData.barkod, id);
            if (duplicateBarcode) {
                return res.status(400).json({
                    success: false,
                    message: 'Bu barkod başka bir ürün tarafından kullanılıyor',
                    error: 'Bu barkod başka bir ürün tarafından kullanılıyor',
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // Ürünü güncelle
        const result = db.prepare(`
            UPDATE stok SET 
                barkod = ?, ad = ?, marka = ?, miktar = ?, 
                alisFiyati = ?, satisFiyati = ?, kategori = ?, 
                aciklama = ?, varyant_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            updateData.barkod || existingProduct.barkod,
            updateData.urun_adi || updateData.ad || existingProduct.ad,
            updateData.marka || existingProduct.marka,
            updateData.stok_miktari || updateData.miktar || existingProduct.miktar,
            updateData.alisFiyati || existingProduct.alisFiyati,
            updateData.fiyat || updateData.satisFiyati || existingProduct.satisFiyati,
            updateData.kategori || existingProduct.kategori,
            updateData.aciklama || existingProduct.aciklama,
            updateData.varyant_id || existingProduct.varyant_id,
            id
        );
        
        if (result.changes === 0) {
            return res.status(500).json({
                success: false,
                message: 'Ürün güncellenemedi',
                error: 'Ürün güncellenemedi',
                timestamp: new Date().toISOString()
            });
        }
        
        // Güncellenmiş ürünü al
        const updatedProduct = db.prepare('SELECT * FROM stok WHERE id = ?').get(id);
        
        // Cache'i temizle
        memoryCache.delete('tum_veriler');
        
        // Real-time sync
        io.emit('dataUpdate', {
            type: 'stok-update',
            data: {
                id: updatedProduct.id,
                barkod: updatedProduct.barkod,
                urun_adi: updatedProduct.ad,
                marka: updatedProduct.marka,
                stok_miktari: updatedProduct.miktar,
                fiyat: updatedProduct.satisFiyati,
                kategori: updatedProduct.kategori,
                alisFiyati: updatedProduct.alisFiyati,
                varyant_id: updatedProduct.varyant_id
            },
            source: req.socket?.remoteAddress || 'unknown'
        });
        
        res.json({
            success: true,
            message: 'Ürün başarıyla güncellendi',
            data: updatedProduct
        });
        
    } catch (error) {
        console.error('❌ Stok güncelleme hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Ürün güncellenirken hata oluştu'
        });
    }
});

// Yedek verileri yükle - ESKİ SİSTEME DÖNÜŞ
app.post('/api/yedek-yukle', async (req, res) => {
    try {
        const { yedekData } = req.body;
        
        if (!yedekData) {
            return res.status(400).json({
                success: false,
                error: 'Yedek veri bulunamadı'
            });
        }
        
        console.log('🔄 Yedek veriler yükleniyor...');
        
        // Transaction ile güvenli yükleme
        const result = db.transaction(() => {
            let insertedCount = 0;
            let updatedCount = 0;
            let errorCount = 0;
            
            // Stok verilerini yükle
            if (yedekData.stokListesi) {
                Object.entries(yedekData.stokListesi).forEach(([key, urun]) => {
                    try {
                        // Barkod kontrolü
                        const existingProduct = db.prepare('SELECT id FROM stok WHERE barkod = ?').get(urun.barkod);
                        
                        if (existingProduct) {
                            // Güncelle
                            db.prepare(`
                                UPDATE stok SET 
                                    ad = ?, marka = ?, miktar = ?, alisFiyati = ?, 
                                    satisFiyati = ?, kategori = ?, aciklama = ?, 
                                    varyant_id = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE barkod = ?
                            `).run(
                                urun.urun_adi || urun.ad || urun.urunAdi || urun.barkod || '',
                                urun.marka || '',
                                urun.stok_miktari || urun.miktar || 0,
                                urun.alisFiyati || 0,
                                urun.fiyat || urun.satisFiyati || 0,
                                urun.kategori || '',
                                urun.aciklama || '',
                                urun.varyant_id || '',
                                urun.barkod
                            );
                            updatedCount++;
                        } else {
                            // Yeni ekle
                            db.prepare(`
                                INSERT INTO stok (barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                urun.barkod,
                                urun.urun_adi || urun.ad || urun.urunAdi || urun.barkod || '',
                                urun.marka || '',
                                urun.stok_miktari || urun.miktar || 0,
                                urun.alisFiyati || 0,
                                urun.fiyat || urun.satisFiyati || 0,
                                urun.kategori || '',
                                urun.aciklama || '',
                                urun.varyant_id || ''
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Stok yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Satış geçmişini yükle
            if (yedekData.satisGecmisi && Array.isArray(yedekData.satisGecmisi)) {
                yedekData.satisGecmisi.forEach(satis => {
                    try {
                        // Duplicate kontrolü
                        const existingSale = db.prepare(`
                            SELECT id FROM satisGecmisi 
                            WHERE barkod = ? AND tarih = ? AND miktar = ? AND fiyat = ?
                        `).get(satis.barkod, satis.tarih, satis.miktar, satis.fiyat);
                        
                        if (!existingSale) {
                            db.prepare(`
                                INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, tarih, musteriId, musteriAdi)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                satis.barkod,
                                satis.urunAdi || '',
                                satis.miktar,
                                satis.fiyat,
                                satis.tarih,
                                satis.musteriId || '',
                                satis.musteriAdi || ''
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Satış yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Müşterileri yükle
            if (yedekData.musteriler) {
                Object.entries(yedekData.musteriler).forEach(([id, musteri]) => {
                    try {
                        const existingCustomer = db.prepare('SELECT id FROM musteriler WHERE id = ?').get(id);
                        
                        if (existingCustomer) {
                            db.prepare(`
                                UPDATE musteriler SET 
                                    ad = ?, telefon = ?, adres = ?, bakiye = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0,
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO musteriler (id, ad, telefon, adres, bakiye)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(
                                id,
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Müşteri yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Borçları yükle
            if (yedekData.borclarim) {
                Object.entries(yedekData.borclarim).forEach(([id, borc]) => {
                    try {
                        const existingDebt = db.prepare('SELECT id FROM borclarim WHERE id = ?').get(id);
                        
                        if (existingDebt) {
                            db.prepare(`
                                UPDATE borclarim SET 
                                    alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, 
                                    odemeTarihi = ?, durum = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                borc.alacakli,
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi',
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                id,
                                borc.alacakli,
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi'
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Borç yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            return { insertedCount, updatedCount, errorCount };
        })();
        
        // Cache'i temizle
        memoryCache.delete('tum_veriler');
        
        // Real-time sync
        io.emit('dataUpdate', {
            type: 'backup-synced',
            data: result,
            source: req.socket?.remoteAddress || 'unknown'
        });
        
        console.log('✅ Yedek veriler yüklendi:', result);
        
        res.json({
            success: true,
            message: 'Yedek veriler başarıyla yüklendi',
            data: result
        });
        
    } catch (error) {
        console.error('❌ Yedek yükleme hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Yedek veriler yüklenirken hata oluştu'
        });
    }
});

// Eski yedekleme sistemi - Yedek verilerden yükleme
app.post('/api/yedek-yukle-eski', async (req, res) => {
    try {
        console.log('🔄 Eski yedekleme sistemi ile veriler yükleniyor...');
        
        // Önce yedek dosyalarını kontrol et
        const backupFiles = [
            'tumVeriler_backup_1754133550759.json',
            'tumVeriler_fixed_backup.json',
            'tumVeriler.json',
            path.join('..', 'backup.json')
        ];
        
        let yedekData = null;
        
        // Yedek dosyalarını sırayla kontrol et
        for (const backupFile of backupFiles) {
            const backupPath = path.join(__dirname, 'veriler', backupFile);
            if (fs.existsSync(backupPath)) {
                try {
                    const backupContent = fs.readFileSync(backupPath, 'utf8');
                    if (backupContent && backupContent.trim() !== '') {
                        yedekData = JSON.parse(backupContent);
                        console.log(`✅ Yedek dosyası bulundu: ${backupFile}`);
                        break;
                    }
                } catch (error) {
                    console.warn(`⚠️ Yedek dosyası okunamadı: ${backupFile}`, error.message);
                }
            }
        }
        
        if (!yedekData) {
            return res.status(404).json({
                success: false,
                error: 'Hiçbir yedek dosyası bulunamadı'
            });
        }
        
        console.log('📊 Yedek dosyasından okunan veriler:', {
            stok: Object.keys(yedekData.stokListesi || {}).length,
            satis: (yedekData.satisGecmisi || []).length,
            musteri: Object.keys(yedekData.musteriler || {}).length,
            borc: Object.keys(yedekData.borclarim || {}).length
        });
        
        // Transaction ile güvenli yükleme
        const result = db.transaction(() => {
            let insertedCount = 0;
            let updatedCount = 0;
            let errorCount = 0;
            
            // Stok verilerini yükle
            if (yedekData.stokListesi) {
                Object.entries(yedekData.stokListesi).forEach(([key, urun]) => {
                    try {
                        if (!urun.barkod) return; // Barkod yoksa atla
                        
                        // Barkod kontrolü
                        const existingProduct = db.prepare('SELECT id FROM stok WHERE barkod = ?').get(urun.barkod);
                        
                        if (existingProduct) {
                            // Güncelle
                            db.prepare(`
                                UPDATE stok SET 
                                    ad = ?, marka = ?, miktar = ?, alisFiyati = ?, 
                                    satisFiyati = ?, kategori = ?, aciklama = ?, 
                                    varyant_id = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE barkod = ?
                            `).run(
                                urun.urun_adi || urun.ad || urun.urunAdi || urun.barkod || '',
                                urun.marka || '',
                                urun.stok_miktari || urun.miktar || 0,
                                urun.alisFiyati || 0,
                                urun.fiyat || urun.satisFiyati || 0,
                                urun.kategori || '',
                                urun.aciklama || '',
                                urun.varyant_id || '',
                                urun.barkod
                            );
                            updatedCount++;
                        } else {
                            // Yeni ekle
                            db.prepare(`
                                INSERT INTO stok (barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                urun.barkod,
                                urun.urun_adi || urun.ad || urun.urunAdi || urun.barkod || '',
                                urun.marka || '',
                                urun.stok_miktari || urun.miktar || 0,
                                urun.alisFiyati || 0,
                                urun.fiyat || urun.satisFiyati || 0,
                                urun.kategori || '',
                                urun.aciklama || '',
                                urun.varyant_id || ''
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Stok yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Satış geçmişini yükle
            if (yedekData.satisGecmisi && Array.isArray(yedekData.satisGecmisi)) {
                yedekData.satisGecmisi.forEach(satis => {
                    try {
                                                if (!satis.barkod) return; // Barkod yoksa atla
                        
                        // Duplicate kontrolü
                        const existingSale = db.prepare(`
                            SELECT id FROM satisGecmisi 
                            WHERE barkod = ? AND tarih = ? AND miktar = ? AND fiyat = ?
                        `).get(satis.barkod, satis.tarih, satis.miktar, satis.fiyat);
                        
                        if (!existingSale) {
                            const alisFiyati = parseFloat(satis.alisFiyati) || (db.prepare('SELECT alisFiyati FROM stok WHERE barkod = ?').get(satis.barkod)?.alisFiyati || 0);
                            const miktar = parseInt(satis.miktar) || 0;
                            const fiyat = parseFloat(satis.fiyat) || 0;
                            const toplam = parseFloat(satis.toplam) || (fiyat * miktar) || 0;
                            const borc = satis.borc ? 1 : 0;
                            db.prepare(`
                                INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, alisFiyati, toplam, borc, tarih, musteriId, musteriAdi)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                satis.barkod,
                                satis.urunAdi || '',
                                miktar,
                                fiyat,
                                alisFiyati,
                                toplam,
                                borc,
                                satis.tarih,
                                satis.musteriId || '',
                                satis.musteriAdi || ''
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Satış yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Müşterileri yükle
            if (yedekData.musteriler) {
                Object.entries(yedekData.musteriler).forEach(([id, musteri]) => {
                    try {
                        if (!id || !musteri.ad) return; // Geçersiz veri atla
                        
                        const existingCustomer = db.prepare('SELECT id FROM musteriler WHERE id = ?').get(id);
                        
                        if (existingCustomer) {
                            db.prepare(`
                                UPDATE musteriler SET 
                                    ad = ?, telefon = ?, adres = ?, bakiye = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0,
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO musteriler (id, ad, telefon, adres, bakiye)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(
                                id,
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Müşteri yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Borçları yükle
            if (yedekData.borclarim) {
                Object.entries(yedekData.borclarim).forEach(([id, borc]) => {
                    try {
                        if (!id) return; // ID yoksa atla
                        
                        const existingDebt = db.prepare('SELECT id FROM borclarim WHERE id = ?').get(id);
                        
                        if (existingDebt) {
                            db.prepare(`
                                UPDATE borclarim SET 
                                    alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, 
                                    odemeTarihi = ?, durum = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                borc.alacakli || borc.musteriAdi || '',
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi',
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                id,
                                borc.alacakli || borc.musteriAdi || '',
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi'
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Borç yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            return { insertedCount, updatedCount, errorCount };
        })();
        
        // Cache'i temizle
        memoryCache.delete('tum_veriler');
        
        // Real-time sync
        io.emit('dataUpdate', {
            type: 'backup-synced-eski',
            data: result,
            source: req.socket?.remoteAddress || 'unknown'
        });
        
        console.log('✅ Eski yedekleme sistemi ile veriler yüklendi:', result);
        
        res.json({
            success: true,
            message: 'Eski yedekleme sistemi ile veriler başarıyla yüklendi',
            data: result
        });
        
    } catch (error) {
        console.error('❌ Eski yedekleme sistemi hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Eski yedekleme sistemi ile veriler yüklenirken hata oluştu: ' + error.message
        });
    }
});

// POST /api/test-veri-yukle - Test verisi yükleme
app.post('/api/test-veri-yukle', async (req, res) => {
    try {
        console.log('🔄 Test verisi yükleniyor...');
        
        // Test verisi dosyasını oku
        const testDataPath = path.join(__dirname, 'veriler', 'yedek', 'veriler.json');
        
        if (!fs.existsSync(testDataPath)) {
            return res.status(404).json({
                success: false,
                message: 'Test verisi dosyası bulunamadı: veriler/yedek/veriler.json',
                timestamp: new Date().toISOString()
            });
        }
        
        const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        
        // Stok verilerini yükle
        if (testData.stokListesi) {
            for (const [key, urun] of Object.entries(testData.stokListesi)) {
                try {
                    // Generate unique urun_id for each product
                    const urun_id = generateUrunId();
                    
                    // Check if product already exists
                    const existingProduct = db.prepare('SELECT * FROM stok WHERE barkod = ? AND marka = ? AND varyant_id = ?').get(
                        urun.barkod || '', 
                        urun.marka || '', 
                        urun.varyant_id || ''
                    );
                    
                    if (existingProduct) {
                        // Update existing product
                        db.prepare(`
                            UPDATE stok SET 
                                ad = ?, marka = ?, miktar = ?, alisFiyati = ?, satisFiyati = ?, 
                                kategori = ?, aciklama = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).run(
                            urun.urun_adi || urun.ad || '',
                            urun.marka || '',
                            urun.stok_miktari || urun.miktar || 0,
                            urun.alisFiyati || 0,
                            urun.fiyat || urun.satisFiyati || 0,
                            urun.kategori || '',
                            urun.aciklama || '',
                            existingProduct.id
                        );
                        updatedCount++;
                    } else {
                        // Insert new product
                        db.prepare(`
                            INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(
                            urun_id,
                            urun.barkod || '',
                            urun.urun_adi || urun.ad || '',
                            urun.marka || '',
                            urun.stok_miktari || urun.miktar || 0,
                            urun.alisFiyati || 0,
                            urun.fiyat || urun.satisFiyati || 0,
                            urun.kategori || '',
                            urun.aciklama || '',
                            urun.varyant_id || ''
                        );
                        insertedCount++;
                    }
                } catch (error) {
                    console.warn('⚠️ Test verisi ürün yükleme hatası:', error.message);
                    skippedCount++;
                }
            }
        }
        
        // Real-time sync to all clients
        io.emit('dataUpdated', {
            type: 'bulk-sync',
            data: { insertedCount, updatedCount, skippedCount },
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: 'Test verisi başarıyla yüklendi',
            data: {
                insertedCount,
                updatedCount,
                skippedCount
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Test verisi yükleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Test verisi yükleme hatası',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Yedek yükleme sistemi - GELİŞMİŞ VERSİYON (SADECE YENİLERİ EKLE)
app.post('/api/yedek-yukle-gelismis', async (req, res) => {
    try {
        console.log('🔄 Gelişmiş yedek yükleme sistemi başlatılıyor (sadece yeni ürünler eklenecek)...');
        
        // Yedek dosyalarını kontrol et
        const backupFiles = [
            'tumVeriler_backup_1754133550759.json',
            'tumVeriler_fixed_backup.json',
            'tumVeriler.json',
            path.join('..', 'backup.json')
        ];
        
        let yedekData = null;
        let foundFile = null;
        
        // Yedek dosyalarını sırayla kontrol et
        for (const backupFile of backupFiles) {
            const backupPath = path.join(__dirname, 'veriler', backupFile);
            if (fs.existsSync(backupPath)) {
                try {
                    const backupContent = fs.readFileSync(backupPath, 'utf8');
                    if (backupContent && backupContent.trim() !== '') {
                        yedekData = JSON.parse(backupContent);
                        foundFile = backupFile;
                        console.log(`✅ Yedek dosyası bulundu: ${backupFile}`);
                        break;
                    }
                } catch (error) {
                    console.warn(`⚠️ Yedek dosyası okunamadı: ${backupFile}`, error.message);
                }
            }
        }
        
        if (!yedekData) {
            return res.status(404).json({
                success: false,
                error: 'Hiçbir yedek dosyası bulunamadı veya okunamadı'
            });
        }
        
        console.log('📊 Yedek dosyasından okunan veriler:', {
            dosya: foundFile,
            stok: Object.keys(yedekData.stokListesi || {}).length,
            satis: (yedekData.satisGecmisi || []).length,
            musteri: Object.keys(yedekData.musteriler || {}).length,
            borc: Object.keys(yedekData.borclarim || {}).length
        });
        
        // Transaction ile güvenli yükleme
        const result = db.transaction(() => {
            let insertedCount = 0;
            let updatedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            
            // Stok verilerini yükle - SADECE YENİLERİ EKLE
            if (yedekData.stokListesi) {
                Object.entries(yedekData.stokListesi).forEach(([key, urun]) => {
                    try {
                        if (!urun.barkod) {
                            skippedCount++;
                            return; // Barkod yoksa atla
                        }
                        
                        // Barkod kontrolü - sadece yeni ürünleri ekle
                        const existingProduct = db.prepare('SELECT id FROM stok WHERE barkod = ?').get(urun.barkod);
                        
                        if (existingProduct) {
                            // Mevcut ürün - atla (güncelleme yapma)
                            skippedCount++;
                            console.log(`⏭️ Mevcut ürün atlandı: ${urun.barkod} - ${urun.urun_adi || urun.ad || urun.urunAdi}`);
                        } else {
                            // Sadece yeni ürünleri ekle
                            db.prepare(`
                                INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            `).run(
                                generateUrunId(),
                                urun.barkod,
                                urun.urun_adi || urun.ad || urun.urunAdi || urun.barkod || '',
                                urun.marka || '',
                                urun.stok_miktari || urun.miktar || 0,
                                urun.alisFiyati || 0,
                                urun.fiyat || urun.satisFiyati || 0,
                                urun.kategori || '',
                                urun.aciklama || '',
                                urun.varyant_id || ''
                            );
                            insertedCount++;
                            console.log(`✅ Yeni ürün eklendi: ${urun.barkod} - ${urun.urun_adi || urun.ad || urun.urunAdi}`);
                        }
                    } catch (error) {
                        console.error('❌ Stok yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Satış geçmişini yükle
            if (yedekData.satisGecmisi && Array.isArray(yedekData.satisGecmisi)) {
                yedekData.satisGecmisi.forEach(satis => {
                    try {
                        if (!satis.barkod) {
                            skippedCount++;
                            return; // Barkod yoksa atla
                        }
                        
                        // Duplicate kontrolü
                        const existingSale = db.prepare(`
                            SELECT id FROM satisGecmisi 
                            WHERE barkod = ? AND tarih = ? AND miktar = ? AND fiyat = ?
                        `).get(satis.barkod, satis.tarih, satis.miktar, satis.fiyat);
                        
                        if (!existingSale) {
                            db.prepare(`
                                INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, tarih, musteriId, musteriAdi)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                satis.barkod,
                                satis.urunAdi || '',
                                satis.miktar,
                                satis.fiyat,
                                satis.tarih,
                                satis.musteriId || '',
                                satis.musteriAdi || ''
                            );
                            insertedCount++;
                        } else {
                            skippedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Satış yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Müşterileri yükle
            if (yedekData.musteriler) {
                Object.entries(yedekData.musteriler).forEach(([id, musteri]) => {
                    try {
                        if (!id || !musteri.ad) {
                            skippedCount++;
                            return; // Geçersiz veri atla
                        }
                        
                        const existingCustomer = db.prepare('SELECT id FROM musteriler WHERE id = ?').get(id);
                        
                        if (existingCustomer) {
                            db.prepare(`
                                UPDATE musteriler SET 
                                    ad = ?, telefon = ?, adres = ?, bakiye = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0,
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO musteriler (id, ad, telefon, adres, bakiye)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(
                                id,
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Müşteri yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Borçları yükle
            if (yedekData.borclarim) {
                Object.entries(yedekData.borclarim).forEach(([id, borc]) => {
                    try {
                        if (!id) {
                            skippedCount++;
                            return; // ID yoksa atla
                        }
                        
                        const existingDebt = db.prepare('SELECT id FROM borclarim WHERE id = ?').get(id);
                        
                        if (existingDebt) {
                            db.prepare(`
                                UPDATE borclarim SET 
                                    alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, 
                                    odemeTarihi = ?, durum = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                borc.alacakli || borc.musteriAdi || '',
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi',
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                id,
                                borc.alacakli || borc.musteriAdi || '',
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi'
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Borç yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            return { insertedCount, updatedCount, errorCount, skippedCount };
        })();
        
        // Cache'i temizle
        memoryCache.delete('tum_veriler');
        
        // Real-time sync
        io.emit('dataUpdate', {
            type: 'backup-synced-gelismis',
            data: result,
            source: req.socket?.remoteAddress || 'unknown'
        });
        
        console.log('✅ Gelişmiş yedek yükleme sistemi ile veriler yüklendi:', result);
        
        res.json({
            success: true,
            message: 'Gelişmiş yedek yükleme sistemi ile veriler başarıyla yüklendi',
            data: result,
            backupFile: foundFile
        });
        
    } catch (error) {
        console.error('❌ Gelişmiş yedek yükleme sistemi hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Gelişmiş yedek yükleme sistemi ile veriler yüklenirken hata oluştu: ' + error.message
        });
    }
});

// TumVeriler_backup dosyasından yedek yükleme
app.post('/api/yedek-yukle-tumveriler', async (req, res) => {
    try {
        console.log('🔄 TumVeriler_backup dosyasından yedek yükleme başlatılıyor...');
        
        // TumVeriler_backup dosyasını oku
        const backupFiles = [
            path.join(__dirname, 'veriler', 'tumVeriler_backup_1754133550759.json'),
            path.join(__dirname, 'veriler', 'tumVeriler_fixed_backup.json'),
            path.join(__dirname, 'veriler', 'veriler.json')
        ];
        
        let yedekData = null;
        let usedFile = '';
        
        for (const filePath of backupFiles) {
            if (fs.existsSync(filePath)) {
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    if (fileContent && fileContent.trim() !== '') {
                        yedekData = JSON.parse(fileContent);
                        usedFile = filePath;
                        console.log(`✅ Yedek dosyası bulundu: ${path.basename(filePath)}`);
                        break;
                    }
                } catch (error) {
                    console.warn(`⚠️ Dosya okunamadı: ${path.basename(filePath)}`);
                    continue;
                }
            }
        }
        
        if (!yedekData) {
            return res.status(404).json({
                success: false,
                error: 'Hiçbir yedek dosyası bulunamadı'
            });
        }
        
        console.log('📊 Yedek dosyasından okunan veriler:', {
            stok: Object.keys(yedekData.stokListesi || {}).length,
            satis: (yedekData.satisGecmisi || []).length,
            musteri: Object.keys(yedekData.musteriler || {}).length,
            borc: Object.keys(yedekData.borclarim || {}).length
        });
        
        // Transaction ile güvenli yükleme
        const result = db.transaction(() => {
            let insertedCount = 0;
            let updatedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            
            // Stok verilerini yükle
            if (yedekData.stokListesi) {
                Object.entries(yedekData.stokListesi).forEach(([key, urun]) => {
                    try {
                        if (!urun.barkod) {
                            skippedCount++;
                            return; // Barkod yoksa atla
                        }
                        
                        // urun_id oluştur
                        const urun_id = generateUrunId();
                        
                        // Barkod kontrolü
                        const existingProduct = db.prepare('SELECT id FROM stok WHERE barkod = ?').get(urun.barkod);
                        
                        if (existingProduct) {
                            // Güncelle
                            try {
                                db.prepare(`
                                    UPDATE stok SET 
                                        urun_id = ?, ad = ?, marka = ?, miktar = ?, alisFiyati = ?, 
                                        satisFiyati = ?, kategori = ?, aciklama = ?, 
                                        varyant_id = ?, updated_at = CURRENT_TIMESTAMP
                                    WHERE barkod = ?
                                `).run(
                                    urun_id,
                                    urun.barkod || '', // Barkod adı olarak kullan
                                    urun.marka || '',
                                    1, // Varsayılan miktar
                                    0, // Varsayılan alış fiyatı
                                    0, // Varsayılan satış fiyatı
                                    'Otomotiv', // Varsayılan kategori
                                    `${urun.barkod} - ${urun.marka || 'Genel'}`, // Açıklama
                                    '', // Varsayılan varyant_id
                                    urun.barkod
                                );
                                updatedCount++;
                            } catch (updateError) {
                                console.error('❌ Ürün güncelleme hatası:', updateError.message);
                                errorCount++;
                            }
                        } else {
                            // Yeni ekle - urun_id ile birlikte
                            try {
                                db.prepare(`
                                    INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `).run(
                                    urun_id,
                                    urun.barkod,
                                    urun.barkod || '', // Barkod adı olarak kullan
                                    urun.marka || '',
                                    1, // Varsayılan miktar
                                    0, // Varsayılan alış fiyatı
                                    0, // Varsayılan satış fiyatı
                                    'Otomotiv', // Varsayılan kategori
                                    `${urun.barkod} - ${urun.marka || 'Genel'}`, // Açıklama
                                    '' // Varsayılan varyant_id
                                );
                                insertedCount++;
                            } catch (insertError) {
                                console.error('❌ Ürün ekleme hatası:', insertError.message);
                                errorCount++;
                            }
                        }
                    } catch (error) {
                        console.error('❌ Stok yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Müşteri verilerini yükle
            if (yedekData.musteriler) {
                Object.entries(yedekData.musteriler).forEach(([id, musteri]) => {
                    try {
                        const existingCustomer = db.prepare('SELECT id FROM musteriler WHERE id = ?').get(id);
                        
                        if (existingCustomer) {
                            // Güncelle
                            db.prepare(`
                                UPDATE musteriler SET 
                                    ad = ?, telefon = ?, adres = ?, bakiye = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                musteri.ad || '',
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0,
                                id
                            );
                            updatedCount++;
                        } else {
                            // Yeni ekle
                            db.prepare(`
                                INSERT INTO musteriler (id, ad, telefon, adres, bakiye)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(
                                id,
                                musteri.ad || '',
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Müşteri yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Borç verilerini yükle
            if (yedekData.borclarim) {
                Object.entries(yedekData.borclarim).forEach(([id, borc]) => {
                    try {
                        const existingDebt = db.prepare('SELECT id FROM borclarim WHERE id = ?').get(id);
                        
                        if (existingDebt) {
                            // Güncelle
                            db.prepare(`
                                UPDATE borclarim SET 
                                    alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, 
                                    odemeTarihi = ?, durum = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                borc.alacakli || '',
                                borc.miktar || 0,
                                borc.aciklama || '',
                                borc.tarih || new Date().toISOString(),
                                borc.odemeTarihi || null,
                                borc.durum || 'Ödenmedi',
                                id
                            );
                            updatedCount++;
                        } else {
                            // Yeni ekle
                            db.prepare(`
                                INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                id,
                                borc.alacakli || '',
                                borc.miktar || 0,
                                borc.aciklama || '',
                                borc.tarih || new Date().toISOString(),
                                borc.odemeTarihi || null,
                                borc.durum || 'Ödenmedi'
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Borç yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            return { insertedCount, updatedCount, errorCount, skippedCount };
        })();
        
        console.log('✅ Yedek yükleme tamamlandı:', result);
        
        res.json({
            success: true,
            data: result,
            message: `Yedek veriler yüklendi: ${result.insertedCount} yeni, ${result.updatedCount} güncellendi`
        });
        
    } catch (error) {
        console.error('❌ Yedek yükleme hatası:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Veriler.json dosyasından yedek yükleme
app.post('/api/yedek-yukle-veriler-json', async (req, res) => {
    try {
        console.log('🔄 Veriler.json dosyasından yedek yükleme başlatılıyor...');
        
        // Veriler.json dosyasını oku
        const verilerJsonPath = path.join(__dirname, 'veriler', 'veriler.json');
        
        if (!fs.existsSync(verilerJsonPath)) {
            return res.status(404).json({
                success: false,
                error: 'veriler.json dosyası bulunamadı'
            });
        }
        
        const verilerContent = fs.readFileSync(verilerJsonPath, 'utf8');
        
        if (!verilerContent || verilerContent.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'veriler.json dosyası boş'
            });
        }
        
        const yedekData = JSON.parse(verilerContent);
        
        console.log('📊 Veriler.json dosyasından okunan veriler:', {
            stok: Object.keys(yedekData.stokListesi || {}).length,
            satis: (yedekData.satisGecmisi || []).length,
            musteri: Object.keys(yedekData.musteriler || {}).length,
            borc: Object.keys(yedekData.borclarim || {}).length
        });
        
        // Transaction ile güvenli yükleme
        const result = db.transaction(() => {
            let insertedCount = 0;
            let updatedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            
            // Stok verilerini yükle
            if (yedekData.stokListesi) {
                Object.entries(yedekData.stokListesi).forEach(([key, urun]) => {
                    try {
                        if (!urun.barkod) {
                            skippedCount++;
                            return; // Barkod yoksa atla
                        }
                        
                        // Barkod kontrolü
                        const existingProduct = db.prepare('SELECT id FROM stok WHERE barkod = ?').get(urun.barkod);
                        
                        if (existingProduct) {
                            // Güncelle
                            db.prepare(`
                                UPDATE stok SET 
                                    ad = ?, marka = ?, miktar = ?, alisFiyati = ?, 
                                    satisFiyati = ?, kategori = ?, aciklama = ?, 
                                    varyant_id = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE barkod = ?
                            `).run(
                                urun.urun_adi || urun.ad || urun.urunAdi || urun.barkod || '',
                                urun.marka || '',
                                urun.stok_miktari || urun.miktar || 0,
                                urun.alisFiyati || 0,
                                urun.fiyat || urun.satisFiyati || 0,
                                urun.kategori || '',
                                urun.aciklama || '',
                                urun.varyant_id || '',
                                urun.barkod
                            );
                            updatedCount++;
                        } else {
                            // Yeni ekle
                            db.prepare(`
                                INSERT INTO stok (barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                urun.barkod,
                                urun.urun_adi || urun.ad || urun.urunAdi || urun.barkod || '',
                                urun.marka || '',
                                urun.stok_miktari || urun.miktar || 0,
                                urun.alisFiyati || 0,
                                urun.fiyat || urun.satisFiyati || 0,
                                urun.kategori || '',
                                urun.aciklama || '',
                                urun.varyant_id || ''
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Stok yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Satış geçmişini yükle
            if (yedekData.satisGecmisi && Array.isArray(yedekData.satisGecmisi)) {
                yedekData.satisGecmisi.forEach(satis => {
                    try {
                        if (!satis.barkod) {
                            skippedCount++;
                            return; // Barkod yoksa atla
                        }
                        
                        // Duplicate kontrolü
                        const existingSale = db.prepare(`
                            SELECT id FROM satisGecmisi 
                            WHERE barkod = ? AND tarih = ? AND miktar = ? AND fiyat = ?
                        `).get(satis.barkod, satis.tarih, satis.miktar, satis.fiyat);
                        
                        if (!existingSale) {
                            db.prepare(`
                                INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, tarih, musteriId, musteriAdi)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                satis.barkod,
                                satis.urunAdi || '',
                                satis.miktar,
                                satis.fiyat,
                                satis.tarih,
                                satis.musteriId || '',
                                satis.musteriAdi || ''
                            );
                            insertedCount++;
                        } else {
                            skippedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Satış yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Müşterileri yükle
            if (yedekData.musteriler) {
                Object.entries(yedekData.musteriler).forEach(([id, musteri]) => {
                    try {
                        if (!id || !musteri.ad) {
                            skippedCount++;
                            return; // Geçersiz veri atla
                        }
                        
                        const existingCustomer = db.prepare('SELECT id FROM musteriler WHERE id = ?').get(id);
                        
                        if (existingCustomer) {
                            db.prepare(`
                                UPDATE musteriler SET 
                                    ad = ?, telefon = ?, adres = ?, bakiye = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0,
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO musteriler (id, ad, telefon, adres, bakiye)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(
                                id,
                                musteri.ad,
                                musteri.telefon || '',
                                musteri.adres || '',
                                musteri.bakiye || 0
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Müşteri yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            // Borçları yükle
            if (yedekData.borclarim) {
                Object.entries(yedekData.borclarim).forEach(([id, borc]) => {
                    try {
                        if (!id) {
                            skippedCount++;
                            return; // ID yoksa atla
                        }
                        
                        const existingDebt = db.prepare('SELECT id FROM borclarim WHERE id = ?').get(id);
                        
                        if (existingDebt) {
                            db.prepare(`
                                UPDATE borclarim SET 
                                    alacakli = ?, miktar = ?, aciklama = ?, tarih = ?, 
                                    odemeTarihi = ?, durum = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
                                borc.alacakli || borc.musteriAdi || '',
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi',
                                id
                            );
                            updatedCount++;
                        } else {
                            db.prepare(`
                                INSERT INTO borclarim (id, alacakli, miktar, aciklama, tarih, odemeTarihi, durum)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                id,
                                borc.alacakli || borc.musteriAdi || '',
                                borc.miktar,
                                borc.aciklama || '',
                                borc.tarih,
                                borc.odemeTarihi,
                                borc.durum || 'Ödenmedi'
                            );
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error('❌ Borç yükleme hatası:', error);
                        errorCount++;
                    }
                });
            }
            
            return { insertedCount, updatedCount, errorCount, skippedCount };
        })();
        
        // Cache'i temizle
        memoryCache.delete('tum_veriler');
        
        // Real-time sync
        io.emit('dataUpdate', {
            type: 'backup-synced-veriler-json',
            data: result,
            source: req.socket?.remoteAddress || 'unknown'
        });
        
        console.log('✅ Veriler.json dosyasından yedek yükleme tamamlandı:', result);
        
        res.json({
            success: true,
            message: 'Veriler.json dosyasından yedek veriler başarıyla yüklendi',
            data: result,
            source: 'veriler.json'
        });
        
    } catch (error) {
        console.error('❌ Veriler.json yedek yükleme hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Veriler.json dosyasından yedek yükleme hatası: ' + error.message
        });
    }
});



// Server startup (disabled duplicate listener - consolidated earlier)
/* server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 StokV1 Server running on port', PORT);
    console.log('📱 Local: http://localhost:' + PORT);
    console.log('🌐 Network: http://0.0.0.0:' + PORT);
    
    // Network interfaces
    const os = require('os');
    const interfaces = os.networkInterfaces();
    console.log('📡 Available network interfaces:');
    Object.keys(interfaces).forEach(iface => {
        interfaces[iface].forEach(details => {
            if (details.family === 'IPv4' && !details.internal) {
                console.log(`   ${iface}: http://${details.address}:${PORT}`);
            }
        });
    });
    
    // Start scheduled backups
    console.log('🔄 Günlük yedekleme başlatılıyor...');
    setInterval(sendDailyBackup, 24 * 60 * 60 * 1000); // 24 saat
    setInterval(sendDailyBackup, 6 * 60 * 60 * 1000); // 6 saat
}); */

// Stok temizleme endpoint'i
app.post('/api/stok-temizle', async (req, res) => {
    try {
        console.log('🗑️ Stok listesi tamamen siliniyor...');
        
        const result = db.transaction(() => {
            const deleteResult = db.prepare('DELETE FROM stok').run();
            db.prepare("DELETE FROM sqlite_sequence WHERE name = 'stok'").run();
            console.log(`✅ ${deleteResult.changes} stok kaydı silindi`);
            return { success: true, deletedCount: deleteResult.changes, message: `${deleteResult.changes} stok kaydı başarıyla silindi` };
        })();
        
        // Cache'i temizle
        memoryCache.clear();
        
        // Real-time sync
        io.emit('data-updated', { 
            type: 'stok-cleared', 
            message: 'Stok listesi tamamen temizlendi', 
            deletedCount: result.deletedCount 
        });
        
        res.json({ 
            success: true, 
            message: 'Stok listesi başarıyla temizlendi', 
            deletedCount: result.deletedCount 
        });
        
    } catch (error) {
        console.error('❌ Stok temizleme hatası:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Stok temizleme hatası: ' + error.message 
        });
    }
});

// Satış geçmişi yükleme endpoint'i (veriler.json'dan)
app.post('/api/satis-yukle-veriler-json', async (req, res) => {
    try {
        console.log('🔄 Veriler.json dosyasından satış geçmişi yükleme başlatılıyor...');
        
        const verilerJsonPath = path.join(__dirname, 'veriler', 'veriler.json');
        
        if (!fs.existsSync(verilerJsonPath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'veriler.json dosyası bulunamadı' 
            });
        }
        
        const verilerContent = fs.readFileSync(verilerJsonPath, 'utf8');
        const yedekData = JSON.parse(verilerContent);
        
        if (!yedekData.satisGecmisi || yedekData.satisGecmisi.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'veriler.json dosyasında satış geçmişi bulunamadı' 
            });
        }
        
        console.log('📊 Veriler.json dosyasından okunan satış geçmişi:', { 
            satis: yedekData.satisGecmisi.length 
        });
        
        const result = db.transaction(() => {
            let insertedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            
            yedekData.satisGecmisi.forEach(satis => {
                try {
                    if (!satis.barkod) {
                        skippedCount++;
                        return;
                    }
                    
                    const satisId = satis.id || generateSatisId();
                    
                    db.prepare(`
                        INSERT INTO satisGecmisi (id, tarih, barkod, urunAdi, marka, miktar, fiyat, alisFiyati, toplam, borc, musteriId, aciklama)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        satisId,
                        satis.tarih || new Date().toISOString(),
                        satis.barkod,
                        satis.urunAdi || '',
                        satis.marka || '',
                        satis.miktar || 1,
                        satis.fiyat || 0,
                        satis.alisFiyati || 0,
                        satis.toplam || (satis.fiyat * satis.miktar) || 0,
                        satis.borc ? 1 : 0,
                        satis.musteriId || null,
                        satis.aciklama || ''
                    );
                    insertedCount++;
                } catch (error) {
                    console.error('❌ Satış geçmişi yükleme hatası:', error);
                    errorCount++;
                }
            });
            
            return { insertedCount, errorCount, skippedCount };
        })();
        
        // Cache'i temizle
        memoryCache.clear();
        
        // Real-time sync
        io.emit('data-updated', { 
            type: 'satis-loaded', 
            message: 'Satış geçmişi başarıyla yüklendi', 
            insertedCount: result.insertedCount 
        });
        
        console.log('✅ Veriler.json dosyasından satış geçmişi yükleme tamamlandı:', result);
        
        res.json({ 
            success: true, 
            message: 'Satış geçmişi başarıyla yüklendi', 
            insertedCount: result.insertedCount, 
            errorCount: result.errorCount, 
            skippedCount: result.skippedCount 
        });
        
    } catch (error) {
        console.error('❌ Veriler.json satış geçmişi yükleme hatası:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Veriler.json satış geçmişi yükleme hatası: ' + error.message 
        });
    }
});

// Müşteri detayları endpoint'i
app.get('/api/musteri/:id', async (req, res) => {
    try {
        const musteriId = req.params.id;
        
        // Müşteri bilgilerini al
        const musteri = db.prepare('SELECT * FROM musteriler WHERE id = ?').get(musteriId);
        
        if (!musteri) {
            return res.status(404).json({ success: false, error: 'Müşteri bulunamadı' });
        }
        
        // Müşterinin satın aldığı ürünleri al
        const satisGecmisi = db.prepare(`
            SELECT s.*, m.ad as musteriAdi 
            FROM satisGecmisi s 
            LEFT JOIN musteriler m ON s.musteriId = m.id 
            WHERE s.musteriId = ? 
            ORDER BY s.tarih DESC
        `).all(musteriId);
        
        // Borç kayıtlarını al
        const borclarim = db.prepare('SELECT * FROM borclarim WHERE alacakli = ? ORDER BY tarih DESC').all(musteriId);
        
        const response = {
            success: true,
            musteri: musteri,
            satisGecmisi: satisGecmisi,
            borclarim: borclarim,
            toplamSatis: satisGecmisi.length,
            toplamBorc: borclarim.reduce((sum, borc) => sum + borc.miktar, 0)
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Müşteri detay hatası:', error);
        res.status(500).json({ success: false, error: 'Müşteri detay hatası: ' + error.message });
    }
});

// Müşteri yükleme endpoint'i (veriler.json'dan)
app.post('/api/musteri-yukle-veriler-json', async (req, res) => {
    try {
        console.log('🔄 Veriler.json dosyasından müşteri yükleme başlatılıyor...');
        
        const verilerJsonPath = path.join(__dirname, 'veriler', 'veriler.json');
        
        if (!fs.existsSync(verilerJsonPath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'veriler.json dosyası bulunamadı' 
            });
        }
        
        const verilerContent = fs.readFileSync(verilerJsonPath, 'utf8');
        const yedekData = JSON.parse(verilerContent);
        
        if (!yedekData.musteriler || Object.keys(yedekData.musteriler).length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'veriler.json dosyasında müşteri verisi bulunamadı' 
            });
        }
        
        console.log('📊 Veriler.json dosyasından okunan müşteri verileri:', { 
            musteri: Object.keys(yedekData.musteriler).length 
        });
        
        const result = db.transaction(() => {
            let insertedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            
            Object.entries(yedekData.musteriler).forEach(([id, musteri]) => {
                try {
                    if (!musteri.ad) {
                        skippedCount++;
                        return;
                    }
                    
                    const musteriId = id || generateMusteriId();
                    
                    db.prepare(`
                        INSERT INTO musteriler (id, ad, telefon, adres, bakiye, eklenmeTarihi, guncellemeTarihi)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        musteriId,
                        musteri.ad,
                        musteri.telefon || '',
                        musteri.adres || '',
                        musteri.bakiye || 0,
                        musteri.eklenmeTarihi || new Date().toISOString(),
                        musteri.guncellemeTarihi || null
                    );
                    insertedCount++;
                } catch (error) {
                    console.error('❌ Müşteri yükleme hatası:', error);
                    errorCount++;
                }
            });
            
            return { insertedCount, errorCount, skippedCount };
        })();
        
        // Cache'i temizle
        memoryCache.clear();
        
        // Real-time sync
        io.emit('data-updated', { 
            type: 'musteri-loaded', 
            message: 'Müşteri verileri başarıyla yüklendi', 
            insertedCount: result.insertedCount 
        });
        
        console.log('✅ Veriler.json dosyasından müşteri yükleme tamamlandı:', result);
        
        res.json({ 
            success: true, 
            message: 'Müşteri verileri başarıyla yüklendi', 
            insertedCount: result.insertedCount, 
            errorCount: result.errorCount, 
            skippedCount: result.skippedCount 
        });
        
    } catch (error) {
        console.error('❌ Veriler.json müşteri yükleme hatası:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Veriler.json müşteri yükleme hatası: ' + error.message 
        });
    }
});

// Stok yükleme endpoint'i (veriler.json'dan) - EKSİK VERİLERİ OTOMATİK EKLE
app.post('/api/stok-yukle-veriler-json', async (req, res) => {
    try {
        console.log('🔄 Veriler.json dosyasından stok yükleme başlatılıyor...');
        
        const verilerJsonPath = path.join(__dirname, 'veriler', 'veriler.json');
        
        if (!fs.existsSync(verilerJsonPath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'veriler.json dosyası bulunamadı' 
            });
        }
        
        const verilerContent = fs.readFileSync(verilerJsonPath, 'utf8');
        
        if (!verilerContent || verilerContent.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: 'veriler.json dosyası boş' 
            });
        }
        
        const yedekData = JSON.parse(verilerContent);
        
        if (!yedekData.stokListesi || Object.keys(yedekData.stokListesi).length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'veriler.json dosyasında stok verisi bulunamadı' 
            });
        }
        
        console.log('📊 Veriler.json dosyasından okunan stok verileri:', { 
            stok: Object.keys(yedekData.stokListesi).length 
        });
        
        const result = db.transaction(() => {
            let insertedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            
            Object.entries(yedekData.stokListesi).forEach(([key, urun]) => {
                try {
                    if (!urun.barkod) {
                        skippedCount++;
                        return;
                    }
                    
                    // Ürün zaten mevcut mu kontrol et (barkod + marka + varyant kombinasyonu)
                    const existingProduct = db.prepare('SELECT * FROM stok WHERE barkod = ? AND (marka = ? OR (? IS NULL AND marka IS NULL)) AND (varyant_id = ? OR (? IS NULL AND varyant_id IS NULL))').get(
                        urun.barkod, 
                        urun.marka || null, 
                        urun.marka || null,
                        urun.varyant_id || null,
                        urun.varyant_id || null
                    );
                    
                    if (!existingProduct) {
                        // Yeni ürün ekle
                        const urunId = generateUrunId();
                        const satisFiyati = urun.satisFiyati || 0;
                        
                        db.prepare(`
                            INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(
                            urunId,
                            urun.barkod,
                            urun.ad || `${urun.barkod} ${urun.marka || ''}`.trim() || 'Bilinmeyen Ürün',
                            urun.marka || '',
                            urun.miktar || 1,
                            urun.alisFiyati || 0,
                            satisFiyati,
                            urun.kategori || '',
                            urun.aciklama || '',
                            urun.varyant_id || ''
                        );
                        insertedCount++;
                        console.log(`✅ Yeni ürün eklendi: ${urun.ad || urun.barkod} (${urun.barkod})`);
                    } else {
                        // Mevcut ürünü güncelle (sadece eksik alanları)
                        const updateFields = [];
                        const updateValues = [];
                        
                        if (existingProduct.alisFiyati === null && urun.alisFiyati) {
                            updateFields.push('alisFiyati = ?');
                            updateValues.push(urun.alisFiyati);
                        }
                        if (existingProduct.satisFiyati === null && urun.satisFiyati) {
                            updateFields.push('satisFiyati = ?');
                            updateValues.push(urun.satisFiyati);
                        } else if (existingProduct.satisFiyati === null && urun.alisFiyati) {
                            // Satış fiyatı yoksa alış fiyatından %20 kar marjı ile hesapla
                            updateFields.push('satisFiyati = ?');
                            updateValues.push(urun.satisFiyati || 0);
                        }
                        if (existingProduct.miktar === null && urun.miktar) {
                            updateFields.push('miktar = ?');
                            updateValues.push(urun.miktar);
                        }
                        if (existingProduct.marka === null && urun.marka) {
                            updateFields.push('marka = ?');
                            updateValues.push(urun.marka);
                        }
                        if (existingProduct.aciklama === null && urun.aciklama) {
                            updateFields.push('aciklama = ?');
                            updateValues.push(urun.aciklama);
                        }
                        
                        if (updateFields.length > 0) {
                            updateValues.push(existingProduct.id);
                            db.prepare(`UPDATE stok SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...updateValues);
                            console.log(`🔄 Ürün güncellendi: ${urun.ad || urun.barkod} (${urun.barkod})`);
                        }
                    }
                } catch (error) {
                    console.error('❌ Stok yükleme hatası:', error);
                    errorCount++;
                }
            });
            
            return { insertedCount, errorCount, skippedCount };
        })();
        
        // Cache'i temizle
        memoryCache.clear();
        
        // Real-time sync
        io.emit('data-updated', { 
            type: 'stok-loaded', 
            message: 'Stok verileri başarıyla yüklendi', 
            insertedCount: result.insertedCount 
        });
        
        console.log('✅ Veriler.json dosyasından stok yükleme tamamlandı:', result);
        
        res.json({ 
            success: true, 
            message: 'Stok verileri başarıyla yüklendi', 
            insertedCount: result.insertedCount, 
            errorCount: result.errorCount, 
            skippedCount: result.skippedCount 
        });
        
    } catch (error) {
        console.error('❌ Veriler.json stok yükleme hatası:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Veriler.json stok yükleme hatası: ' + error.message 
        });
    }
});

// Server startup (disabled duplicate listener - consolidated earlier)
/* server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 StokV1 Server running on port', PORT);
    console.log('📱 Local: http://localhost:' + PORT);
    console.log('🌐 Network: http://0.0.0.0:' + PORT);
    
    // Network interfaces
    const os = require('os');
    const interfaces = os.networkInterfaces();
    console.log('📡 Available network interfaces:');
    Object.keys(interfaces).forEach(iface => {
        interfaces[iface].forEach(details => {
            if (details.family === 'IPv4' && !details.internal) {
                console.log(`   ${iface}: http://${details.address}:${PORT}`);
            }
        });
    });
    
    // Start scheduled backups
    console.log('🔄 Günlük yedekleme başlatılıyor...');
    setInterval(sendDailyBackup, 24 * 60 * 60 * 1000); // 24 saat
    setInterval(sendDailyBackup, 6 * 60 * 60 * 1000); // 6 saat
}); */