        // Socket.IO connection - ULTRA OPTIMIZED for Multi-Device Sync
        const socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true,
            timeout: 10000,
            forceNew: false,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 3000,
            maxHttpBufferSize: 2e6, // 2MB
            pingTimeout: 30000,
            pingInterval: 15000
        });
        

        
        // Socket event handlers
        socket.on('connect', () => {
            console.log('🔗 Socket.IO bağlandı');
            
            // Update sync status indicator
            const syncIndicator = document.getElementById('syncIndicator');
            const syncText = document.getElementById('syncText');
            if (syncIndicator) {
                syncIndicator.classList.remove('offline');
                syncIndicator.classList.add('online');
            }
            if (syncText) {
                syncText.textContent = 'Çevrimiçi';
            }
            
            // Bağlantı kurulduğunda fresh data al
            socket.emit('requestData');
        });
        
        socket.on('disconnect', (reason) => {
            console.log('❌ Socket.IO bağlantısı kesildi:', reason);
            
            // Update sync status indicator
            const syncIndicator = document.getElementById('syncIndicator');
            const syncText = document.getElementById('syncText');
            if (syncIndicator) {
                syncIndicator.classList.remove('online');
                syncIndicator.classList.add('offline');
            }
            if (syncText) {
                syncText.textContent = 'Çevrimdışı';
            }
            
            // Enhanced reconnection for multi-device support
            if (reason === 'io server disconnect') {
                console.log('🔄 Server initiated disconnect - attempting manual reconnection');
                setTimeout(() => socket.connect(), 1000);
            }
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Socket bağlantı hatası:', error.message);
            showNotification('⚠️ Bağlantı hatası - HTTP modunda çalışıyor', 'warning');
        });
        
        socket.on('reconnect', (attemptNumber) => {
            console.log('✅ Socket yeniden bağlandı, deneme:', attemptNumber);
            showNotification('🔗 Bağlantı yeniden kuruldu', 'success');
            // Fresh data sync after reconnection
            setTimeout(() => tumVerileriYukle(), 500);
            // Offline kuyruk varsa işle
            try { if (typeof processOfflineQueue === 'function') setTimeout(processOfflineQueue, 1000); } catch (_) {}
        });
        
        socket.on('reconnect_error', (error) => {
            console.error('❌ Yeniden bağlanma hatası:', error.message);
        });
        
        socket.on('reconnect_failed', () => {
            console.error('❌ Yeniden bağlanma başarısız - HTTP modunda devam ediliyor');
            showNotification('❌ Sürekli bağlantı hatası - HTTP modu aktif', 'error');
        });
        
        // Network state monitoring for better mobile/multi-device support
        window.addEventListener('online', () => {
            console.log('🌐 Ağ bağlantısı aktif');
            if (!socket.connected) {
                console.log('🔄 Ağ aktif oldu, socket yeniden bağlanıyor...');
                socket.connect();
            }
            showNotification('🌐 İnternet bağlantısı aktif', 'success');
        });
        
        window.addEventListener('offline', () => {
            console.log('📵 Ağ bağlantısı kesildi');
            showNotification('📵 İnternet bağlantısı yok - Offline moda geçiliyor', 'warning');
        });
        
        // Enhanced page visibility handling for mobile devices
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('👁️ Sayfa görünür oldu');
                if (!socket.connected) {
                    console.log('🔄 Sayfa aktif oldu, socket bağlantısı kontrol ediliyor...');
                    setTimeout(() => {
                        if (!socket.connected) socket.connect();
                    }, 1000);
                } else {
                    // Sync data when page becomes visible
                    setTimeout(() => tumVerileriYukle(), 200);
                }
            }
        });
        
        socket.on('connected', (data) => {
            // console.log('✅ Socket bağlantısı kuruldu:', data);
            // İlk bağlantıda fresh data al
            socket.emit('requestData');
        });
        socket.on('dataUpdated', (data) => {
            // console.log('📡 Veri güncellendi:', data);
            
            // Kendi gönderdiğimiz güncellemeleri işleme
            if (data.source === socket.id) {
                // console.log('🔄 Kendi güncellememiz, işleme gerek yok');
                return;
            }
            
            // Spesifik güncelleme türüne göre işlem yap
            switch(data.type) {
                case 'missing-products-imported':
                    if (data.data) {
                        showNotification(`Eksik ürün içe aktarma: ${data.data.added} eklendi, ${data.data.updated} güncellendi, ${data.data.skipped} atlandı`, 'success');
                        setTimeout(() => tumVerileriYukle(), 500);
                    }
                    break;
                case 'stok-add':
                case 'stok-update':
                    if (data.data && data.data.barkod) {
                        // Use composite key for products to handle variants
                        const compositeKey = `${data.data.barkod}_${data.data.marka || ''}_${data.data.varyant_id || ''}`;
                        
                        // Also map backend fields to frontend expected fields
                        const mappedData = {
                            ...data.data,
                            urun_adi: data.data.ad || data.data.urun_adi || '',
                            stok_miktari: data.data.miktar || data.data.stok_miktari || 0,
                            fiyat: data.data.satisFiyati || data.data.fiyat || 0
                        };
                        
                        stokListesi[compositeKey] = mappedData;
                        guncellenenVerileriKaydet();
                        stokTablosunuGuncelle();
                        showNotification('📦 Stok güncellendi', 'info');
                    }
                    break;
                    
                case 'stok-delete':
                    if (data.data) {
                        // Barkod ve ID ile sil - tüm olası key'leri kontrol et
                        if (data.data.barkod || data.data.id) {
                            // Önce ID veya composite key ile eşleşen key'i ara
                            const keyToDelete = Object.keys(stokListesi).find(key => {
                                const product = stokListesi[key];
                                return product && (
                                    (data.data.id && product.id === data.data.id) ||
                                    (data.data.barkod && product.barkod === data.data.barkod && 
                                     (data.data.marka || '') === (product.marka || '') &&
                                     (data.data.varyant_id || '') === (product.varyant_id || ''))
                                );
                            });
                            
                            if (keyToDelete) {
                                delete stokListesi[keyToDelete];
                                console.log('🗑️ Product deleted by key:', keyToDelete);
                            } else {
                                console.warn('⚠️ Product not found for deletion:', data.data);
                            }
                        }
                        guncellenenVerileriKaydet();
                        stokTablosunuGuncelle();
                        showNotification('🗑️ Ürün silindi', 'info');
                    }
                    break;
                    
                case 'satis-add':
                    if (data.data) {
                        // Check if this sale already exists to prevent duplicates
                        const existingSale = satisGecmisi.find(sale => 
                            sale.id === data.data.id || 
                            (sale.barkod === data.data.barkod && 
                             sale.tarih === data.data.tarih && 
                             sale.miktar === data.data.miktar && 
                             sale.fiyat === data.data.fiyat)
                        );
                        
                        if (!existingSale) {
                            // Ensure urunAdi is properly set
                            if (!data.data.urunAdi && data.data.barkod) {
                                // Try to get product name from stock
                                const productEntry = Object.entries(stokListesi).find(([key, urun]) => urun.barkod === data.data.barkod);
                                if (productEntry) {
                                    const [key, urun] = productEntry;
                                    data.data.urunAdi = urun.urun_adi || urun.ad || 'Ürün Adı Yok';
                                }
                            }
                            satisGecmisi.push(data.data);
                            guncellenenVerileriKaydet();
                        }
                        satisTablosunuGuncelle();
                        guncelleIstatistikler();
                        showNotification('💰 Yeni satış kaydedildi', 'info');
                    }
                    break;
                    
                case 'musteri-add':
                    if (data.data) {
                        musteriler[data.data.id] = data.data;
                        guncellenenVerileriKaydet();
                        musteriTablosunuGuncelle();
                        showNotification('👥 Yeni müşteri eklendi', 'info');
                    }
                    break;
                    
                case 'musteri-delete':
                    if (data.data && data.data.id) {
                        delete musteriler[data.data.id];
                        guncellenenVerileriKaydet();
                        musteriTablosunuGuncelle();
                        showNotification('🗑️ Müşteri silindi', 'info');
                    }
                    break;
                    
                case 'borc-add':
                    if (data.data && data.data.id) {
                        // FIXED: Proper debt data structure handling
                        borclarim[data.data.id] = {
                            id: data.data.id,
                            alacakli: data.data.alacakli || '',
                            miktar: parseFloat(data.data.miktar) || 0,
                            aciklama: data.data.aciklama || '',
                            tarih: data.data.tarih || new Date().toISOString().split('T')[0],
                            odemeTarihi: data.data.odemeTarihi || null,
                            durum: data.data.durum || 'Ödenmedi'
                        };
                        guncellenenVerileriKaydet();
                        borcTablosunuGuncelle();
                        showNotification('💳 Yeni borç eklendi', 'info');
                    }
                    break;
                    
                case 'borc-update':
                    if (data.data && data.data.id) {
                        // FIXED: Proper debt data structure handling
                        borclarim[data.data.id] = {
                            id: data.data.id,
                            alacakli: data.data.alacakli || '',
                            miktar: parseFloat(data.data.miktar) || 0,
                            aciklama: data.data.aciklama || '',
                            tarih: data.data.tarih || new Date().toISOString().split('T')[0],
                            odemeTarihi: data.data.odemeTarihi || null,
                            durum: data.data.durum || 'Ödenmedi'
                        };
                        guncellenenVerileriKaydet();
                        borcTablosunuGuncelle();
                        showNotification('🔄 Borç güncellendi', 'info');
                    }
                    break;
                    
                case 'borc-delete':
                    if (data.data && data.data.id) {
                        delete borclarim[data.data.id];
                        guncellenenVerileriKaydet();
                        borcTablosunuGuncelle();
                        showNotification('🗑️ Borç silindi', 'info');
                    }
                    break;
                    
                case 'satis-delete':
                    // FIX: Handle server-initiated deletions and other client deletions properly
                    if (data.data && (data.data.satisId || data.data.id)) {
                        const satisId = data.data.satisId || data.data.id;
                        
                        // Skip if this is from the same client (to prevent double deletion)
                        if (data.source === socket.id) {
                            console.log('🔄 Kendi silme işlemimiz, atlanıyor');
                            break;
                        }
                        
                        // Find and remove the sale from local array
                        const satisIndex = satisGecmisi.findIndex(sale => 
                            sale.id == satisId || sale.id === parseInt(satisId)
                        );
                        
                        if (satisIndex !== -1) {
                            satisGecmisi.splice(satisIndex, 1);
                            satisTablosunuGuncelle();
                            guncelleIstatistikler();
                            guncellenenVerileriKaydet();
                            
                            if (data.source === 'server') {
                                console.log('🔄 Sunucu kaynaklı silme işlemi');
                                // Don't show notification for server-initiated deletions (user already did the action)
                            } else {
                                showNotification('🗑️ Satış silindi (başka kullanıcı tarafından)', 'info');
                            }
                        }
                    }
                    break;
                    
                case 'satis-iade':
                    if (data.data && data.data.satisId) {
                        // Handle return/refund
                        const satisId = data.data.satisId;
                        const satisIndex = satisGecmisi.findIndex(sale => 
                            sale.id == satisId || sale.id === parseInt(satisId)
                        );
                        
                        if (satisIndex !== -1) {
                            satisGecmisi.splice(satisIndex, 1);
                            
                            // Update stock if stock update info is provided
                            if (data.data.stokGuncellemesi) {
                                const stokData = data.data.stokGuncellemesi;
                                const compositeKey = `${stokData.barkod}_${stokData.marka || ''}_${stokData.varyant_id || ''}`;
                                
                                const mappedData = {
                                    ...stokData,
                                    urun_adi: stokData.ad || stokData.urun_adi || '',
                                    stok_miktari: stokData.miktar || stokData.stok_miktari || 0,
                                    fiyat: stokData.satisFiyati || stokData.fiyat || 0
                                };
                                
                                stokListesi[compositeKey] = mappedData;
                                stokTablosunuGuncelle();
                            }
                            
                            satisTablosunuGuncelle();
                            guncelleIstatistikler();
                            guncellenenVerileriKaydet();
                            showNotification('🔄 Satış iade edildi', 'success');
                        }
                    }
                    break;

                    
                case 'bulk-sync':
                    // Toplu senkronizasyon tamamlandığında
                    tumVerileriYukle();
                    lastSyncTime = Date.now();
                    // showNotification('🔄 Veriler senkronize edildi', 'info');
                    break;
                    
                case 'backup-synced':
                    // Yedek senkronizasyon tamamlandığında
                    console.log('🔄 Yedek senkronizasyon tamamlandı');
                    tumVerileriYukle();
                    // showNotification('🔄 Yedek veriler senkronize edildi', 'success');
                    break;
                    
                default:
                    // Tüm verileri yeniden yükle
                    tumVerileriYukle();
                    lastSyncTime = Date.now();
                    // showNotification('🔄 Veriler senkronize edildi', 'info');
                    break;
            }
        });
        socket.on('dataResponse', (response) => {
            if (response.success && response.data) {
                console.log('📄 Fresh data alındı:', response.count);
                stokListesi = response.data.stokListesi || {};
                satisGecmisi = response.data.satisGecmisi || [];
                musteriler = response.data.musteriler || {};
                borclarim = response.data.borclarim || {};
                
                guncellenenVerileriKaydet();
                stokTablosunuGuncelle();
                satisTablosunuGuncelle();
                musteriTablosunuGuncelle();
                guncelleIstatistikler();
                
                // Başarılı senkronizasyon bildirimi - SADECE GERÇEK DEĞİŞİKLİKLERDE
                if (response.count && response.count.stok > 0) {
                    lastSyncTime = Date.now();
                    const now = Date.now();
                    // Sadece gerçek değişikliklerde bildirim göster
                    if (now - lastNotificationTime > NOTIFICATION_COOLDOWN && response.count.stok > 0) {
                        lastNotificationTime = now;
                    }
                }
            } else {
                console.error('❌ Data response hatası:', response.error);
                showNotification('Veri senkronizasyonu başarısız', 'error');
            }
        });
        
        socket.on('syncResponse', (response) => {
            if (response.success && response.data) {
                stokListesi = response.data.stokListesi || {};
                satisGecmisi = response.data.satisGecmisi || [];
                musteriler = response.data.musteriler || {};
                borclarim = response.data.borclarim || {};
                
                guncellenenVerileriKaydet();
                stokTablosunuGuncelle();
                satisTablosunuGuncelle();
                musteriTablosunuGuncelle();
                guncelleIstatistikler();
                
                lastSyncTime = Date.now();
                const now = Date.now();
                if (now - lastNotificationTime > NOTIFICATION_COOLDOWN && syncNotificationShown) {
                    lastNotificationTime = now;
                    syncNotificationShown = false; // Reset
                }
            }
        });
        
        // Performance optimizations
        const FRONTEND_CACHE_SIZE = 100;
        const SYNC_INTERVAL = 60000; // 60 seconds for optimized sync (changed from 15 seconds)
        const frontendCache = new Map();
        
        // Debounce mechanism for client-side updates
        const CLIENT_DEBOUNCE_DELAY = 1000; // 1 second debounce
        const pendingClientUpdates = new Map();
        
        // Connection status
        let isOnline = navigator.onLine;
        let lastSyncTime = Date.now();
        
        // Performance monitoring
        const performanceMetrics = {
            loadTime: 0,
            syncCount: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Stok listesi objesi - localStorage destekli
        let stokListesi = {};
        
        // Satış geçmişi
        let satisGecmisi = [];
        
        // Müşteriler
        let musteriler = {};
        
        // Borçlarım
        let borclarim = {};
        
        // API Base URL (dinamik)
        const API_BASE = window.location.origin;
        
        // Görünüm ayarları
        let currentView = 'table';
        
        // Sıralama ayarları
        let currentSort = { column: null, direction: 'asc' };
        
        // Müşteri sıralama ayarları
        let currentCustomerSort = { column: null, direction: 'asc' };
        
        // Satış geçmişi sıralama ayarları
        let currentSalesSort = { column: null, direction: 'asc' };
        
        // Geçerli barkod
        let currentBarcode = '';
        
        // Düzenleme modunda mı
        let editingMode = false;
        
        // Düzenlenen müşteri ID
        let editingMusteriId = null;
        
        // Düzenlenen ürün barkod'u
        let editingBarkod = null;
        
        // Düzenlenen satış ID
        let editingSaleId = null;
        
        // Düzenlenen borç ID
        let editingDebtId = null;
        
        // Müşteriye satış eklemede kullanılacak müşteri ID
        let currentCustomerForSale = null;

        // Tema ayarları
        let currentTheme = localStorage.getItem('theme') || 'light';
        
        // Notification throttling - prevent excessive sync notifications - ULTRA OPTIMIZED
        let lastNotificationTime = 0;
        const NOTIFICATION_COOLDOWN = 10 * 60 * 1000; // 10 minutes in milliseconds - PERFORMANCE OPTIMIZATION
        let syncNotificationShown = false; // Sadece işlem yapıldığında göster
        
        // Improved data initialization flags
        let dataInitialized = false;
        let isDataLoading = false;
        
        // Tüm verileri yükle (backend'den)
        async function tumVerileriYukle() {
            try {
                console.log('🔄 Backend\'den veri çekiliyor...');
                const response = await fetch(`${API_BASE}/api/tum-veriler`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                
                if (result.success && result.data) {
                    console.log('✅ Backend verisi başarıyla alındı');
                    
                    // Backend'den gelen verileri kontrol et
                    const backendStokListesi = result.data.stokListesi || {};
                    const backendSatisGecmisi = result.data.satisGecmisi || [];
                    const backendMusteriler = result.data.musteriler || {};
                    const backendBorclarim = result.data.borclarim || {};
                    
                    // Validate data integrity
                    const stokCount = Object.keys(backendStokListesi).length;
                    const satisCount = backendSatisGecmisi.length;
                    const musteriCount = Object.keys(backendMusteriler).length;
                    
                    console.log('📊 Backend\'den yüklenen veriler:', {
                        stok: stokCount,
                        satis: satisCount,
                        musteri: musteriCount
                    });
                    // Backend verilerini öncelikli olarak kullan
                    if (stokCount > 0 || satisCount > 0 || musteriCount > 0) {
                        // Stok verilerini backend'den tamamen al (duplicate önleme)
                        stokListesi = backendStokListesi;
                        
                        // Satış geçmişini merge et (duplicate kontrolü ile)
                        const mergedSatisGecmisi = [...satisGecmisi];
                        backendSatisGecmisi.forEach(backendSale => {
                            const existingSale = mergedSatisGecmisi.find(sale => 
                                sale.id === backendSale.id || 
                                (sale.barkod === backendSale.barkod && 
                                 sale.tarih === backendSale.tarih && 
                                 sale.miktar === backendSale.miktar &&
                                 sale.fiyat === backendSale.fiyat)
                            );
                            if (!existingSale) {
                                mergedSatisGecmisi.push(backendSale);
                            }
                        });
                        
                        // Müşteri verilerini merge et (backend öncelikli)
                        const mergedMusteriler = { ...musteriler, ...backendMusteriler };
                        
                        // Borç verilerini merge et (backend öncelikli)
                        const mergedBorclarim = { ...borclarim, ...backendBorclarim };
                        
                        // Güncellenmiş verileri ata
                        satisGecmisi = mergedSatisGecmisi;
                        musteriler = mergedMusteriler;
                        borclarim = mergedBorclarim;
                        
                        // Backend verisini localStorage'a kaydet
                        localStorage.setItem('saban_data', JSON.stringify({
                            stokListesi, satisGecmisi, musteriler, borclarim,
                            lastSync: new Date().toISOString(),
                            source: 'backend'
                        }));
                        
                        console.log('✅ Backend verileri local verilerle birleştirildi');
                    } else {
                        console.log('⚠️ Backend\'de veri bulunamadı, local veriler korunuyor');
                        showNotification('Veritabanında veri bulunamadı, local veriler korunuyor', 'warning');
                    }
                    
                    // UI'yi güncelle
                    stokTablosunuGuncelle();
                    satisTablosunuGuncelle();
                    musteriTablosunuGuncelle();
                    guncelleIstatistikler();
                    
                    return true;
                } else {
                    throw new Error(result.error || 'Bilinmeyen hata');
                }
            } catch (error) {
                console.error('❌ Backend\'den veri alınamadı:', error);
                showNotification('Veri yükleme hatası: ' + error.message, 'error');
                return false;
            }
        }
        
        // Veri başlatma fonksiyonu - ULTRA OPTIMIZED
        async function initializeData() {
            // Prevent multiple initializations
            if (isDataLoading || dataInitialized) {
                console.log('⏭️ Data initialization already in progress or completed');
                return;
            }
            
            isDataLoading = true;
            const startTime = performance.now();
            console.log('🚀 Veri başlatma başlıyor...');
            
            try {
                // 1. Önce localStorage'dan hızlı yükleme (cache)
                const savedData = localStorage.getItem('saban_data');
                let localDataLoaded = false;
                
                if (savedData) {
                    try {
                        const data = JSON.parse(savedData);
                        if (data && data.stokListesi && data.satisGecmisi && data.musteriler) {
                            stokListesi = data.stokListesi || {};
                            satisGecmisi = data.satisGecmisi || [];
                            musteriler = data.musteriler || {};
                            borclarim = data.borclarim || {};
                            
                            // Cache'e ekle
                            frontendCache.set('local_data', {
                                data: data,
                                timestamp: Date.now()
                            });
                            
                            console.log('📄 LocalStorage\'dan yüklendi:', {
                                stok: Object.keys(stokListesi).length,
                                satis: satisGecmisi.length,
                                musteri: Object.keys(musteriler).length,
                                borc: Object.keys(borclarim).length,
                                lastSync: data.lastSync,
                                source: data.source
                            });
                            
                            // UI'yi hızlıca güncelle
                            stokTablosunuGuncelle();
                            satisTablosunuGuncelle();
                            musteriTablosunuGuncelle();
                            borcTablosunuGuncelle();
                            guncelleIstatistikler();
                            
                            // UI durumunu geri yükle
                            restoreUIState(data);
                            
                            performanceMetrics.cacheHits++;
                            localDataLoaded = true;
                            dataInitialized = true; // Mark as initialized early for better UX
                        }
                    } catch (error) {
                        console.error('❌ LocalStorage parse hatası:', error);
                        performanceMetrics.cacheMisses++;
                        localStorage.removeItem('saban_data'); // Remove corrupted data
                    }
                }
                
                // 2. Backend'den fresh data al (öncelikli) - ULTRA OPTIMIZED
                if (window.navigator.onLine && (socket.connected || !localDataLoaded)) {
                    const backendSuccess = await tumVerileriYukle();
                    
                    if (backendSuccess) {
                        console.log('✅ Backend verisi başarıyla yüklendi');
                        if (!localDataLoaded) {
                            showNotification('Veriler yüklendi', 'success');
                        }
                        performanceMetrics.syncCount++;
                        syncNotificationShown = true; // İşlem yapıldığını işaretle
                        dataInitialized = true;
                    } else if (!localDataLoaded) {
                        console.log('⚠️ Backend bağlantısı başarısız, boş verilerle başlatılıyor');
                        // Initialize with empty data if nothing else worked
                        stokListesi = {};
                        satisGecmisi = [];
                        musteriler = {};
                        borclarim = {};
                        dataInitialized = true;
                        showNotification('Backend bağlantısı kurulamadı', 'warning');
                    }
                } else if (!localDataLoaded) {
                    // Offline and no local data
                    console.log('📴 Çevrimdışı ve local veri yok');
                    stokListesi = {};
                    satisGecmisi = [];
                    musteriler = {};
                    borclarim = {};
                    dataInitialized = true;
                    showNotification('📴 Çevrimdışı modda başlatıldı', 'info');
                }
                
                // 3. Socket.IO bağlantısını kontrol et
                if (socket.connected) {
                    console.log('🔗 Socket.IO bağlantısı aktif');
                } else {
                    console.log('⚠️ Socket.IO bağlantısı yok, HTTP API kullanılıyor');
                }
                
                // Performance metrics
                performanceMetrics.loadTime = performance.now() - startTime;
                console.log(`⚡ Veri yükleme süresi: ${performanceMetrics.loadTime.toFixed(2)}ms`);
                console.log('✅ Veri başlatma tamamlandı');
                
                // Network bilgilerini yükle
                await loadNetworkInfo();
                
            } catch (error) {
                console.error('❌ Veri başlatma hatası:', error);
                showNotification('Veri yükleme hatası: ' + error.message, 'error');
                
                // Initialize with empty data on error
                if (!dataInitialized) {
                    stokListesi = {};
                    satisGecmisi = [];
                    musteriler = {};
                    borclarim = {};
                    dataInitialized = true;
                }
            } finally {
                isDataLoading = false;
            }
        }
        
        // Güvenli fetch yardımcı fonksiyonu
        async function safeFetch(url, options = {}) {
            try {
                const response = await fetch(url, options);
                
                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Server JSON yanıtı döndürmedi');
                }
                
                return await response.json();
            } catch (error) {
                console.error('❌ Fetch hatası:', error);
                throw error;
            }
        }
        
        // UI durumunu geri yükleme fonksiyonu
        function restoreUIState(data) {
            try {
                // Form verilerini geri yükle
                if (data.formData) {
                    let restoredInputs = 0;
                    Object.keys(data.formData).forEach(inputId => {
                        const input = document.getElementById(inputId);
                        if (input && input.type !== 'file' && data.formData[inputId]) {
                            input.value = data.formData[inputId];
                            // Geri yüklenen input'lara görsel geri bildirim
                            input.style.backgroundColor = '#e8f5e8';
                            setTimeout(() => {
                                input.style.backgroundColor = '';
                            }, 2000);
                            restoredInputs++;
                        }
                    });
                    
                    if (restoredInputs > 0) {
                        showNotification(`📝 ${restoredInputs} form alanı geri yüklendi`, 'info');
                    }
                }
                
                // Düzenleme durumlarını geri yükle
                if (data.uiState) {
                    editingMode = data.uiState.editingMode || false;
                    editingMusteriId = data.uiState.editingMusteriId || null;
                    editingBarkod = data.uiState.editingBarkod || null;
                    editingSaleId = data.uiState.editingSaleId || null;
                    editingDebtId = data.uiState.editingDebtId || null;
                    currentCustomerForSale = data.uiState.currentCustomerForSale || null;
                    currentView = data.uiState.currentView || 'table';
                    currentSort = data.uiState.currentSort || { column: null, direction: 'asc' };
                    currentCustomerSort = data.uiState.currentCustomerSort || { column: null, direction: 'asc' };
                    currentSalesSort = data.uiState.currentSalesSort || { column: null, direction: 'asc' };
                    currentBarcode = data.uiState.currentBarcode || '';
                    
                    // Tema durumunu geri yükle
                    if (data.uiState.currentTheme && data.uiState.currentTheme !== currentTheme) {
                        currentTheme = data.uiState.currentTheme;
                        document.documentElement.setAttribute('data-theme', currentTheme);
                        localStorage.setItem('theme', currentTheme);
                    }
                }
                
                // Görünür panelleri geri yükle
                if (data.visibleElements) {
                    Object.keys(data.visibleElements).forEach(elementId => {
                        const element = document.getElementById(elementId);
                        if (element && data.visibleElements[elementId]) {
                            element.style.display = 'block';
                        }
                    });
                }
                
                // Düzenleme modundaysa ilgili butonları aktif et
                if (editingMode) {
                    if (editingMusteriId) {
                        // Müşteri düzenleme modunu aktif et
                        const musteriIptalBtn = document.getElementById('musteriIptalBtn');
                        if (musteriIptalBtn) {
                            musteriIptalBtn.style.display = 'inline-block';
                        }
                    }
                    if (editingBarkod) {
                        // Ürün düzenleme modunu aktif et
                        const form = document.getElementById('urunForm');
                        if (form) {
                            form.classList.add('editing-mode');
                        }
                    }
                }
                
                // Devam eden işlemleri geri yükle
                if (data.pendingOperations && data.pendingOperations.lastOperation) {
                    const operation = data.pendingOperations;
                    const timeSinceOperation = Date.now() - (operation.operationTimestamp || 0);
                    
                    // Eğer işlem 5 dakikadan eskiyse, kullanıcıya sor
                    if (timeSinceOperation < 5 * 60 * 1000) {
                        window.lastOperation = operation.lastOperation;
                        window.operationTimestamp = operation.operationTimestamp;
                        window.operationData = operation.operationData;
                        
                        // Kullanıcıya devam etmek isteyip istemediğini sor
                        setTimeout(() => {
                            if (confirm(`Sayfa yenilenmeden önce "${operation.lastOperation}" işlemi yarıda kaldı. Devam etmek istiyor musunuz?`)) {
                                resumePendingOperation(operation);
                            } else {
                                clearPendingOperation();
                            }
                        }, 1000);
                    }
                }
                
                console.log('✅ UI durumu geri yüklendi:', {
                    editingMode: editingMode,
                    currentView: currentView,
                    formsRestored: data.formData ? Object.keys(data.formData).length : 0,
                    panelsRestored: data.visibleElements ? Object.keys(data.visibleElements).length : 0,
                    pendingOperation: data.pendingOperations ? data.pendingOperations.lastOperation : 'none'
                });
                
            } catch (error) {
                console.error('❌ UI durumu geri yükleme hatası:', error);
            }
        }
        
        // Devam eden işlemi kaydet
        function savePendingOperation(operationType, operationData = null) {
            window.lastOperation = operationType;
            window.operationTimestamp = Date.now();
            window.operationData = operationData;
            guncellenenVerileriKaydet(); // Durumu hemen kaydet
            
            // Görsel geri bildirim
            console.log('💾 İşlem kaydedildi:', operationType);
            showNotification(`💾 ${operationType} işlemi kaydedildi`, 'info');
        }
        
        // Devam eden işlemi temizle
        function clearPendingOperation() {
            if (window.lastOperation) {
                console.log('🗑️ İşlem temizlendi:', window.lastOperation);
            }
            window.lastOperation = null;
            window.operationTimestamp = null;
            window.operationData = null;
            guncellenenVerileriKaydet(); // Durumu hemen kaydet
        }
        
        // Yarıda kalan işlemi devam ettir
        function resumePendingOperation(operation) {
            try {
                console.log('🔄 Yarıda kalan işlem devam ettiriliyor:', operation.lastOperation);
                
                switch (operation.lastOperation) {
                    case 'urun_ekleme':
                        if (operation.operationData) {
                            // Ürün ekleme formunu doldur ve göster
                            const urunPanel = document.getElementById('products-panel');
                            if (urunPanel) urunPanel.style.display = 'block';
                            showNotification('Ürün ekleme işlemi devam ettiriliyor...', 'info');
                        }
                        break;
                    case 'musteri_ekleme':
                        if (operation.operationData) {
                            // Müşteri ekleme formunu doldur ve göster
                            const musteriPanel = document.getElementById('customers-panel');
                            if (musteriPanel) musteriPanel.style.display = 'block';
                            showNotification('Müşteri ekleme işlemi devam ettiriliyor...', 'info');
                        }
                        break;
                    case 'satis_islemi':
                        if (operation.operationData) {
                            // Satış işlemini devam ettir
                            const satisPanel = document.getElementById('sales-panel');
                            if (satisPanel) satisPanel.style.display = 'block';
                            showNotification('Satış işlemi devam ettiriliyor...', 'info');
                        }
                        break;
                    case 'borc_ekleme':
                        if (operation.operationData) {
                            // Borç ekleme formunu doldur ve göster
                            const borcPanel = document.getElementById('debts-panel');
                            if (borcPanel) borcPanel.style.display = 'block';
                            showNotification('Borç ekleme işlemi devam ettiriliyor...', 'info');
                        }
                        break;
                    default:
                        console.log('⚠️ Bilinmeyen işlem türü:', operation.lastOperation);
                }
                
                // İşlem devam ettirildikten sonra temizle
                clearPendingOperation();
                
            } catch (error) {
                console.error('❌ İşlem devam ettirme hatası:', error);
                clearPendingOperation();
            }
        }
        
        // Local storage'a kaydet (sadece local backup için) - İyileştirilmiş
        function guncellenenVerileriKaydet() {
            try {
                // Veri bütünlüğünü kontrol et
                const stokCount = Object.keys(stokListesi || {}).length;
                const satisCount = (satisGecmisi || []).length;
                const musteriCount = Object.keys(musteriler || {}).length;
                const borcCount = Object.keys(borclarim || {}).length;
                
                // Kaydetmeyi atlama kaldırıldı: UI durumu ve işlem bilgisi her durumda kaydedilir
                
                // Form verilerini topla
                const formData = {};
                const formInputs = document.querySelectorAll('input, textarea, select');
                formInputs.forEach(input => {
                    if (input.id && input.value !== '' && input.type !== 'file') {
                        formData[input.id] = input.value;
                    }
                });
                
                // Düzenleme durumlarını ve UI durumlarını kaydet
                const uiState = {
                    editingMode: editingMode,
                    editingMusteriId: editingMusteriId,
                    editingBarkod: editingBarkod,
                    editingSaleId: editingSaleId,
                    editingDebtId: editingDebtId,
                    currentCustomerForSale: currentCustomerForSale,
                    currentView: currentView,
                    currentSort: currentSort,
                    currentCustomerSort: currentCustomerSort,
                    currentSalesSort: currentSalesSort,
                    currentBarcode: currentBarcode,
                    currentTheme: currentTheme
                };
                
                // Açık panelleri ve modal durumlarını kaydet
                const visibleElements = {};
                const panels = document.querySelectorAll('.panel, .modal');
                panels.forEach(panel => {
                    if (panel.id && panel.style.display === 'block') {
                        visibleElements[panel.id] = true;
                    }
                });
                
                // Devam eden işlemleri kaydet
                const pendingOperations = {
                    lastOperation: window.lastOperation || null,
                    operationTimestamp: window.operationTimestamp || null,
                    operationData: window.operationData || null
                };
                
                const dataToSave = {
                    stokListesi: stokListesi || {},
                    satisGecmisi: satisGecmisi || [],
                    musteriler: musteriler || {},
                    borclarim: borclarim || {},
                    formData: formData,
                    uiState: uiState,
                    visibleElements: visibleElements,
                    pendingOperations: pendingOperations,
                    lastSync: new Date().toISOString(),
                    source: 'local'
                };
                
                localStorage.setItem('saban_data', JSON.stringify(dataToSave));
                console.log('💾 LocalStorage\'a kaydedildi:', {
                    stok: stokCount,
                    satis: satisCount,
                    musteri: musteriCount,
                    borc: borcCount
                });
                
                // Auto-sync to backend if connected
                if (socket.connected) {
                    setTimeout(() => {
                        topluSenkronizasyon();
                    }, 1000);
                }
            } catch (error) {
                console.error('❌ LocalStorage kaydetme hatası:', error);
            }
        }
        // Setup sync status indicator timer
        function setupSyncStatusTimer() {
            const syncStatusIndicator = document.querySelector('.sync-status-indicator');
            
            // Initially hide it
            if (syncStatusIndicator) {
                syncStatusIndicator.style.display = 'none';
                
                // Show it every 5 minutes for 10 seconds
                setInterval(() => {
                    syncStatusIndicator.style.display = 'flex';
                    setTimeout(() => {
                        syncStatusIndicator.style.display = 'none';
                    }, 10000); // Hide after 10 seconds
                }, 300000); // 5 minutes = 300000 ms
            }
        }
        
        // Network bilgilerini yükle ve göster
        async function loadNetworkInfo() {
            try {
                const response = await fetch(`${API_BASE}/api/network-info`);
                const result = await response.json();
                
                if (result.success && result.networkInfo) {
                    const networkInfo = result.networkInfo;
                    const localIpElement = document.getElementById('localIpText');
                    
                    if (localIpElement && networkInfo.localIPs.length > 0) {
                        const primaryIP = networkInfo.primaryIP;
                        const primaryURL = networkInfo.primaryURL;
                        
                        localIpElement.innerHTML = `
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                <div style="font-weight: 600;">Yerel IP: ${primaryIP}</div>
                                <div style="font-size: 10px; opacity: 0.8;">Port: ${networkInfo.port}</div>
                                <div style="font-size: 9px; opacity: 0.6;">Tıklayarak kopyala</div>
                            </div>
                        `;
                        
                        // Make the IP clickable - Geliştirilmiş
                        const localIpDisplay = document.getElementById('localIpDisplay');
                        if (localIpDisplay) {
                            localIpDisplay.style.cursor = 'pointer';
                            localIpDisplay.title = `QR kod ile bağlan: ${primaryURL}`;
                            localIpDisplay.onclick = () => {
                                navigator.clipboard.writeText(primaryURL).then(() => {
                                    showNotification('🔗 Bağlantı adresi kopyalandı!', 'success');
                                }).catch(() => {
                                    showNotification('❌ Kopyalama başarısız', 'error');
                                });
                            };
                        }
                        
                        console.log('📶 Network bilgileri yüklendi:', networkInfo);
                    }
                }
            } catch (error) {
                console.error('Network bilgisi yüklenirken hata:', error);
                const localIpElement = document.getElementById('localIpText');
                if (localIpElement) {
                    localIpElement.textContent = 'IP alınamadı';
                }
            }
        }
        
        // Sayfa yüklendiğinde çalışacak fonksiyonlar
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('🚀 Sayfa yüklendi, sistem başlatılıyor...');
            
            // Tema kontrolü ve ayarlama
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            currentTheme = savedTheme;
            
            // Tema ikonunu ayarla
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            if (currentTheme === 'dark') {
                themeIcon.className = 'fas fa-sun';
                themeText.textContent = 'Açık Tema';
            } else {
                themeIcon.className = 'fas fa-moon';
                themeText.textContent = 'Karanlık Tema';
            }
            
            // Veri başlatma
            await initializeData();
            
            // Periyodik senkronizasyon (15 saniyede bir) - ULTRA OPTIMIZED
            setInterval(() => {
                if (socket.connected) {
                    guncellenenVerileriKaydet();
                }
            }, SYNC_INTERVAL);
            
            // Sayfa görünür olduğunda senkronizasyon
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && socket.connected) {
                    console.log('👁️ Sayfa görünür oldu, senkronizasyon yapılıyor...');
                    tumVerileriYukle();
                }
            });
            
            // Sayfa yenilenmeden önce veri kaydetme - Geliştirilmiş
            window.addEventListener('beforeunload', (e) => {
                guncellenenVerileriKaydet();
                
                // Eğer devam eden bir işlem varsa kullanıcıyı uyar
                if (window.lastOperation) {
                    const message = 'Devam eden bir işleminiz var. Çıkmak istediğinizden emin misiniz?';
                    e.preventDefault();
                    e.returnValue = message;
                    return message;
                }
            });
            
            // Form verilerini otomatik kaydetme - Kullanıcı yazarken kaydet
            setupAutoSaveFormData();
            
            // Kullanıcıya otomatik kaydetme hakkında bilgi ver
            showNotification('🔄 Otomatik kaydetme aktif - Verileriniz sayfa yenilense bile korunur', 'info');
            
            console.log('✅ Sistem başlatma tamamlandı');
        });
        
        // Form verilerini otomatik kaydetme sistemi
        function setupAutoSaveFormData() {
            let autoSaveTimeout;
            
            // Tüm input, textarea ve select elementlerine event listener ekle
            document.addEventListener('input', function(e) {
                if (e.target.matches('input, textarea, select')) {
                    // Debounced auto-save - 2 saniye sonra kaydet
                    clearTimeout(autoSaveTimeout);
                    autoSaveTimeout = setTimeout(() => {
                        guncellenenVerileriKaydet();
                        console.log('💾 Form verileri otomatik kaydedildi');
                        
                        // Sync indicator'ı kısa süre için parlat
                        const syncIndicator = document.getElementById('syncIndicator');
                        if (syncIndicator) {
                            syncIndicator.style.animation = 'pulse 1s ease-in-out';
                            setTimeout(() => {
                                syncIndicator.style.animation = '';
                            }, 1000);
                        }
                    }, 2000);
                }
            });
            
            // Change event'i için de ekle (select elementleri için)
            document.addEventListener('change', function(e) {
                if (e.target.matches('input, textarea, select')) {
                    clearTimeout(autoSaveTimeout);
                    autoSaveTimeout = setTimeout(() => {
                        guncellenenVerileriKaydet();
                        console.log('💾 Form verileri otomatik kaydedildi');
                        
                        // Sync indicator'ı kısa süre için parlat
                        const syncIndicator = document.getElementById('syncIndicator');
                        if (syncIndicator) {
                            syncIndicator.style.animation = 'pulse 1s ease-in-out';
                            setTimeout(() => {
                                syncIndicator.style.animation = '';
                            }, 1000);
                        }
                    }, 1000);
                }
            });
            
            // Periyodik otomatik kaydetme - Her 30 saniyede bir
            setInterval(() => {
                guncellenenVerileriKaydet();
                console.log('💾 Periyodik otomatik kaydetme yapıldı');
            }, 30000); // 30 saniye
            
            console.log('✅ Otomatik form kaydetme sistemi kuruldu');
        }
        
        // Test verisi yükleme fonksiyonu - Geliştirilmiş
        async function loadTestData() {
            try {
                console.log('🔄 Yedek veriler yükleniyor...');
                
                // Veriler.json dosyasından yükle
                const response = await fetch(`${API_BASE}/api/yedek-yukle-veriler-json`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Yedek veriler başarıyla yüklendi:', result.data);
                    showNotification(`✅ Yedek veriler yüklendi: ${result.data.insertedCount} yeni, ${result.data.updatedCount} güncellendi`, 'success');
                    
                    // Fresh data al
                    await tumVerileriYukle();
                    
                    syncNotificationShown = true;
                    return true;
                } else {
                    throw new Error(result.error || 'Yedek veri yükleme başarısız');
                }
                
            } catch (error) {
                console.error('❌ Yedek veri yükleme hatası:', error);
                showNotification('Yedek veri yükleme hatası: ' + error.message, 'error');
                return false;
            }
        }

        // Veriler.json dosyasından yedek yükleme
        async function yedekVerileriYukleVerilerJson() {
            try {
                console.log('🔄 Veriler.json dosyasından yedek yükleme başlatılıyor...');
                
                // Backend'e veriler.json yedek yükleme isteği gönder
                const response = await fetch(`${API_BASE}/api/yedek-yukle-veriler-json`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Veriler.json dosyasından yedek yükleme tamamlandı:', result.data);
                    showNotification(`✅ Veriler.json yedek veriler yüklendi: ${result.data.insertedCount} yeni, ${result.data.updatedCount} güncellendi, ${result.data.skippedCount} atlandı`, 'success');
                    
                    // Fresh data al
                    await tumVerileriYukle();
                    
                    syncNotificationShown = true;
                    return true;
                } else {
                    throw new Error(result.error || 'Veriler.json yedek yükleme başarısız');
                }
                
            } catch (error) {
                console.error('❌ Veriler.json yedek yükleme hatası:', error);
                showNotification('Veriler.json yedek yükleme hatası: ' + error.message, 'error');
                return false;
            }
        }
        // Gelişmiş yedek yükleme sistemi
        async function yedekVerileriYukleGelismis() {
            try {
                console.log('🔄 Gelişmiş yedek yükleme sistemi başlatılıyor...');
                
                // Backend'e gelişmiş yedek yükleme isteği gönder
                const response = await fetch(`${API_BASE}/api/yedek-yukle-gelismis`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Gelişmiş yedek yükleme sistemi ile veriler yüklendi:', result.data);
                    showNotification(`✅ Yedek veriler yüklendi: ${result.data.insertedCount} yeni, ${result.data.updatedCount} güncellendi, ${result.data.skippedCount} atlandı`, 'success');
                    
                    // Fresh data al
                    await tumVerileriYukle();
                    
                    syncNotificationShown = true;
                    return true;
                } else {
                    throw new Error(result.error || 'Gelişmiş yedek yükleme sistemi başarısız');
                }
                
            } catch (error) {
                console.error('❌ Gelişmiş yedek yükleme sistemi hatası:', error);
                showNotification('Gelişmiş yedek yükleme sistemi hatası: ' + error.message, 'error');
                return false;
            }
        }
        // Eski yedekleme sistemi - Yedek verilerden yükleme
        async function yedekVerileriYukleEski() {
            try {
                console.log('🔄 Eski yedekleme sistemi ile veriler yükleniyor...');
                
                // Backend'e eski yedekleme sistemi isteği gönder
                const response = await fetch(`${API_BASE}/api/yedek-yukle-eski`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Eski yedekleme sistemi ile veriler yüklendi:', result.data);
                    showNotification(`✅ Eski yedekleme sistemi ile veriler yüklendi: ${result.data.insertedCount} yeni, ${result.data.updatedCount} güncellendi`, 'success');
                    
                    // Fresh data al
                    await tumVerileriYukle();
                    
                    syncNotificationShown = true;
                    return true;
                } else {
                    throw new Error(result.error || 'Eski yedekleme sistemi başarısız');
                }
                
            } catch (error) {
                console.error('❌ Eski yedekleme sistemi hatası:', error);
                showNotification('Eski yedekleme sistemi hatası: ' + error.message, 'error');
                return false;
            }
        }
        // Yedek verileri yükle - ESKİ SİSTEME DÖNÜŞ
        async function yedekVerileriYukle() {
            try {
                console.log('🔄 Yedek veriler yükleniyor...');
                
                // LocalStorage'dan yedek verileri al
                const savedData = localStorage.getItem('saban_data');
                if (!savedData) {
                    showNotification('⚠️ Yedek veri bulunamadı', 'warning');
                    return false;
                }
                
                const yedekData = JSON.parse(savedData);
                
                // Backend'e yedek verileri gönder
                const response = await fetch(`${API_BASE}/api/yedek-yukle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ yedekData })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Yedek veriler başarıyla yüklendi:', result.data);
                    showNotification(`✅ Yedek veriler yüklendi: ${result.data.insertedCount} yeni, ${result.data.updatedCount} güncellendi`, 'success');
                    
                    // Fresh data al
                    await tumVerileriYukle();
                    
                    syncNotificationShown = true;
                    return true;
                } else {
                    throw new Error(result.error || 'Yedek yükleme başarısız');
                }
                
            } catch (error) {
                console.error('❌ Yedek yükleme hatası:', error);
                showNotification('Yedek yükleme hatası: ' + error.message, 'error');
                return false;
            }
        }
        
        // Toplu senkronizasyon (sadece büyük operasyonlar için)
        async function topluSenkronizasyon() {
            try {
                console.log('🔄 Toplu senkronizasyon başlıyor...');
                
                const response = await fetch(`${API_BASE}/api/tum-veriler`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        stokListesi,
                        satisGecmisi,
                        musteriler,
                        borclarim
                    })
                });
                
                // Check if response is OK
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Server error response:', errorText);
                    
                    // Check if response is HTML (error page)
                    if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
                        throw new Error('Server HTML hata sayfası döndürdü. Endpoint mevcut değil olabilir.');
                    }
                    
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Check content type
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const errorText = await response.text();
                    console.error('❌ Non-JSON response:', errorText);
                    throw new Error('Server JSON yanıtı döndürmedi');
                }
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Toplu senkronizasyon tamamlandı');
                    guncellenenVerileriKaydet();
                    lastSyncTime = Date.now();
                    // showNotification('Veriler senkronize edildi', 'success');
                } else {
                    throw new Error(result.message || result.error || 'Bilinmeyen hata');
                }
                
            } catch (error) {
                console.error('❌ Toplu senkronizasyon hatası:', error);
                showNotification('Senkronizasyon hatası: ' + error.message, 'error');
            }
        }
        
        // Eski saveData fonksiyonu (backward compatibility)
        async function saveData() {
            guncellenenVerileriKaydet();
        }
        
        // Verileri dosyaya kaydet
        function saveDataToFile() {
            const data = {
                stokListesi,
                satisGecmisi,
                musteriler,
                borclarim,
                version: '1.0',
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `sabancioglu_backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        // Bildirim göster
        function showNotification(message, type = 'info') {
            const notification = document.getElementById('notification');
            const text = document.getElementById('notificationText');
            
            notification.className = 'notification';
            text.textContent = message;
            
            // Tip'e göre sınıf ekle
            if (type === 'success') {
                notification.classList.add('success');
            } else if (type === 'error') {
                notification.classList.add('error');
            } else if (type === 'warning') {
                notification.classList.add('warning');
            }
            
            // Bildirimi göster
            notification.classList.add('show');
            
            // 5 dakika sonra gizle
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
        
        // İstatistikleri güncelle
        function guncelleIstatistikler() {
            const urunSayisi = Object.keys(stokListesi).length;
            document.getElementById('totalProducts').textContent = urunSayisi;
            
            let toplamDeger = 0;
            let dusukStok = 0;
            
            for (const [barkod, urun] of Object.entries(stokListesi)) {
                // Alış fiyatı ile stok değerini hesapla
                const miktar = urun.stok_miktari || urun.miktar || 0;
                toplamDeger += miktar * (urun.alisFiyati || 0);
                
                if (miktar === 1) {
                    dusukStok++;
                }
            }
            
            document.getElementById('totalValue').textContent = toplamDeger.toFixed(2) + ' ₺';
            document.getElementById('lowStock').textContent = dusukStok;
            
            // Satış istatistiklerini güncelle
            updateSalesSummary(satisGecmisi);
        }
        
        // Satış özetini güncelle
        function updateSalesSummary(salesArray) {
            let cashTotal = 0;
            let creditTotal = 0;
            let toplamKarZarar = 0;
            
            if (salesArray && salesArray.length > 0) {
                salesArray.forEach(satis => {
                    // Tüm satışları dahil et
                    
                    // Toplam hesaplama - öncelik: kayıtlı toplam > hesaplanan toplam
                    const kayitliToplam = parseFloat(satis.toplam) || 0;
                    const hesaplananToplam = (parseFloat(satis.fiyat) || 0) * (parseInt(satis.miktar) || 0);
                    const toplam = kayitliToplam > 0 ? kayitliToplam : hesaplananToplam;
                    
                    if (satis.borc) {
                        creditTotal += toplam;
                    } else {
                        cashTotal += toplam;
                    }
                    
                    // Kar/zarar hesaplama
                    const alisFiyati = parseFloat(satis.alisFiyati) || 0;
                    const satisFiyati = parseFloat(satis.fiyat) || 0;
                    const miktar = parseInt(satis.miktar) || 0;
                    
                    if (alisFiyati > 0 && satisFiyati > 0 && miktar > 0) {
                        toplamKarZarar += (satisFiyati - alisFiyati) * miktar;
                    }
                });
            }
            
            const totalSales = cashTotal + creditTotal;
            
            document.getElementById('cashSalesTotal').textContent = cashTotal.toFixed(2) + ' ₺';
            document.getElementById('creditSalesTotal').textContent = creditTotal.toFixed(2) + ' ₺';
            document.getElementById('totalSales').textContent = totalSales.toFixed(2) + ' ₺';
            document.getElementById('profitSummary').textContent = toplamKarZarar.toFixed(2) + ' ₺';
        }
        
        // Stok listesini tabloya yazdır
        function stokTablosunuGuncelle() {
            const tbody = document.querySelector('#stokTablosu tbody');
            const cardView = document.getElementById('card-view');
            
            tbody.innerHTML = '';
            cardView.innerHTML = '';
            
            // Sıralama yap
            const sortedProducts = Object.entries(stokListesi);
            
            if (currentSort.column) {
                sortedProducts.sort((a, b) => {
                    let valueA, valueB;
                    
                    valueA = a[1][currentSort.column];
                    valueB = b[1][currentSort.column];
                    
                    // Null/undefined değerleri için varsayılan değerler
                    if (valueA === null || valueA === undefined) valueA = '';
                    if (valueB === null || valueB === undefined) valueB = '';
                    
                    // Sayısal sıralama için dönüşüm
                    if (currentSort.column === 'miktar' || currentSort.column === 'alisFiyati') {
                        valueA = parseFloat(valueA) || 0;
                        valueB = parseFloat(valueB) || 0;
                    } else if (typeof valueA === 'string') {
                        valueA = valueA.toLowerCase();
                        valueB = valueB ? valueB.toLowerCase() : '';
                    }
                    
                    if (valueA < valueB) return currentSort.direction === 'asc' ? -1 : 1;
                    if (valueA > valueB) return currentSort.direction === 'asc' ? 1 : -1;
                    return 0;
                });
            }
            
            let productFound = false;
            
            for (const [key, urun] of sortedProducts) {
                // Handle both old format (barkod only) and new format (composite key)
                let barkod = key;
                if (key.includes('_')) {
                    // New composite key format: barkod_marka_varyant_id
                    barkod = key.split('_')[0];
                }
                
                // Stok sıfır ise özel class ekle
                const stockZeroClass = (urun.stok_miktari || urun.miktar || 0) === 0 ? 'stock-zero' : '';
                
                // Tablo satırı oluştur
                const tr = document.createElement('tr');
                if (stockZeroClass) tr.classList.add(stockZeroClass);
                
                tr.innerHTML = `
                    <td class="barcode-cell tooltip">
                        <div class="barcode-container">
                            <span class="barcode-text">${urun.barkod || '-'}</span>
                            <button class="copy-btn" onclick="copyBarcode('${urun.barkod || ''}')" title="Barkodu Kopyala">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <span class="tooltiptext">Çift tıklayarak arama yapabilirsiniz</span>
                        <small style="display: block; font-size: 10px; color: #666; margin-top: 2px;">ID: ${urun.urun_id || urun.id || 'N/A'}</small>
                    </td>
                    <td>
                        <span class="product-name-link" onclick="showProductDetails('${key}')">
                            ${urun.urun_adi || urun.ad || urun.urunAdi || 'Ürün ' + (urun.barkod || '')}
                        </span>
                    </td>
                    <td>${urun.marka || '-'}</td>
                    <td>${urun.stok_miktari || urun.miktar || 0}${(urun.stok_miktari || urun.miktar || 0) === 0 ? ' <span class="stock-zero-badge">STOK BİTTİ</span>' : ''}</td>
                    <td>${urun.alisFiyati ? parseFloat(urun.alisFiyati).toFixed(2) : '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn btn-sell" title="Sat" onclick="urunSat('${key}')" ${(urun.stok_miktari || urun.miktar || 0) === 0 ? 'disabled style="opacity:0.5;"' : ''}>
                                <i class="fas fa-cash-register"></i>
                            </button>
                            <button class="action-btn btn-print" title="Barkod Bas" onclick="barkodBas('${urun.barkod}')">
                                <i class="fas fa-barcode"></i>
                            </button>
                            <button class="action-btn btn-edit" title="Düzenle" onclick="urunDuzenle('${key}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn btn-delete" title="Sil" onclick="urunSil('${key}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
                
                // Kart görünümü oluştur
                const card = document.createElement('div');
                card.className = `product-card ${stockZeroClass}`;
                
                card.innerHTML = `
                    <div class="product-header">
                        <h3 class="tooltip">
                            <span class="product-name-link" onclick="showProductDetails('${key}')">
                                ${urun.urun_adi || urun.ad || urun.urunAdi || 'Ürün ' + (urun.barkod || '')}
                            </span>
                        </h3>
                        <div class="barcode-container">
                            <span class="barcode-text">${urun.barkod || '-'}</span>
                            <button class="copy-btn" onclick="copyBarcode('${urun.barkod || ''}')" title="Barkodu Kopyala">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        ${urun.marka ? `<p style="font-size: 12px; color: #888;">${urun.marka}</p>` : ''}
                    </div>
                    <div class="product-body">
                        <div class="product-info">
                            <p><strong>Marka:</strong> ${urun.marka || '-'}</p>
                            <p><strong>Stok:</strong> ${urun.stok_miktari || urun.miktar || 0}${(urun.stok_miktari || urun.miktar || 0) === 0 ? ' <span class="stock-zero-badge">STOK BİTTİ</span>' : ''}</p>
                            <p><strong>Alış Fiyatı:</strong> ${urun.alisFiyati ? urun.alisFiyati.toFixed(2) : '-'} ₺</p>
                        </div>
                    </div>
                    <div class="product-footer">
                        <div class="action-buttons">
                            <button class="action-btn btn-sell" title="Sat" onclick="urunSat('${key}')" ${(urun.stok_miktari || urun.miktar || 0) === 0 ? 'disabled style="opacity:0.5;"' : ''}>
                                <i class="fas fa-cash-register"></i>
                            </button>
                            <button class="action-btn btn-print" title="Barkod Bas" onclick="barkodBas('${urun.barkod}')">
                                <i class="fas fa-barcode"></i>
                            </button>
                            <button class="action-btn btn-edit" title="Düzenle" onclick="urunDuzenle('${key}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn btn-delete" title="Sil" onclick="urunSil('${key}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                cardView.appendChild(card);
                productFound = true;
            }
            
            // Ürün bulunamadıysa mesaj göster
            const noProductMessage = document.getElementById('noProductMessage');
            if (!productFound) {
                noProductMessage.style.display = 'block';
            } else {
                noProductMessage.style.display = 'none';
            }
            
            // Double-click için olay dinleyicileri ekle
            addBarcodeDoubleClick();
            
            guncelleIstatistikler();
        }
        
        // Barkod hücrelerine double-click event ekle
        function addBarcodeDoubleClick() {
            const barcodeCells = document.querySelectorAll('.barcode-cell');
            
            barcodeCells.forEach(cell => {
                cell.addEventListener('dblclick', function(e) {
                    e.preventDefault();
                    const barkod = this.querySelector('.barcode-text').textContent.trim();
                    
                    Swal.fire({
                        title: 'Barkod İşlemleri',
                        text: `"${barkod}" barkodlu ürün için işlem seçin:`,
                        icon: 'info',
                        showCancelButton: true,
                        showDenyButton: true,
                        showCloseButton: true,
                        confirmButtonText: 'Aynı Barkodlu Ürünleri Ara',
                        denyButtonText: 'Atilgan\'da Ara',
                        cancelButtonText: 'Prensoto\'da Ara',
                        customClass: {
                            actions: 'swal2-actions-wide'
                        }
                    }).then(result => {
                        if (result.isConfirmed) {
                            searchProductsByBarcode(barkod);
                        } else if (result.isDenied) {
                            searchAtilganWithBarcode(barkod);
                        } else if (result.dismiss === Swal.DismissReason.cancel) {
                            searchPrensotoWithBarcode(barkod);
                        } else if (result.dismiss === Swal.DismissReason.close) {
                            searchBasbugWithBarcode(barkod);
                        }
                    });
                });
            });
        }
        
        // Ürün detaylarını göster (birleştirilmiş ve güvenli)
        function showProductDetails(barkodOrKey) {
            let product = null;
            // Doğrudan key ile
            if (stokListesi[barkodOrKey]) {
                product = stokListesi[barkodOrKey];
            } else {
                // Barkod ile tara
                for (const [, urun] of Object.entries(stokListesi)) {
                    if (urun.barkod === barkodOrKey) { product = urun; break; }
                }
            }
            if (!product) {
                Swal.fire('Hata', 'Ürün bulunamadı!', 'error');
                return;
            }
            // Alan normalizasyonu
            const urunAdi = product.urun_adi || product.ad || product.urunAdi || `Ürün ${product.barkod || ''}`;
            const marka = product.marka || '';
            const aciklama = product.aciklama || '';
            const miktar = product.stok_miktari ?? product.miktar ?? 0;
            const alis = parseFloat(product.alisFiyati) || 0;
            const satis = parseFloat(product.satisFiyati || product.fiyat) || 0;
            const kategori = product.kategori || '';
            const eklenme = product.eklenmeTarihi || product.created_at || '';
            const guncelleme = product.guncellemeTarihi || product.updated_at || '';
            
            // Modern modal içerik
            Swal.fire({
                width: 700,
                title: 'Ürün Detayları',
                html: `
                    <div style="text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div>
                            <div style="font-size:12px;color:#666;">Ürün Adı</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${urunAdi}
                                <button onclick="copyText('${urunAdi}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;">Barkod</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${product.barkod || '-'}
                                <button onclick="copyText('${product.barkod || ''}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;">Marka</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${marka || '-'}
                                <button onclick="copyText('${marka || ''}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;">Kategori</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${kategori || '-'}
                                <button onclick="copyText('${kategori || ''}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;">Stok</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${miktar}
                                <button onclick="copyText('${miktar}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;">Alış / Satış</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${alis.toFixed(2)} ₺ / ${satis.toFixed(2)} ₺
                                <button onclick="copyText('${alis.toFixed(2)} ₺ / ${satis.toFixed(2)} ₺')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div style="grid-column:1 / -1;">
                            <div style="font-size:12px;color:#666;">Açıklama</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;white-space:pre-wrap;">
                                ${aciklama || '-'}
                                <button onclick="copyText('${(aciklama || '').replace(/'/g, "\\'")}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;">Eklenme</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${eklenme ? new Date(eklenme).toLocaleString('tr-TR') : '-'}
                                <button onclick="copyText('${eklenme ? new Date(eklenme).toLocaleString('tr-TR') : ''}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;">Güncelleme</div>
                            <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                                ${guncelleme ? new Date(guncelleme).toLocaleString('tr-TR') : '-'}
                                <button onclick="copyText('${guncelleme ? new Date(guncelleme).toLocaleString('tr-TR') : ''}')" style="background:none;border:none;color:#007bff;cursor:pointer;" title="Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div style="grid-column:1 / -1;text-align:center;margin-top:10px;">
                            <button onclick="copyAllProductData('${JSON.stringify(product).replace(/'/g, "\\'")}', '${urunAdi}')" style="background:#28a745;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;" title="Tüm Ürün Bilgilerini Kopyala">
                                <i class="fas fa-copy"></i> Tüm Bilgileri Kopyala
                            </button>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Kapat'
            });
        }

        // Metni kopyala
        function copyText(text) {
            if (!text) {
                showNotification('Kopyalanacak metin bulunamadı', 'warning');
                return;
            }
            
            navigator.clipboard.writeText(text).then(() => {
                showNotification('📋 Kopyalandı: ' + text.substring(0, 30) + (text.length > 30 ? '...' : ''), 'success');
            }).catch(err => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showNotification('📋 Kopyalandı: ' + text.substring(0, 30) + (text.length > 30 ? '...' : ''), 'success');
            });
        }

        // Tüm ürün bilgilerini kopyala
        function copyAllProductData(productJson, productName) {
            try {
                const product = JSON.parse(productJson);
                const formattedData = `
ÜRÜN BİLGİLERİ
==============
Ürün Adı: ${product.urun_adi || product.ad || productName || 'N/A'}
Barkod: ${product.barkod || 'N/A'}
Marka: ${product.marka || 'N/A'}
Kategori: ${product.kategori || 'N/A'}
Stok Miktarı: ${product.stok_miktari || product.miktar || 0}
Alış Fiyatı: ${parseFloat(product.alisFiyati || 0).toFixed(2)} ₺
Satış Fiyatı: ${parseFloat(product.satisFiyati || product.fiyat || 0).toFixed(2)} ₺
Açıklama: ${product.aciklama || 'N/A'}
Eklenme Tarihi: ${product.created_at ? new Date(product.created_at).toLocaleString('tr-TR') : 'N/A'}
Güncelleme Tarihi: ${product.updated_at ? new Date(product.updated_at).toLocaleString('tr-TR') : 'N/A'}
Ürün ID: ${product.urun_id || product.id || 'N/A'}
                `.trim();
                
                copyText(formattedData);
            } catch (error) {
                showNotification('❌ Ürün bilgileri kopyalanamadı', 'error');
                console.error('Copy error:', error);
            }
        }

        // Kategori modal'ını aç
        function openCategoryModal() {
            document.getElementById('mainMenuDropdown').classList.remove('show');
            
            Swal.fire({
                title: '🏷️ Gelişmiş Kategori Yönetimi',
                html: `
                    <div style="text-align: left; max-height: 600px; overflow-y: auto;">
                        <div style="margin-bottom: 25px; padding: 15px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(34, 197, 94, 0.1)); border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <h4 style="margin-bottom: 10px; color: #3b82f6; display: flex; align-items: center; gap: 8px;"><i class="fas fa-robot"></i> Akıllı Kategorizasyon</h4>
                            <p style="margin-bottom: 15px; color: #666; font-size: 14px;">Ürün adlarına göre otomatik kategori atama sistemi</p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <button class="btn btn-primary" onclick="autoCategorizeProducts()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="fas fa-magic"></i> Kategorize Et
                                </button>
                                <button class="btn btn-info" onclick="previewCategorization()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="fas fa-eye"></i> Önizleme
                                </button>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 25px; padding: 15px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(168, 85, 247, 0.1)); border-radius: 10px; border: 1px solid rgba(34, 197, 94, 0.2);">
                            <h4 style="margin-bottom: 10px; color: #22c55e; display: flex; align-items: center; gap: 8px;"><i class="fas fa-filter"></i> Filtreleme & Arama</h4>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <select id="categoryFilter" onchange="filterByCategory(this.value)" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
                                    <option value="">🔍 Tüm Kategoriler Göster</option>
                                </select>
                                <button class="btn btn-outline" onclick="clearCategoryFilter()" style="min-width: 80px;">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div style="background: rgba(255,255,255,0.5); padding: 8px; border-radius: 4px; font-size: 12px; color: #666;">
                                <span id="filteredCount">0</span> ürün gösteriliyor • <span id="categoryCount">0</span> farklı kategori
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 25px; padding: 15px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(239, 68, 68, 0.1)); border-radius: 10px; border: 1px solid rgba(245, 158, 11, 0.2);">
                            <h4 style="margin-bottom: 10px; color: #f59e0b; display: flex; align-items: center; gap: 8px;"><i class="fas fa-plus-circle"></i> Özel Kategori Kuralı</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                <input type="text" id="customKeyword" placeholder="Anahtar kelime (örn: fren)" style="padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
                                <input type="text" id="customCategory" placeholder="Kategori adı" style="padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
                            </div>
                            <button class="btn btn-success" onclick="addCustomCategory()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i class="fas fa-plus"></i> Kural Ekle ve Uygula
                            </button>
                        </div>

                        <div style="padding: 15px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(168, 85, 247, 0.1)); border-radius: 10px; border: 1px solid rgba(239, 68, 68, 0.2);">
                            <h4 style="margin-bottom: 15px; color: #ef4444; display: flex; align-items: center; gap: 8px;"><i class="fas fa-tools"></i> Gelişmiş Araçlar</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                                <button class="btn btn-warning" onclick="resetAllCategories()" style="display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px;">
                                    <i class="fas fa-undo"></i> Sıfırla
                                </button>
                                <button class="btn btn-info" onclick="exportCategorizedData()" style="display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px;">
                                    <i class="fas fa-download"></i> İndir
                                </button>
                                <button class="btn btn-secondary" onclick="showCategoryStats()" style="display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px;">
                                    <i class="fas fa-chart-bar"></i> İstatistik
                                </button>
                            </div>
                        </div>
                    </div>
                `,
                width: 700,
                showConfirmButton: false,
                showCloseButton: true,
                customClass: {
                    popup: 'enhanced-category-modal'
                },
                didOpen: () => {
                    loadCategoryFilter();
                    updateCategoryStats();
                }
            });
        }

        // Toplu satış modal'ını aç
        function openBulkSaleModal() {
            document.getElementById('mainMenuDropdown').classList.remove('show');
            
            Swal.fire({
                title: '🛒 Toplu Satış',
                html: `
                    <div style="text-align: left;">
                        <div style="margin-bottom: 15px;">
                            <h4>Satış Sepeti</h4>
                            <div id="bulkSaleCart" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin-bottom: 10px;">
                                <p style="text-align: center; color: #666;">Sepet boş</p>
                            </div>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="text" id="bulkSaleBarkod" placeholder="Barkod" style="flex: 2;">
                                <input type="number" id="bulkSaleMiktar" placeholder="Miktar" min="1" value="1" style="flex: 1;">
                                <input type="number" id="bulkSaleFiyat" placeholder="Fiyat" step="0.01" style="flex: 1;">
                                <button class="btn btn-sm btn-primary" onclick="addToBulkCart()">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <h4>Müşteri Bilgileri (Opsiyonel)</h4>
                            <select id="bulkSaleCustomer" style="width: 100%;">
                                <option value="">Müşteri Seçin</option>
                            </select>
                        </div>
                        
                        <div style="text-align: center;">
                            <div id="bulkSaleTotal" style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">
                                Toplam: 0.00 ₺
                            </div>
                            <button class="btn btn-success" onclick="completeBulkSale()" id="completeBulkSaleBtn" disabled>
                                <i class="fas fa-check"></i> Satışı Tamamla
                            </button>
                            <button class="btn btn-danger" onclick="clearBulkCart()" style="margin-left: 10px;">
                                <i class="fas fa-trash"></i> Sepeti Temizle
                            </button>
                        </div>
                    </div>
                `,
                width: 600,
                showConfirmButton: false,
                showCloseButton: true,
                didOpen: () => {
                    loadCustomersForBulkSale();
                }
            });
        }

        // Kategori filtresini yükle
        async function loadCategoryFilter() {
            try {
                const response = await fetch(`${API_BASE}/api/categories`);
                const result = await response.json();
                
                if (result.success) {
                    const select = document.getElementById('categoryFilter');
                    result.categories.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat.kategori;
                        option.textContent = `${cat.kategori} (${cat.count})`;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Kategori yükleme hatası:', error);
            }
        }

        // Otomatik kategorizasyon
        async function autoCategorizeProducts() {
            try {
                const categoryMappings = {
                    'amortisör': 'Amortisör',
                    'amortisor': 'Amortisör',
                    'fren': 'Fren Sistemi',
                    'balata': 'Fren Sistemi',
                    'disk': 'Fren Sistemi',
                    'far': 'Kaporta',
                    'stop': 'Kaporta',
                    'ayna': 'Kaporta',
                    'panjur': 'Kaporta',
                    'tampon': 'Kaporta',
                    'motor': 'Motor Parçaları',
                    'yağ': 'Motor Parçaları',
                    'filtre': 'Motor Parçaları',
                    'krank': 'Motor Parçaları',
                    'gömlek': 'Motor Parçaları'
                };

                showNotification('🔄 Otomatik kategorizasyon başlatılıyor...', 'info');
                
                const response = await fetch(`${API_BASE}/api/categorize-products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoryMappings })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(`✅ ${result.updatedCount} ürün kategorize edildi!`, 'success');
                    stokListesiniGetir(); // Listeyi yenile
                } else {
                    showNotification('❌ Kategorizasyon başarısız: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('❌ Kategorizasyon hatası: ' + error.message, 'error');
            }
        }

        // Kategoriye göre filtrele
        function filterByCategory(category) {
            if (!category) {
                stokTablosunuGuncelle(); // Tüm ürünleri göster
                return;
            }
            
            const filteredProducts = Object.entries(stokListesi).filter(([key, product]) => 
                product.kategori === category
            );
            
            // Geçici olarak filtrelenmiş listeyi göster
            const originalList = { ...stokListesi };
            stokListesi = Object.fromEntries(filteredProducts);
            stokTablosunuGuncelle();
            stokListesi = originalList; // Orijinal listeyi geri yükle
        }

        // Gelişmiş kategori fonksiyonları
        async function previewCategorization() {
            const categoryMappings = {
                'amortisör': 'Amortisör',
                'amortisor': 'Amortisör',
                'fren': 'Fren Sistemi',
                'balata': 'Fren Sistemi',
                'disk': 'Fren Sistemi',
                'motor': 'Motor Parçaları',
                'yağ': 'Yağlar & Kimyasallar',
                'filtre': 'Filtreler',
                'lastik': 'Lastik & Jant',
                'jant': 'Lastik & Jant',
                'cam': 'Cam & Elektrik',
                'lamba': 'Cam & Elektrik',
                'elektrik': 'Cam & Elektrik',
                'debriyaj': 'Şanzıman',
                'şanzıman': 'Şanzıman',
                'gömlek': 'Motor Parçaları'
            };

            let previewResults = {};
            let totalMatches = 0;

            for (const [key, product] of Object.entries(stokListesi)) {
                const productName = product.ad || product.urun_adi || '';
                for (const [keyword, category] of Object.entries(categoryMappings)) {
                    if (productName.toLowerCase().includes(keyword.toLowerCase())) {
                        if (!previewResults[category]) previewResults[category] = [];
                        previewResults[category].push(productName);
                        totalMatches++;
                        break;
                    }
                }
            }

            const previewHTML = Object.entries(previewResults).map(([category, products]) => 
                `<div style="margin: 10px 0; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px;">
                    <strong style="color: #3b82f6;">${category} (${products.length} ürün)</strong>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        ${products.slice(0, 3).join(', ')}${products.length > 3 ? ` +${products.length - 3} daha...` : ''}
                    </div>
                </div>`
            ).join('');

            Swal.fire({
                title: '🔍 Kategorizasyon Önizlemesi',
                html: `
                    <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                        <div style="margin-bottom: 15px; text-align: center; background: #f8f9fa; padding: 10px; border-radius: 6px;">
                            <strong>Toplam ${totalMatches} ürün kategorize edilecek</strong>
                        </div>
                        ${previewHTML || '<p>Kategorize edilecek ürün bulunamadı.</p>'}
                    </div>
                `,
                width: 600,
                confirmButtonText: 'Uygula',
                cancelButtonText: 'İptal',
                showCancelButton: true
            }).then((result) => {
                if (result.isConfirmed) {
                    autoCategorizeProducts();
                }
            });
        }

        function updateCategoryStats() {
            const categories = {};
            let uncategorized = 0;

            for (const [key, product] of Object.entries(stokListesi)) {
                const category = product.kategori || '';
                if (category) {
                    categories[category] = (categories[category] || 0) + 1;
                } else {
                    uncategorized++;
                }
            }

            const categoryCountEl = document.getElementById('categoryCount');
            const filteredCountEl = document.getElementById('filteredCount');
            
            if (categoryCountEl) categoryCountEl.textContent = Object.keys(categories).length;
            if (filteredCountEl) filteredCountEl.textContent = Object.keys(stokListesi).length;
        }

        function clearCategoryFilter() {
            const filterSelect = document.getElementById('categoryFilter');
            if (filterSelect) {
                filterSelect.value = '';
                filterByCategory('');
            }
        }

        async function resetAllCategories() {
            const result = await Swal.fire({
                title: '⚠️ Tüm Kategorileri Sıfırla',
                text: 'Bu işlem tüm ürünlerin kategorilerini siler. Emin misiniz?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Evet, Sıfırla',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#ef4444'
            });

            if (result.isConfirmed) {
                try {
                    // Local olarak kategorileri sıfırla
                    for (const key in stokListesi) {
                        stokListesi[key].kategori = '';
                    }
                    
                    showNotification('✅ Tüm kategoriler sıfırlandı', 'success');
                    stokListesiniGetir();
                    loadCategoryFilter();
                    updateCategoryStats();
                } catch (error) {
                    console.error('Kategori sıfırlama hatası:', error);
                    showNotification('❌ Kategori sıfırlanırken hata oluştu', 'error');
                }
            }
        }

        function exportCategorizedData() {
            const categorizedData = {};
            
            for (const [key, product] of Object.entries(stokListesi)) {
                const category = product.kategori || 'Kategorisiz';
                if (!categorizedData[category]) categorizedData[category] = [];
                categorizedData[category].push({
                    barkod: product.barkod,
                    ad: product.ad || product.urun_adi,
                    marka: product.marka,
                    miktar: product.miktar || product.stok_miktari,
                    fiyat: product.satisFiyati || product.fiyat
                });
            }

            const dataStr = JSON.stringify(categorizedData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `kategorili_urunler_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            showNotification('📥 Kategorili veriler indirildi', 'success');
        }

        function showCategoryStats() {
            const categories = {};
            let uncategorized = 0;
            let totalValue = 0;

            for (const [key, product] of Object.entries(stokListesi)) {
                const category = product.kategori || 'Kategorisiz';
                const quantity = product.miktar || product.stok_miktari || 0;
                const price = product.satisFiyati || product.fiyat || 0;
                const value = quantity * price;

                if (!categories[category]) {
                    categories[category] = { count: 0, value: 0, quantity: 0 };
                }
                categories[category].count++;
                categories[category].value += value;
                categories[category].quantity += quantity;
                totalValue += value;
                
                if (!product.kategori) uncategorized++;
            }

            const statsHTML = Object.entries(categories)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([category, stats]) => 
                    `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px; font-weight: 500;">${category}</td>
                        <td style="padding: 8px; text-align: center;">${stats.count}</td>
                        <td style="padding: 8px; text-align: center;">${stats.quantity}</td>
                        <td style="padding: 8px; text-align: right;">${stats.value.toFixed(2)} ₺</td>
                    </tr>`
                ).join('');

            Swal.fire({
                title: '📊 Kategori İstatistikleri',
                html: `
                    <div style="text-align: left;">
                        <div style="margin-bottom: 15px; background: #f8f9fa; padding: 10px; border-radius: 6px;">
                            <strong>Özet:</strong> ${Object.keys(categories).length} kategori, ${uncategorized} kategorisiz ürün
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="padding: 10px; text-align: left;">Kategori</th>
                                    <th style="padding: 10px; text-align: center;">Ürün</th>
                                    <th style="padding: 10px; text-align: center;">Stok</th>
                                    <th style="padding: 10px; text-align: right;">Değer</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${statsHTML}
                            </tbody>
                        </table>
                    </div>
                `,
                width: 700,
                showCloseButton: true,
                showConfirmButton: false
            });
        }

        // Özel kategori ekle
        async function addCustomCategory() {
            const keyword = document.getElementById('customKeyword').value.trim();
            const category = document.getElementById('customCategory').value.trim();
            
            if (!keyword || !category) {
                showNotification('❌ Kelime ve kategori adı gerekli', 'error');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/api/categorize-products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoryMappings: { [keyword]: category } })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(`✅ "${keyword}" kelimesi için "${category}" kategorisi eklendi (${result.updatedCount} ürün)`, 'success');
                    document.getElementById('customKeyword').value = '';
                    document.getElementById('customCategory').value = '';
                    stokListesiniGetir(); // Listeyi yenile
                } else {
                    showNotification('❌ Kategori ekleme başarısız: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('❌ Kategori ekleme hatası: ' + error.message, 'error');
            }
        }

        // Toplu satış sepeti
        let bulkSaleCart = [];

        // Müşterileri toplu satış için yükle
        async function loadCustomersForBulkSale() {
            try {
                const response = await fetch(`${API_BASE}/api/musteri-kontrol`);
                const result = await response.json();
                
                if (result.success && result.data) {
                    const select = document.getElementById('bulkSaleCustomer');
                    result.data.forEach(customer => {
                        const option = document.createElement('option');
                        option.value = customer.id;
                        option.textContent = customer.ad;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Müşteri yükleme hatası:', error);
            }
        }

        // Toplu satış sepetine ürün ekle - Geliştirilmiş
        function addToBulkCart() {
            const barkod = document.getElementById('bulkSaleBarkod').value.trim();
            const miktar = parseInt(document.getElementById('bulkSaleMiktar').value) || 1;
            const fiyat = parseFloat(document.getElementById('bulkSaleFiyat').value) || 0;
            
            if (!barkod) {
                showNotification('❌ Barkod gerekli', 'error');
                return;
            }
            
            // Ürünü stokta kontrol et - Geliştirilmiş barkod arama
            let product = null;
            for (const [key, p] of Object.entries(stokListesi)) {
                if (p.barkod === barkod || key === barkod) {
                    product = p;
                    break;
                }
            }
            
            if (!product) {
                showNotification('❌ Ürün bulunamadı', 'error');
                return;
            }
            
            // Stok kontrolü - Geliştirilmiş
            const currentStock = product.stok_miktari || product.miktar || 0;
            if (currentStock < miktar) {
                showNotification(`❌ Yetersiz stok (Mevcut: ${currentStock})`, 'error');
                return;
            }
            
            // Sepete ekle - Aynı barkod kontrolü ile
            const existingIndex = bulkSaleCart.findIndex(item => item.barkod === barkod);
            if (existingIndex >= 0) {
                // Mevcut ürünün miktarını güncelle
                const newTotalMiktar = bulkSaleCart[existingIndex].miktar + miktar;
                
                // Stok kontrolü
                if (currentStock < newTotalMiktar) {
                    showNotification(`❌ Toplam miktar stoktan fazla! (Mevcut: ${currentStock}, İstenen: ${newTotalMiktar})`, 'error');
                    return;
                }
                
                bulkSaleCart[existingIndex].miktar = newTotalMiktar;
                bulkSaleCart[existingIndex].fiyat = fiyat || bulkSaleCart[existingIndex].fiyat;
                
                showNotification(`✅ ${product.urun_adi || product.ad} miktarı güncellendi: ${bulkSaleCart[existingIndex].miktar}`, 'success');
            } else {
                // Yeni ürün ekle
                bulkSaleCart.push({
                    barkod: barkod,
                    urunAdi: product.urun_adi || product.ad || 'Bilinmeyen Ürün',
                    miktar: miktar,
                    fiyat: fiyat || product.satisFiyati || 0,
                    alisFiyati: product.alisFiyati || 0,
                    stok_miktari: currentStock
                });
                
                showNotification(`✅ ${product.urun_adi || product.ad} sepete eklendi`, 'success');
            }
            
            // Formu temizle
            document.getElementById('bulkSaleBarkod').value = '';
            document.getElementById('bulkSaleMiktar').value = '1';
            document.getElementById('bulkSaleFiyat').value = '';
            
            updateBulkSaleCart();
        }

        // Toplu satış sepetini güncelle - Geliştirilmiş
        function updateBulkSaleCart() {
            const cartDiv = document.getElementById('bulkSaleCart');
            const totalDiv = document.getElementById('bulkSaleTotal');
            const completeBtn = document.getElementById('completeBulkSaleBtn');
            
            if (bulkSaleCart.length === 0) {
                cartDiv.innerHTML = '<p style="text-align: center; color: #666;">Sepet boş</p>';
                totalDiv.textContent = 'Toplam: 0.00 ₺';
                completeBtn.disabled = true;
                return;
            }
            
            let total = 0;
            let html = '';
            
            bulkSaleCart.forEach((item, index) => {
                const itemTotal = item.fiyat * item.miktar;
                total += itemTotal;
                
                // Stok durumu kontrolü
                const currentStock = item.stok_miktari || 0;
                const stockStatus = currentStock >= item.miktar ? '✅' : '⚠️';
                const stockColor = currentStock >= item.miktar ? '#27ae60' : '#f39c12';
                
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee; background: ${currentStock >= item.miktar ? '#f8f9fa' : '#fff3cd'};">
                        <div style="flex: 1;">
                            <strong>${item.urunAdi}</strong><br>
                            <small style="color: #666;">
                                ${item.barkod} - ${item.miktar}x ${item.fiyat.toFixed(2)}₺
                                <span style="color: ${stockColor}; margin-left: 8px;">
                                    ${stockStatus} Stok: ${currentStock}
                                </span>
                            </small>
                        </div>
                        <div style="text-align: right;">
                            <strong>${itemTotal.toFixed(2)}₺</strong><br>
                            <button onclick="removeFromBulkCart(${index})" style="background: none; border: none; color: red; margin-left: 10px; cursor: pointer;" title="Sepetten çıkar">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            cartDiv.innerHTML = html;
            totalDiv.textContent = `Toplam: ${total.toFixed(2)} ₺`;
            completeBtn.disabled = false;
            
            // Stok uyarısı
            const lowStockItems = bulkSaleCart.filter(item => (item.stok_miktari || 0) < item.miktar);
            if (lowStockItems.length > 0) {
                showNotification(`⚠️ ${lowStockItems.length} ürün için yetersiz stok!`, 'warning');
            }
        }

        // Sepetten ürün çıkar
        function removeFromBulkCart(index) {
            bulkSaleCart.splice(index, 1);
            updateBulkSaleCart();
        }

        // Sepeti temizle
        function clearBulkCart() {
            bulkSaleCart = [];
            updateBulkSaleCart();
        }

        // Toplu satışı tamamla - Geliştirilmiş
        async function completeBulkSale() {
            if (bulkSaleCart.length === 0) {
                showNotification('❌ Sepet boş', 'error');
                return;
            }
            
            // Stok kontrolü
            const insufficientStock = bulkSaleCart.filter(item => (item.stok_miktari || 0) < item.miktar);
            if (insufficientStock.length > 0) {
                const itemNames = insufficientStock.map(item => item.urunAdi).join(', ');
                Swal.fire('⚠️ Yetersiz Stok', `${itemNames} ürünleri için yetersiz stok bulunmaktadır.`, 'warning');
                return;
            }
            
            try {
                const customerSelect = document.getElementById('bulkSaleCustomer');
                const musteriId = customerSelect.value;
                const musteriAdi = customerSelect.selectedOptions[0]?.textContent;
                
                // Onay modalı
                const confirmResult = await Swal.fire({
                    title: 'Toplu Satış Onayı',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>${bulkSaleCart.length} ürün satılacak</strong></p>
                            <p>Toplam Tutar: <strong>${bulkSaleCart.reduce((sum, item) => sum + (item.fiyat * item.miktar), 0).toFixed(2)} ₺</strong></p>
                            ${musteriAdi ? `<p>Müşteri: <strong>${musteriAdi}</strong></p>` : ''}
                            <hr>
                            <p>Devam etmek istiyor musunuz?</p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Evet, Sat',
                    cancelButtonText: 'İptal',
                    confirmButtonColor: '#27ae60'
                });
                
                if (!confirmResult.isConfirmed) {
                    return;
                }
                
                showNotification('🔄 Toplu satış işleniyor...', 'info');
                
                // Her ürün için ayrı satış yap
                let successCount = 0;
                let totalAmount = 0;
                
                for (const item of bulkSaleCart) {
                    try {
                        // Ürünü bul
                        const product = Object.values(stokListesi).find(p => p.barkod === item.barkod);
                        if (!product) continue;
                        
                        // Satış verisi oluştur
                        const satis = {
                            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
                            tarih: new Date().toISOString(),
                            barkod: item.barkod,
                            urunAdi: item.urunAdi,
                            marka: product.marka || '',
                            miktar: item.miktar,
                            fiyat: item.fiyat,
                            alisFiyati: item.alisFiyati,
                            toplam: item.fiyat * item.miktar,
                            borc: false,
                            musteriId: musteriId,
                            aciklama: 'Toplu satış',
                            odemeTarihi: null
                        };
                        
                        // Backend'e kaydet
                        const response = await fetch(`${API_BASE}/api/satis-ekle`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(satis)
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Stok güncelle
                            product.stok_miktari = (product.stok_miktari || 0) - item.miktar;
                            if (product.miktar !== undefined) {
                                product.miktar = product.stok_miktari;
                            }
                            
                            // Satış geçmişine ekle
                            satisGecmisi.push(result.data || satis);
                            
                            successCount++;
                            totalAmount += satis.toplam;
                        }
                    } catch (error) {
                        console.error(`Ürün satış hatası (${item.urunAdi}):`, error);
                    }
                }
                
                if (successCount > 0) {
                    // UI güncelle
                    stokTablosunuGuncelle();
                    satisTablosunuGuncelle();
                    guncelleIstatistikler();
                    guncellenenVerileriKaydet();
                    
                    showNotification(`✅ ${successCount} ürün başarıyla satıldı! Toplam: ${totalAmount.toFixed(2)}₺`, 'success');
                    bulkSaleCart = [];
                    updateBulkSaleCart();
                    Swal.close();
                } else {
                    showNotification('❌ Hiçbir ürün satılamadı', 'error');
                }
                
            } catch (error) {
                showNotification('❌ Toplu satış hatası: ' + error.message, 'error');
                console.error('Toplu satış hatası:', error);
            }
        }
        
        // Satış geçmişini güncelle
        function satisTablosunuGuncelle() {
            const salesBody = document.getElementById('salesBody');
            salesBody.innerHTML = '';
            
            if (satisGecmisi && satisGecmisi.length > 0) {
                // Satış verilerini sırala
                let sortedSales = [...satisGecmisi];
                
                if (currentSalesSort.column) {
                    sortedSales.sort((a, b) => {
                        let valueA, valueB;
                        
                        switch(currentSalesSort.column) {
                            case 'tarih':
                                valueA = new Date(a.tarih);
                                valueB = new Date(b.tarih);
                                break;
                            case 'miktar':
                            case 'alisFiyati':
                            case 'fiyat':
                            case 'toplam':
                                valueA = parseFloat(a[currentSalesSort.column]) || 0;
                                valueB = parseFloat(b[currentSalesSort.column]) || 0;
                                break;
                            case 'borc':
                                valueA = a.borc ? 1 : 0;
                                valueB = b.borc ? 1 : 0;
                                break;
                            case 'musteriAdi':
                                // Müşteri adını bul
                                const musteriA = a.musteriId && musteriler[a.musteriId] ? musteriler[a.musteriId].ad : '';
                                const musteriB = b.musteriId && musteriler[b.musteriId] ? musteriler[b.musteriId].ad : '';
                                valueA = musteriA.toLowerCase();
                                valueB = musteriB.toLowerCase();
                                break;
                            default:
                                valueA = a[currentSalesSort.column] || '';
                                valueB = b[currentSalesSort.column] || '';
                                if (typeof valueA === 'string') {
                                    valueA = valueA.toLowerCase();
                                    valueB = valueB.toLowerCase();
                                }
                        }
                        
                        if (valueA < valueB) return currentSalesSort.direction === 'asc' ? -1 : 1;
                        if (valueA > valueB) return currentSalesSort.direction === 'asc' ? 1 : -1;
                        return 0;
                    });
                }
                sortedSales.forEach(satis => {
                    // Tüm satışları göster
                    
                    const tr = document.createElement('tr');
                    const tarih = new Date(satis.tarih);
                    const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()} ${tarih.getHours().toString().padStart(2, '0')}:${tarih.getMinutes().toString().padStart(2, '0')}`;
                    
                    // Müşteri adını bul
                    let musteriAdi = '-';
                    if (satis.musteriId && musteriler[satis.musteriId]) {
                        musteriAdi = musteriler[satis.musteriId].ad;
                    }
                    
                    // Güncel ürün adını bul (eğer ürün hala mevcutsa)
                    let currentProductName = satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'));
                    let barkodGoster = satis.barkod || '-';
                    
                    // Toplam hesaplama - öncelik: kayıtlı toplam > hesaplanan toplam
                    const fiyat = parseFloat(satis.fiyat) || 0;
                    const miktar = parseInt(satis.miktar) || 0;
                    const kayitliToplam = parseFloat(satis.toplam) || 0;
                    const hesaplananToplam = fiyat * miktar;
                    const toplam = kayitliToplam > 0 ? kayitliToplam : hesaplananToplam;
                    const alis = (parseFloat(satis.alisFiyati) || 0);
                    
                    tr.innerHTML = `
                        <td>${tarihStr}</td>
                        <td>${barkodGoster}</td>
                        <td title="Orijinal: ${satis.urunAdi}">${currentProductName}</td>
                        <td>${miktar}</td>
                        <td>${(parseFloat(satis.alisFiyati) || 0) > 0 ? (parseFloat(satis.alisFiyati)).toFixed(2) : '-'}</td>
                        <td>${(parseFloat(satis.fiyat) || 0).toFixed(2)}</td>
                        <td>${(parseFloat(satis.toplam) || ((parseFloat(satis.fiyat) || 0) * (parseInt(satis.miktar) || 0))).toFixed(2)}</td>
                        <td>${satis.borc ? '<span class="credit-indicator">Borç</span>' : 'Nakit'}</td>
                        <td>${musteriAdi}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-return" title="İade" onclick="urunIade('${satis.id}')">
                                    <i class="fas fa-undo"></i>
                                </button>
                                <button class="action-btn btn-edit" title="Düzenle" onclick="satisDuzenle('${satis.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn btn-delete" title="Sil" onclick="satisSil('${satis.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    
                    salesBody.appendChild(tr);
                });
            }
            
            updateSalesSummary(satisGecmisi);
        }
        
        // Müşteri tablosunu güncelle
        function musteriTablosunuGuncelle() {
            const musteriBody = document.getElementById('musteriBody');
            musteriBody.innerHTML = '';
            
            // Müşterileri sırala
            const sortedCustomers = Object.entries(musteriler);
            
            if (currentCustomerSort.column) {
                sortedCustomers.sort((a, b) => {
                    let valueA, valueB;
                    
                    valueA = a[1][currentCustomerSort.column] || '';
                    valueB = b[1][currentCustomerSort.column] || '';
                    
                    if (typeof valueA === 'string') {
                        valueA = valueA.toLowerCase();
                        valueB = valueB.toLowerCase();
                    }
                    
                    if (valueA < valueB) return currentCustomerSort.direction === 'asc' ? -1 : 1;
                    if (valueA > valueB) return currentCustomerSort.direction === 'asc' ? 1 : -1;
                    return 0;
                });
            }
            
            for (const [id, musteri] of sortedCustomers) {
                // Müşterinin toplam borcunu hesapla
                let toplamBorc = 0;
                
                if (satisGecmisi && satisGecmisi.length > 0) {
                    satisGecmisi.forEach(satis => {
                        if (satis.musteriId === id && satis.borc) {
                            const satisToplam = parseFloat(satis.toplam) || 0;
                            if (!isNaN(satisToplam) && satisToplam > 0) {
                                toplamBorc += satisToplam;
                            }
                        }
                    });
                }
                
                // Müşterinin satın aldığı ürünleri listele
                let satinAlinanUrunler = [];
                
                if (satisGecmisi && satisGecmisi.length > 0) {
                    const productMap = new Map();
                    satisGecmisi.forEach(satis => {
                        if (satis.musteriId === id) {
                            const currentProductName = satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'));
                            const key = `${satis.barkod}__${currentProductName}`;
                            const prev = productMap.get(key) || 0;
                            productMap.set(key, prev + (parseInt(satis.miktar) || 0));
                        }
                    });
                    satinAlinanUrunler = Array.from(productMap.entries()).map(([key, qty]) => {
                        const name = key.split('__')[1];
                        return `${name} (${qty} adet)`;
                    });
                }
                
                // Sadece ilk 3 ürünü göster
                let urunListesi = satinAlinanUrunler.slice(0, 3).join(', ');
                if (satinAlinanUrunler.length > 3) {
                    urunListesi += ` +${satinAlinanUrunler.length - 3} daha`;
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td onclick="showCustomerDetails('${id}')" style="cursor: pointer; color: var(--primary); font-weight: 500;">${musteri.ad}</td>
                    <td>${musteri.telefon || '-'}</td>
                    <td>${(toplamBorc || 0).toFixed(2)}</td>
                    <td>${urunListesi || '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn btn-info" title="Satış Geçmişi" onclick="showCustomerSales('${id}')">
                                <i class="fas fa-history"></i>
                            </button>
                            <button class="action-btn btn-edit" title="Düzenle" onclick="musteriDuzenle('${id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn btn-delete" title="Sil" onclick="musteriSil('${id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                musteriBody.appendChild(tr);
            }
        }
        
        // Borç tablosunu güncelle
        function borcTablosunuGuncelle() {
            const borcBody = document.getElementById('borcBody');
            borcBody.innerHTML = '';
            
            for (const [id, borc] of Object.entries(borclarim)) {
                const tr = document.createElement('tr');
                tr.classList.add('my-debt-item');
                
                tr.innerHTML = `
                    <td>${borc.alacakli || '-'}</td>
                    <td>${(borc.miktar || 0).toFixed(2)}</td>
                    <td>${borc.tarih || '-'}</td>
                    <td>${borc.odemeTarihi || '-'}</td>
                    <td>${borc.durum || 'Ödenmedi'}</td>
                    <td>${borc.aciklama || '-'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn btn-edit" title="Düzenle" onclick="borcDuzenle('${id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn btn-pay" title="Ödeme Yap" onclick="borcOdeme('${id}')" style="background: #28a745;">
                                <i class="fas fa-money-bill-wave"></i>
                            </button>
                            <button class="action-btn btn-delete" title="Sil" onclick="borcSil('${id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                borcBody.appendChild(tr);
            }
        }
        // Müşteri ekle
        async function musteriEkle() {
            // Devam eden işlemi kaydet
            savePendingOperation('musteri_ekleme', {
                ad: document.getElementById('musteriAdi').value.trim(),
                telefon: document.getElementById('musteriTelefon').value.trim(),
                adres: document.getElementById('musteriAdres').value.trim(),
                aciklama: document.getElementById('musteriAciklama').value.trim()
            });
            
            const ad = document.getElementById('musteriAdi').value.trim();
            const telefon = document.getElementById('musteriTelefon').value.trim();
            const adres = document.getElementById('musteriAdres').value.trim();
            const aciklama = document.getElementById('musteriAciklama').value.trim();
            if (!ad) {
                clearPendingOperation(); // Hata durumunda işlemi temizle
                Swal.fire('Hata', 'Müşteri adı zorunludur.', 'error');
                return;
            }
            let id;
            const isEditing = editingMode && editingMusteriId;
            if (isEditing) {
                id = editingMusteriId;
            } else {
                id = 'musteri_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
            }
            
            const musteriData = {
                id: id,
                ad: ad,
                telefon: telefon || null,
                adres: adres || null,
                aciklama: aciklama || null,
                bakiye: 0
            };
            
            try {
                // Backend'e kaydet
                const response = await fetch(`${API_BASE}/api/musteri-ekle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(musteriData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Local data'ya ekle
                    musteriler[id] = musteriData;
                    
                    // Real-time sync to other clients
                    socket.emit('dataUpdate', {
                        type: 'musteri-add',
                        data: musteriData
                    });
                    
                    // Local storage'a kaydet
                    guncellenenVerileriKaydet();
                    
                    // UI'yi güncelle
                    musteriTablosunuGuncelle();
                    musteriFormTemizle();
                    editingMode = false;
                    editingMusteriId = null;
                    
                    // İşlem başarılı, pending operation'ı temizle
                    clearPendingOperation();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Başarılı',
                        text: isEditing ? 'Müşteri güncellendi.' : 'Müşteri eklendi.',
                        showConfirmButton: false,
                        timer: 1500
                    });
                } else {
                    throw new Error(result.message);
                }
                
            } catch (error) {
                console.error('❌ Müşteri kaydetme hatası:', error);
                clearPendingOperation(); // Hata durumunda işlemi temizle
                Swal.fire('Hata', error.message || 'Müşteri kaydedilemedi', 'error');
            }
        }
        
        // Müşteri formunu temizle
        function musteriFormTemizle() {
            document.getElementById('musteriAdi').value = '';
            document.getElementById('musteriTelefon').value = '';
            document.getElementById('musteriAdres').value = '';
            document.getElementById('musteriAciklama').value = '';
            
            // Düzenleme modunu sıfırla
            editingMode = false;
            editingMusteriId = null;
            
            // Buton metinlerini güncelle
            document.getElementById('musteriKaydetBtn').innerHTML = '<i class="fas fa-save"></i> Kaydet';
            document.getElementById('musteriIptalBtn').style.display = 'none';
        }
        
        // Müşteri düzenlemeyi iptal et
        function musteriDuzenlemeIptal() {
            musteriFormTemizle();
            Swal.fire({
                icon: 'info',
                title: 'İptal Edildi',
                text: 'Düzenleme işlemi iptal edildi.',
                showConfirmButton: false,
                timer: 1500
            });
        }
        // Ürün satış fonksiyonu
        function urunSat(key) {
    if (!stokListesi[key]) return;

    const urun = stokListesi[key];
    const mevcutStok = parseInt(urun.stok_miktari ?? urun.miktar ?? 0, 10);
    if (mevcutStok <= 0) {
        Swal.fire('Uyarı', 'Bu ürünün stokta yeterli miktarı yok.', 'warning');
        return;
    }

    const alisFiyati = parseFloat(urun.alisFiyati) || 0;

    Swal.fire({
        title: 'Satışı onayla',
        html: `
            <b>${urun.ad || urun.urun_adi || ''}</b> ürününü satmak istediğinize emin misiniz?
            <div style="margin-top: 15px;">
                <div class="form-group">
                    <label for="satisMiktari">Satış Miktarı</label>
                    <input type="number" id="satisMiktari" class="form-control" min="1" max="${mevcutStok}" value="1" inputmode="numeric">
                </div>
                <div class="form-group">
                    <label for="satisFiyati">Satış Fiyatı (₺)</label>
                    <input type="number" id="satisFiyati" class="form-control" placeholder="Fiyat giriniz"
                           min="0" step="0.01" required inputmode="decimal">
                    <small style="color: #666;">
                        Alış fiyatı: ${alisFiyati.toFixed(2)} ₺
                    </small>
                </div>
                <div id="customer-selection" style="margin-top: 10px;">
                    <label>Müşteri Seçin</label>
                    <div style="display: flex; gap: 10px;">
                        <select id="sale-customer" class="form-control" style="flex:1;">
                            <option value="">Müşteri seçin</option>
                        </select>
                        <button type="button" class="btn btn-outline" onclick="openNewCustomerModal('sale-customer')">
                            <i class="fas fa-plus"></i> Yeni Müşteri Ekle
                        </button>
                    </div>
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label>
                        <input type="checkbox" id="borcSatis"> Borçlu satış (müşteri hesabına yaz)
                    </label>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Evet, Sat',
        cancelButtonText: 'İptal',
        confirmButtonColor: '#27ae60',
        cancelButtonColor: '#6c757d',
        allowOutsideClick: false,
        didOpen: () => {
            const popup = Swal.getPopup();
            const saleCustomer = popup.querySelector('#sale-customer');
            saleCustomer.innerHTML = '<option value="">Müşteri seçin</option>';
            for (const [id, musteri] of Object.entries(musteriler)) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = musteri.ad;
                saleCustomer.appendChild(option);
            }
        },
        preConfirm: () => {
            const popup = Swal.getPopup();

            const miktarEl = popup.querySelector('#satisMiktari');
            const fiyatEl  = popup.querySelector('#satisFiyati');
            const musteriEl = popup.querySelector('#sale-customer');
            const borcEl = popup.querySelector('#borcSatis');

            const miktar = parseInt((miktarEl?.value ?? '1'), 10) || 1;

            // virgülü noktaya çevir + trim
            const fiyatRaw = (fiyatEl?.value ?? '').replace(',', '.').trim();
            const fiyat = parseFloat(fiyatRaw);

            if (!fiyatRaw) {
                Swal.showValidationMessage('Lütfen satış fiyatı giriniz.');
                return false;
            }
            if (!Number.isFinite(fiyat) || fiyat <= 0) {
                Swal.showValidationMessage(`Geçerli bir satış fiyatı giriniz. Girilen değer: "${fiyatEl?.value ?? ''}"`);
                return false;
            }
            if (!Number.isInteger(miktar) || miktar <= 0) {
                Swal.showValidationMessage('Satış miktarı 1 veya daha büyük olmalıdır.');
                return false;
            }
            if (miktar > mevcutStok) {
                Swal.showValidationMessage(`Stok yetersiz. Mevcut stok: ${mevcutStok}`);
                return false;
            }

            return {
                satisMiktari: miktar,
                satisFiyati: fiyat,
                customerId: musteriEl?.value || null,
                isDebtSale: !!borcEl?.checked
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { satisMiktari, satisFiyati, customerId, isDebtSale } = result.value;
            await tamamlaSatis(key, satisMiktari, customerId, null, satisFiyati, isDebtSale);
        }
    });
}


        // Satışı tamamla
        async function tamamlaSatis(key, miktar, musteriId, aciklama, satisFiyati, borc = false) {
            // Devam eden işlemi kaydet
            savePendingOperation('satis_islemi', {
                key: key,
                miktar: miktar,
                musteriId: musteriId,
                aciklama: aciklama,
                satisFiyati: satisFiyati,
                borc: borc
            });
            
            const urun = stokListesi[key];
            
            // Fiyat ve miktar kontrolü - Geliştirilmiş validasyon
            const fiyat = parseFloat(satisFiyati);
            const miktarSayi = parseInt(miktar);
            
            console.log('💰 Satış fiyatı kontrolü:', { 
                satisFiyati, 
                fiyat, 
                isValid: !isNaN(fiyat) && fiyat > 0,
                type: typeof satisFiyati,
                isString: typeof satisFiyati === 'string',
                stringLength: typeof satisFiyati === 'string' ? satisFiyati.length : 'N/A'
            });
            
            // Geliştirilmiş fiyat validasyonu
            if (typeof satisFiyati === 'string' && (!satisFiyati.trim() || satisFiyati.trim() === '')) {
                Swal.fire('Hata', 'Lütfen satış fiyatı giriniz.', 'error');
                return;
            }
            
            if (isNaN(fiyat) || fiyat <= 0) {
                Swal.fire('Hata', `Geçerli bir satış fiyatı giriniz. Girilen değer: "${satisFiyati}" (Sayısal değer: ${fiyat})`, 'error');
                return;
            }
            
            if (isNaN(miktarSayi) || miktarSayi <= 0) {
                Swal.fire('Hata', `Geçerli bir miktar giriniz. Girilen değer: "${miktar}" (Sayısal değer: ${miktarSayi})`, 'error');
                return;
            }
            
            // Update stock quantity using the correct field name
            const currentStock = urun.stok_miktari || urun.miktar || 0;
            urun.stok_miktari = currentStock - miktarSayi;
            // Keep backward compatibility
            urun.miktar = urun.stok_miktari;
            
            const toplam = fiyat * miktarSayi;
            
            const satis = {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
                tarih: new Date().toISOString(),
                barkod: urun.barkod,
                urunAdi: urun.urun_adi || urun.ad || '',
                marka: urun.marka || '',
                miktar: miktarSayi,
                fiyat: fiyat,
                alisFiyati: parseFloat(urun.alisFiyati) || 0,
                toplam: toplam,
                borc: !!borc,
                musteriId: musteriId,
                aciklama: aciklama,
                odemeTarihi: null // Borç ödeme tarihi - null olarak başlat
            };
            
            try {
                // Backend'e kaydet
                const response = await fetch(`${API_BASE}/api/satis-ekle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(satis)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Server dönen kaydı kullan
                    const savedSale = result.data || satis;
                    const existingSale = satisGecmisi.find(sale => 
                        sale.id === savedSale.id || 
                        (sale.barkod === savedSale.barkod && 
                         sale.tarih === savedSale.tarih && 
                         sale.miktar === savedSale.miktar)
                    );
                    
                    if (!existingSale) {
                        satisGecmisi.push(savedSale);
                    }
                    
                    // Real-time sync to other clients (server zaten yayınlıyor olsa da local için koruyoruz)
                    socket.emit('dataUpdate', {
                        type: 'satis-add',
                        data: savedSale
                    });
                    
                    // Local storage'a kaydet
                    guncellenenVerileriKaydet();
                    
                    // UI'yi güncelle
                    stokTablosunuGuncelle();
                    satisTablosunuGuncelle();
                    guncelleIstatistikler();
                    
                    if (urun.stok_miktari === 0) {
                        Swal.fire('Bilgi', 'Bu ürünün stoğu tükendi.', 'info');
                    }
                    
                    // İşlem başarılı, pending operation'ı temizle
                    clearPendingOperation();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Satış Tamamlandı!',
                        text: `Ürün satıldı.`,
                        showConfirmButton: false,
                        timer: 1500
                    });
                } else {
                    throw new Error(result.message);
                }
                
            } catch (error) {
                console.error('❌ Satış kaydetme hatası:', error);
                clearPendingOperation(); // Hata durumunda işlemi temizle
                Swal.fire('Hata', error.message || 'Satış kaydedilemedi', 'error');
                
                // Hata durumunda stoku geri al
                urun.stok_miktari += miktar;
                urun.miktar = urun.stok_miktari;
            }
        }
        
        // Satışta yeni müşteri ekleme modalını aç
        function openNewCustomerModal(customerSelectId) {
            // Müşteri formunu temizle
            musteriFormTemizle();
            // Müşteri ekleme panelini aç
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="customers"]').classList.add('active');
            document.getElementById('stock-panel').style.display = 'none';
            document.getElementById('sales-panel').style.display = 'none';
            document.getElementById('customers-panel').style.display = 'block';
            // Kaydet butonuna özel işlev ekle
            const originalSave = musteriEkle;
            musteriEkle = async function() {
                await originalSave.call(this);
                // Kaydetme işleminden sonra satış modalına dön
                setTimeout(() => {
                    // Müşteri listesini güncelle
                    const saleCustomer = document.getElementById(customerSelectId);
                    saleCustomer.innerHTML = '<option value="">Müşteri seçin</option>';
                    for (const [id, musteri] of Object.entries(musteriler)) {
                        const option = document.createElement('option');
                        option.value = id;
                        option.textContent = musteri.ad;
                        saleCustomer.appendChild(option);
                    }
                    // Satış panelini tekrar aç
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelector('[data-tab="sales"]').classList.add('active');
                    document.getElementById('stock-panel').style.display = 'none';
                    document.getElementById('customers-panel').style.display = 'none';
                    document.getElementById('sales-panel').style.display = 'block';
                    // Müşteri ekleme fonksiyonunu eski haline getir
                    musteriEkle = originalSave;
                }, 500);
            };
        }
        
        // Ürün iade (API ile entegre)
        async function urunIade(satisId) {
            const satisIndex = satisGecmisi.findIndex(s => s.id === satisId);
            if (satisIndex === -1) return;
            
            const satis = satisGecmisi[satisIndex];
            
            Swal.fire({
                title: 'İadeyi onayla',
                html: `<b>${satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'))}</b> ürününü iade etmek istediğinize emin misiniz?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Evet, İade Et',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#27ae60',
                cancelButtonColor: '#6c757d'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        console.log('🔄 İade işlemi başlatılıyor:', satisId);
                        
                        // Ürün ID'sini bul - önce varyant_id ile tam eşleşme ara, sonra barkod ve marka ile
                        let urunId = null;
                        
                        // Eğer satış kaydında varyant_id varsa, önce onu kullan
                        if (satis.varyant_id) {
                            const varyantProduct = Object.values(stokListesi).find(urun => 
                                urun.barkod === satis.barkod && 
                                urun.varyant_id === satis.varyant_id
                            );
                            if (varyantProduct) {
                                urunId = varyantProduct.urun_id || varyantProduct.id;
                            }
                        }
                        
                        // Varyant bulunamazsa, barkod ve marka ile ara
                        if (!urunId) {
                            const matchingProduct = Object.values(stokListesi).find(urun => 
                                urun.barkod === satis.barkod && 
                                (urun.marka || '') === (satis.marka || '') &&
                                (!satis.varyant_id || !urun.varyant_id || urun.varyant_id === satis.varyant_id)
                            );
                            if (matchingProduct) {
                                urunId = matchingProduct.urun_id || matchingProduct.id;
                            }
                        }
                        
                        console.log('🔍 İade için ürün ID bulunuyor:', {
                            barkod: satis.barkod,
                            marka: satis.marka,
                            bulunanUrunId: urunId
                        });
                        
                        // API'ye iade isteği gönder
                        const response = await fetch(`${API_BASE}/api/satis-iade`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                satisId: satisId,
                                urunId: urunId, // Ürün ID'sini ekle
                                barkod: satis.barkod,
                                miktar: satis.miktar,
                                urunAdi: satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-')),
                                alisFiyati: satis.alisFiyati || 0
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Local data'dan satışı sil
                            satisGecmisi.splice(satisIndex, 1);
                            
                            // Stok güncellemesi varsa local data'yı güncelle
                            if (result.stokGuncellemesi) {
                                // Use composite key for stock update
                                const compositeKey = `${result.stokGuncellemesi.barkod}_${result.stokGuncellemesi.marka || ''}_${result.stokGuncellemesi.varyant_id || ''}`;
                                
                                // Map backend fields to frontend expected fields
                                const mappedData = {
                                    ...result.stokGuncellemesi,
                                    urun_adi: result.stokGuncellemesi.ad || result.stokGuncellemesi.urun_adi || '',
                                    stok_miktari: result.stokGuncellemesi.miktar || result.stokGuncellemesi.stok_miktari || 0,
                                    fiyat: result.stokGuncellemesi.satisFiyati || result.stokGuncellemesi.fiyat || 0
                                };
                                
                                stokListesi[compositeKey] = mappedData;
                            }
                            
                            // Real-time sync to other clients
                            socket.emit('dataUpdate', {
                                type: 'satis-iade',
                                data: { satisId: satisId, barkod: satis.barkod },
                                source: socket.id
                            });
                            
                            stokTablosunuGuncelle();
                            satisTablosunuGuncelle();
                            guncellenenVerileriKaydet();
                            
                            Swal.fire({
                                icon: 'success',
                                title: 'İade Tamamlandı!',
                                text: result.message || 'Ürün stoklara geri eklendi.',
                                showConfirmButton: false,
                                timer: 1500
                            });
                        } else {
                            throw new Error(result.message);
                        }
                        
                    } catch (error) {
                        console.error('❌ İade hatası:', error);
                        Swal.fire('Hata', error.message || 'İade işlemi başarısız', 'error');
                    }
                }
            });
        }
        
        // Satış sil (API ile entegre)
        async function satisSil(satisId) {
            const satisIndex = satisGecmisi.findIndex(s => s.id == satisId || s.id === parseInt(satisId));
            if (satisIndex === -1) {
                console.error('❌ Satış bulunamadı:', satisId);
                Swal.fire('Hata', `Satış bulunamadı. ID: ${satisId}`, 'error');
                return;
            }
            
            Swal.fire({
                title: 'Satışı silmek istiyor musunuz?',
                text: 'Bu işlem geri alınamaz!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Evet, sil!',
                cancelButtonText: 'İptal'
            }).then(async (dialog) => {
                if (!dialog.isConfirmed) return;
                try {
                    console.log('🗑️ Satış siliniyor:', satisId);
                    const response = await fetch(`${API_BASE}/api/satis-sil/${satisId}`, { method: 'DELETE' });
                    const apiResult = await response.json();
                    if (!response.ok || !apiResult.success) throw new Error(apiResult.message || 'Satış silinemedi');
                    
                    // FIX: Only delete locally and emit socket event, don't do both
                    // The socket event will be handled by other clients, not this one
                    satisGecmisi.splice(satisIndex, 1);
                    satisTablosunuGuncelle();
                    guncellenenVerileriKaydet();
                    showNotification('🗑️ Satış silindi', 'success');
                    Swal.fire({ icon: 'success', title: 'Satış Silindi!', text: apiResult.message, showConfirmButton: false, timer: 1200 });
                } catch (error) {
                    console.error('❌ Satış silme hatası:', error);
                    Swal.fire('Hata', error.message || 'Satış silinemedi', 'error');
                }
            });
        }
        
        // Ürün düzenle
        function urunDuzenle(key) {
            const urun = stokListesi[key];
            if (!urun) {
                console.error('Ürün bulunamadı:', key);
                return;
            }
            document.getElementById('barkod').value = urun.barkod; // Gerçek barkod değerini kullan
            document.getElementById('urunAdi').value = urun.urun_adi || urun.ad || '';
            document.getElementById('marka').value = urun.marka || '';
            document.getElementById('aciklama').value = urun.aciklama || '';
            document.getElementById('miktar').value = urun.stok_miktari || urun.miktar || 0;
            document.getElementById('alisFiyati').value = urun.alisFiyati || '';
            document.getElementById('satisFiyati').value = urun.fiyat || urun.satisFiyati || '';

            
            // Düzenlenen ürün key'ini kaydet
            editingBarkod = key;
            
            // Sayfayı formun olduğu kısma kaydır
            document.getElementById('barkod').scrollIntoView({ behavior: 'smooth' });
        }
        
        // Barkod tabanlı sistem - ID oluşturmaya gerek yok
        
        // Aynı barkodlu ürünler için seçim modalı
        function showBarcodeConflictModal(existingProducts, newProduct) {
            return new Promise((resolve) => {
                let modalHTML = `
                    <div style="text-align: left; max-height: 300px; overflow-y: auto;">
                        <p><strong>Bu barkod ile ${existingProducts.length} farklı ürün bulundu:</strong></p>
                        <div style="margin: 15px 0;">
                `;
                
                existingProducts.forEach((product, index) => {
                    modalHTML += `
                        <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px;">
                            <strong>${index + 1}. ${product.ad}</strong><br>
                            <small>Marka: ${product.marka || '-'} | Stok: ${product.miktar} | Fiyat: ${product.satisFiyati} ₺</small>
                        </div>
                    `;
                });
                
                modalHTML += `
                        </div>
                        <p><strong>Ne yapmak istiyorsunuz?</strong></p>
                    </div>
                `;
                
                Swal.fire({
                    title: 'Barkod Çakışması',
                    html: modalHTML,
                    icon: 'warning',
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: 'Yeni Ürün Olarak Ekle',
                    denyButtonText: 'Mevcut Ürünü Güncelle',
                    cancelButtonText: 'İptal',
                    reverseButtons: true
                }).then((result) => {
                    if (result.isConfirmed) {
                        resolve('add_new');
                    } else if (result.isDenied) {
                        resolve('update_existing');
                    } else {
                        resolve('cancel');
                    }
                });
            });
        }
        // Ürün kaydetme fonksiyonu (Real-time API kullanır) - ULTRA OPTIMIZED
        window.urunKaydet = async function() {
            // console.log('🔄 urunKaydet fonksiyonu başlatıldı'); // PERFORMANCE: Log kaldırıldı
            
            // Devam eden işlemi kaydet
            savePendingOperation('urun_ekleme', {
                barkod: document.getElementById('barkod')?.value.trim(),
                urunAdi: document.getElementById('urunAdi')?.value.trim(),
                marka: document.getElementById('marka')?.value.trim(),
                miktar: document.getElementById('miktar')?.value,
                alisFiyati: document.getElementById('alisFiyati')?.value,
                satisFiyati: document.getElementById('satisFiyati')?.value,
                aciklama: document.getElementById('aciklama')?.value.trim()
            });
            
            // Form elementlerini kontrol et - OPTIMIZED
            const formElements = {
                barkod: document.getElementById('barkod'),
                urunAdi: document.getElementById('urunAdi'),
                marka: document.getElementById('marka'),
                miktar: document.getElementById('miktar'),
                alisFiyati: document.getElementById('alisFiyati'),
                satisFiyati: document.getElementById('satisFiyati'),

                aciklama: document.getElementById('aciklama')
            };
            
            // Kritik elementleri kontrol et
            if (!formElements.barkod || !formElements.urunAdi) {
                console.error('❌ Kritik form elementleri eksik!');
                Swal.fire('Hata', 'Form elementleri yüklenemedi. Sayfayı yenileyin.', 'error');
                return;
            }
            
            // Form verilerini al - OPTIMIZED
            const formData = {
                barkod: formElements.barkod.value.trim(),
                ad: formElements.urunAdi.value.trim(),
                marka: formElements.marka ? formElements.marka.value.trim() : '',
                miktar: formElements.miktar ? parseFloat(formElements.miktar.value) || 0 : 0,
                alisFiyati: formElements.alisFiyati ? parseFloat(formElements.alisFiyati.value) || 0 : 0,
                satisFiyati: formElements.satisFiyati ? parseFloat(formElements.satisFiyati.value) || 0 : 0,
                kategori: '',
                aciklama: formElements.aciklama ? formElements.aciklama.value.trim() : ''
            };
            
            // console.log('📝 Form verileri:', formData); // PERFORMANCE: Log kaldırıldı
            
            if (!formData.barkod || !formData.ad) {
                console.warn('⚠️ Eksik veri: barkod veya ad');
                Swal.fire('Hata', 'Barkod ve ürün adı zorunludur!', 'error');
                return;
            }
            
            const urunData = {
                barkod: formData.barkod,
                urun_adi: formData.ad,
                ad: formData.ad, // Backward compatibility
                marka: formData.marka,
                stok_miktari: formData.miktar,
                miktar: formData.miktar, // Backward compatibility
                alisFiyati: formData.alisFiyati,
                fiyat: formData.satisFiyati,
                satisFiyati: formData.satisFiyati, // Backward compatibility
                kategori: formData.kategori,
                aciklama: formData.aciklama
            };
            
            // console.log('📦 Gönderilecek veri:', urunData); // PERFORMANCE: Log kaldırıldı
            
            try {
                let response;
                
                if (editingBarkod && stokListesi[editingBarkod]) {
                    // Güncelleme
                    console.log('🔄 Ürün güncelleniyor:', barkod, 'Key:', editingBarkod);
                    const editingUrun = stokListesi[editingBarkod];
                    urunData.id = editingUrun.id; // ID'yi ekle
                    urunData.varyant_id = editingUrun.varyant_id || ''; // Mevcut varyant_id'yi koru
                    urunData.guncellemeTarihi = new Date().toISOString();
                    
                    response = await fetch(`${API_BASE}/api/stok-guncelle/${editingUrun.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(urunData)
                    });
                } else {
                    // Yeni ekleme
                    console.log('📦 Yeni ürün ekleniyor:', barkod);
                    
                    response = await fetch(`${API_BASE}/api/stok-ekle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(urunData)
                    });
                }
                
                const result = await response.json();
                
                if (result.success && result.data) {
                    // Determine if this was an update or add operation
                    const isUpdate = editingBarkod && stokListesi[editingBarkod];
                    const oldKey = editingBarkod;
                    
                    // Create new composite key
                    const compositeKey = `${result.data.barkod}_${result.data.marka || ''}_${result.data.varyant_id || ''}`;
                    
                    // Map backend fields to frontend expected fields
                    const mappedData = {
                        ...result.data,
                        urun_adi: result.data.ad || result.data.urun_adi || '',
                        stok_miktari: result.data.miktar || result.data.stok_miktari || 0,
                        fiyat: result.data.satisFiyati || result.data.fiyat || 0
                    };
                    
                    // If updating and key changed, remove old entry
                    if (isUpdate && oldKey !== compositeKey && oldKey) {
                        delete stokListesi[oldKey];
                        console.log('🔄 Old key removed:', oldKey, 'New key:', compositeKey);
                    }
                    
                    // Add/update with new key
                    stokListesi[compositeKey] = mappedData;
                    
                    // Clear editing state
                    editingBarkod = null;
                    
                    // Real-time sync to other clients
                    socket.emit('dataUpdate', {
                        type: isUpdate ? 'stok-update' : 'stok-add',
                        data: result.data
                    });
                    
                    // Show appropriate message based on the operation
                    let message = result.message;
                    if (result.existingVariants && result.existingVariants > 0) {
                        message += ` (${result.existingVariants} varyant mevcut)`;
                    }
                    
                    // İşlem başarılı, pending operation'ı temizle
                    clearPendingOperation();
                    
                    Swal.fire('Başarılı!', message, 'success');
                    
                    // Formu temizle
                    document.getElementById('barkod').value = '';
                    document.getElementById('urunAdi').value = '';
                    document.getElementById('marka').value = '';
                    document.getElementById('aciklama').value = '';
                    document.getElementById('miktar').value = '';
                    document.getElementById('alisFiyati').value = '';
                    
                    // Tabloyu güncelle
                    stokTablosunuGuncelle();
                    guncellenenVerileriKaydet();
                } else if (result.conflict) {
                    // Handle barcode conflict with multiple products
                    const action = await showBarcodeConflictModal(result.existingProducts || [result.existingProduct], urunData);
                    
                    if (action === 'add_new') {
                        // Force add as new product
                        const forceAddResponse = await fetch(`${API_BASE}/api/stok-ekle`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({...urunData, force_add: true})
                        });
                        
                        const forceAddResult = await forceAddResponse.json();
                        
                        if (forceAddResult.success) {
                            // Add to local data with urun_id as key
                            const urunKey = forceAddResult.data.urun_id || forceAddResult.data.id;
                            
                            // Map backend fields to frontend expected fields
                            const mappedData = {
                                ...forceAddResult.data,
                                urun_adi: forceAddResult.data.ad || forceAddResult.data.urun_adi || '',
                                stok_miktari: forceAddResult.data.miktar || forceAddResult.data.stok_miktari || 0,
                                fiyat: forceAddResult.data.satisFiyati || forceAddResult.data.fiyat || 0
                            };
                            
                            stokListesi[urunKey] = mappedData;
                            
                            // Real-time sync to other clients
                            socket.emit('dataUpdate', {
                                type: 'stok-add',
                                data: forceAddResult.data
                            });
                            
                            // İşlem başarılı, pending operation'ı temizle
                            clearPendingOperation();
                            
                            Swal.fire('Başarılı!', 'Yeni ürün eklendi', 'success');
                            
                            // Formu temizle
                            document.getElementById('barkod').value = '';
                            document.getElementById('urunAdi').value = '';
                            document.getElementById('marka').value = '';
                            document.getElementById('aciklama').value = '';
                            document.getElementById('miktar').value = '';
                            document.getElementById('alisFiyati').value = '';
                            
                            // Tabloyu güncelle
                            stokTablosunuGuncelle();
                            guncellenenVerileriKaydet();
                        } else {
                            Swal.fire('Hata', forceAddResult.message, 'error');
                        }
                    } else if (action === 'update_existing') {
                        // Show product selection for update
                        const productOptions = (result.existingProducts || [result.existingProduct]).map((product, index) => 
                            `<option value="${product.id}">${index + 1}. ${product.ad} (${product.marka || '-'})</option>`
                        ).join('');
                        
                        const { value: selectedProductId } = await Swal.fire({
                            title: 'Güncellenecek Ürünü Seçin',
                            html: `
                                <select id="productSelect" class="swal2-input">
                                    ${productOptions}
                                </select>
                            `,
                            showCancelButton: true,
                            confirmButtonText: 'Güncelle',
                            cancelButtonText: 'İptal',
                            preConfirm: () => {
                                return document.getElementById('productSelect').value;
                            }
                        });
                        
                        if (selectedProductId) {
                            // Update selected product
                            const updateResponse = await fetch(`${API_BASE}/api/stok-guncelle/${selectedProductId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(urunData)
                            });
                            
                            const updateResult = await updateResponse.json();
                            
                            if (updateResult.success) {
                                // Update local data
                                const urunKey = updateResult.data.urun_id || updateResult.data.id;
                                
                                // Map backend fields to frontend expected fields
                                const mappedData = {
                                    ...updateResult.data,
                                    urun_adi: updateResult.data.ad || updateResult.data.urun_adi || '',
                                    stok_miktari: updateResult.data.miktar || updateResult.data.stok_miktari || 0,
                                    fiyat: updateResult.data.satisFiyati || updateResult.data.fiyat || 0
                                };
                                
                                stokListesi[urunKey] = mappedData;
                                
                                // Real-time sync to other clients
                                socket.emit('dataUpdate', {
                                    type: 'stok-update',
                                    data: updateResult.data
                                });
                                
                                // İşlem başarılı, pending operation'ı temizle
                                clearPendingOperation();
                                
                                Swal.fire('Başarılı!', 'Ürün güncellendi', 'success');
                                
                                // Formu temizle
                                document.getElementById('barkod').value = '';
                                document.getElementById('urunAdi').value = '';
                                document.getElementById('marka').value = '';
                                document.getElementById('aciklama').value = '';
                                document.getElementById('miktar').value = '';
                                document.getElementById('alisFiyati').value = '';
                                
                                // Tabloyu güncelle
                                stokTablosunuGuncelle();
                                guncellenenVerileriKaydet();
                            } else {
                                Swal.fire('Hata', updateResult.message, 'error');
                            }
                        }
                    }
                } else {
                    throw new Error(result.message || result.error || 'Bilinmeyen hata');
                }
                
            } catch (error) {
                console.error('❌ Ürün kaydetme hatası:', error);
                clearPendingOperation(); // Hata durumunda işlemi temizle
                Swal.fire('Hata', error.message || 'Ürün kaydedilemedi', 'error');
            }
        }
        
        // Ürün silme fonksiyonu (Real-time API kullanır)
        async function urunSil(key) {
            if (!stokListesi[key]) return;
            
            const urun = stokListesi[key];
            
            Swal.fire({
                title: 'Silmeyi onayla',
                html: `<b>${urun.urun_adi || urun.ad || ''}</b> ürününü silmek istediğinize emin misiniz?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#6c757d'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        console.log('🗑️ Ürün siliniyor:', urun.barkod, 'ID:', urun.id);
                        
                        // Use ID-based deletion to ensure correct variant is deleted
                        const deleteUrl = urun.id ? 
                            `${API_BASE}/api/stok-sil/${urun.id}` : 
                            `${API_BASE}/api/stok-sil-barkod/${encodeURIComponent(urun.barkod)}`;
                        
                        const response = await fetch(deleteUrl, {
                            method: 'DELETE'
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Local data dan sil
                            delete stokListesi[key];
                            
                            // Real-time sync to other clients
                            socket.emit('dataUpdate', {
                                type: 'stok-delete',
                                data: { 
                                    id: urun.id,
                                    barkod: urun.barkod,
                                    marka: urun.marka,
                                    varyant_id: urun.varyant_id
                                },
                                source: socket.id
                            });
                            
                            stokTablosunuGuncelle();
                            guncellenenVerileriKaydet();
                            
                            Swal.fire({
                                icon: 'success',
                                title: 'Ürün Silindi!',
                                text: result.message,
                                showConfirmButton: false,
                                timer: 1500
                            });
                        } else if (!result.canDelete && result.salesCount > 0) {
                            // Satışlı ürün için özel durumu handle et
                            Swal.fire({
                                title: 'Ürün Daha Önce Satılmış',
                                html: `<p>${result.message}</p><p>Bu ürünü yine de silmek istiyor musunuz?</p>`,
                                icon: 'warning',
                                showCancelButton: true,
                                showDenyButton: true,
                                confirmButtonText: 'Evet, Zorla Sil',
                                denyButtonText: 'Satışları İade Et',
                                cancelButtonText: 'İptal',
                                confirmButtonColor: '#e74c3c',
                                denyButtonColor: '#f39c12',
                                cancelButtonColor: '#6c757d'
                            }).then(async (forceResult) => {
                                if (forceResult.isConfirmed) {
                                    // Force delete
                                    await forcedeleteProduct(urun, key);
                                } else if (forceResult.isDenied) {
                                    // Show sales for this product
                                    showProductSalesForReturn(urun.barkod);
                                }
                            });
                        } else {
                            throw new Error(result.message);
                        }
                        
                    } catch (error) {
                        console.error('❌ Ürün silme hatası:', error);
                        Swal.fire('Hata', error.message || 'Ürün silinemedi', 'error');
                    }
                }
            });
        }
        
        // Formu temizle
        function formTemizle() {
            document.getElementById('barkod').value = '';
            document.getElementById('urunAdi').value = '';
            document.getElementById('marka').value = '';
            document.getElementById('aciklama').value = '';
            document.getElementById('miktar').value = '0';
            document.getElementById('alisFiyati').value = '';
            document.getElementById('satisFiyati').value = '';

            
            editingBarkod = null;
        }
        
        // Ürünü zorla sil
        async function forcedeleteProduct(urun, key) {
            try {
                const deleteUrl = urun.id ? 
                    `${API_BASE}/api/stok-sil/${urun.id}?force=true` : 
                    `${API_BASE}/api/stok-sil-barkod/${encodeURIComponent(urun.barkod)}?force=true`;
                
                const response = await fetch(deleteUrl, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Local data dan sil
                    delete stokListesi[key];
                    
                    // Real-time sync to other clients
                    socket.emit('dataUpdate', {
                        type: 'stok-delete',
                        data: { 
                            id: urun.id,
                            barkod: urun.barkod,
                            marka: urun.marka,
                            varyant_id: urun.varyant_id,
                            forced: true
                        },
                        source: socket.id
                    });
                    
                    stokTablosunuGuncelle();
                    guncellenenVerileriKaydet();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Ürün Zorla Silindi!',
                        text: result.message,
                        showConfirmButton: false,
                        timer: 1500
                    });
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('❌ Zorla silme hatası:', error);
                Swal.fire('Hata', error.message || 'Ürün zorla silinemedi', 'error');
            }
        }
        
        // Ürün satışlarını iade için göster
        function showProductSalesForReturn(barkod) {
            const productSales = satisGecmisi.filter(s => s.barkod === barkod);
            
            if (productSales.length === 0) {
                Swal.fire('Bilgi', 'Bu ürün için satış kaydı bulunamadı.', 'info');
                return;
            }
            
            let salesHTML = `
                <div style="max-height: 300px; overflow-y: auto;">
                    <p><strong>Barkod ${barkod} için ${productSales.length} satış bulundu:</strong></p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tarih</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Miktar</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Fiyat</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            productSales.forEach(sale => {
                const tarih = new Date(sale.tarih).toLocaleDateString('tr-TR');
                salesHTML += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${tarih}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${sale.miktar}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${sale.fiyat?.toFixed(2) || '0.00'} ₺</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">
                            <button onclick="urunIade('${sale.id}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">İade Et</button>
                        </td>
                    </tr>
                `;
            });
            
            salesHTML += `
                        </tbody>
                    </table>
                </div>
            `;
            
            Swal.fire({
                title: 'Ürün Satış Geçmişi',
                html: salesHTML,
                icon: 'info',
                confirmButtonText: 'Tamam',
                width: '600px'
            });
        }
        // Düşük stoklu ürünleri göster
        function showLowStockProducts() {
            const lowStockBody = document.getElementById('lowStockBody');
            lowStockBody.innerHTML = '';
            
            let hasLowStock = false;
            let lowStockProducts = [];
            
            for (const [barkod, urun] of Object.entries(stokListesi)) {
                const stockAmount = urun.stok_miktari || urun.miktar || 0;
                if (stockAmount <= 1) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <div class="barcode-container">
                                <span class="barcode-text">${urun.barkod || '-'}</span>
                                <button class="copy-btn" onclick="copyBarcode('${urun.barkod || ''}')" title="Barkodu Kopyala">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </td>
                        <td>${urun.urun_adi || urun.ad || ''}</td>
                        <td>${urun.marka || '-'}</td>
                        <td>${stockAmount}</td>
                    `;
                    
                    lowStockBody.appendChild(tr);
                    hasLowStock = true;
                    lowStockProducts.push({
                        barkod: urun.barkod || '-',
                        urun_adi: urun.urun_adi || urun.ad || '',
                        marka: urun.marka || '-',
                        miktar: stockAmount
                    });
                }
            }
            
            if (hasLowStock) {
                // Store low stock products for copy functionality
                window.lowStockProducts = lowStockProducts;
                document.getElementById('lowStockModal').style.display = 'flex';
            } else {
                Swal.fire('Bilgi', 'Düşük stoklu ürün bulunmamaktadır.', 'info');
            }
        }
        
        // Düşük stok listesini kopyala
        function copyLowStockList() {
            if (!window.lowStockProducts || window.lowStockProducts.length === 0) {
                Swal.fire('Hata', 'Kopyalanacak düşük stoklu ürün bulunamadı.', 'error');
                return;
            }
            
            let copyText = 'DÜŞÜK STOKLU ÜRÜNLER LİSTESİ\n';
            copyText += '='.repeat(30) + '\n\n';
            
            window.lowStockProducts.forEach((urun, index) => {
                copyText += `${index + 1}. ${urun.urun_adi}\n`;
                copyText += `   Barkod: ${urun.barkod}\n`;
                copyText += `   Marka: ${urun.marka}\n`;
                copyText += `   Stok: ${urun.miktar}\n`;
                copyText += '\n';
            });
            
            copyText += `Toplam: ${window.lowStockProducts.length} ürün\n`;
            copyText += `Tarih: ${new Date().toLocaleDateString('tr-TR')}`;
            
            navigator.clipboard.writeText(copyText).then(() => {
                Swal.fire('Başarılı', 'Düşük stoklu ürünler listesi panoya kopyalandı.', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = copyText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                Swal.fire('Başarılı', 'Düşük stoklu ürünler listesi panoya kopyalandı.', 'success');
            });
        }
        
        // Aynı barkodlu ürünleri ara
        async function searchProductsByBarcode(barkod) {
            try {
                const response = await fetch(`${API_BASE}/api/urunler-barkod/${encodeURIComponent(barkod)}`);
                const result = await response.json();
                
                if (result.success && result.data.length > 0) {
                    let modalHTML = `
                        <div style="text-align: left; max-height: 300px; overflow-y: auto;">
                            <p><strong>Bu barkod ile ${result.data.length} ürün bulundu:</strong></p>
                            <div style="margin: 15px 0;">
                    `;
                    
                    result.data.forEach((product, index) => {
                        modalHTML += `
                            <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px;">
                                <strong>${index + 1}. ${product.ad}</strong><br>
                                <small>ID: ${product.urun_id || product.id} | Marka: ${product.marka || '-'} | Stok: ${product.miktar} | Fiyat: ${product.satisFiyati} ₺</small>
                            </div>
                        `;
                    });
                    
                    modalHTML += `
                            </div>
                        </div>
                    `;
                    
                    Swal.fire({
                        title: 'Aynı Barkodlu Ürünler',
                        html: modalHTML,
                        icon: 'info',
                        confirmButtonText: 'Tamam'
                    });
                } else {
                    Swal.fire('Bilgi', 'Bu barkod ile ürün bulunamadı.', 'info');
                }
            } catch (error) {
                console.error('❌ Barkod arama hatası:', error);
                Swal.fire('Hata', 'Barkod arama hatası: ' + error.message, 'error');
            }
        }

        // Barkod kopyala
        function copyBarcode(barkod) {
            if (!barkod || barkod === '-') {
                Swal.fire('Hata', 'Kopyalanacak barkod bulunamadı.', 'error');
                return;
            }
            
            navigator.clipboard.writeText(barkod).then(() => {
                Swal.fire('Başarılı', 'Barkod panoya kopyalandı.', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = barkod;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                Swal.fire('Başarılı', 'Barkod panoya kopyalandı.', 'success');
            });
        }
        
        // Tab değiştirme fonksiyonu - Düzeltilmiş
        function switchTab(tabName) {
            console.log('🔄 Tab değiştiriliyor:', tabName);
            
            try {
                // Tüm tabları gizle
                const panels = ['stock-panel', 'sales-panel', 'customers-panel', 'debts-panel'];
                panels.forEach(panelId => {
                    const panel = document.getElementById(panelId);
                    if (panel) panel.style.display = 'none';
                });
                
                // Tüm tab butonlarından active class'ını kaldır
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                // Seçilen tabı göster
                const targetPanel = document.getElementById(tabName + '-panel');
                if (targetPanel) {
                    targetPanel.style.display = 'block';
                }
                
                // Seçilen tab butonuna active class'ı ekle
                const activeTab = document.querySelector('[data-tab="' + tabName + '"]');
                if (activeTab) {
                    activeTab.classList.add('active');
                }
                
                // Tab değiştiğinde verileri güncelle
                setTimeout(() => {
                    if (tabName === 'sales') {
                        if (typeof satisTablosunuGuncelle === 'function') {
                            satisTablosunuGuncelle();
                        }
                        if (typeof guncelleIstatistikler === 'function') {
                            guncelleIstatistikler();
                        }
                    } else if (tabName === 'customers') {
                        if (typeof musteriTablosunuGuncelle === 'function') {
                            musteriTablosunuGuncelle();
                        }
                    } else if (tabName === 'debts') {
                        if (typeof borcTablosunuGuncelle === 'function') {
                            borcTablosunuGuncelle();
                        }
                    } else if (tabName === 'stock') {
                        if (typeof stokTablosunuGuncelle === 'function') {
                            stokTablosunuGuncelle();
                        }
                        if (typeof guncelleIstatistikler === 'function') {
                            guncelleIstatistikler();
                        }
                    }
                }, 100);
                console.log('✅ Tab değiştirildi:', tabName);
            } catch (error) {
                console.error('❌ Tab değiştirme hatası:', error);
            }
        }

        // Tema değiştirme fonksiyonu
        function toggleTheme() {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', currentTheme);
            localStorage.setItem('theme', currentTheme);
            
            // Tema ikonunu güncelle
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            if (currentTheme === 'dark') {
                themeIcon.className = 'fas fa-sun';
                themeText.textContent = 'Açık Tema';
            } else {
                themeIcon.className = 'fas fa-moon';
                themeText.textContent = 'Karanlık Tema';
            }
            
            // Bildirim göster
            showNotification(`Tema değiştirildi: ${currentTheme === 'dark' ? 'Karanlık' : 'Açık'}`, 'success');
        }

        // Görünüm değiştirme
        function toggleView(view) {
            const tableView = document.getElementById('table-view');
            const cardView = document.getElementById('card-view');
            const tableViewBtn = document.getElementById('tableView');
            const cardViewBtn = document.getElementById('cardView');
            
            if (view === 'table') {
                tableView.style.display = 'block';
                cardView.style.display = 'none';
                tableViewBtn.classList.add('active');
                cardViewBtn.classList.remove('active');
                currentView = 'table';
            } else {
                tableView.style.display = 'none';
                cardView.style.display = 'grid';
                tableViewBtn.classList.remove('active');
                cardViewBtn.classList.add('active');
                currentView = 'card';
            }
        }
        // Arama yap - 60 saniye timeout ile
        let searchTimeout;
        function aramaYap() {
            const searchInput = document.getElementById('searchInput');
            const aramaMetni = searchInput.value.toLowerCase().replace(/\s+/g, '');
            const rows = document.querySelectorAll('#stokTablosu tbody tr');
            const cards = document.querySelectorAll('#card-view .product-card');
            const noProductMessage = document.getElementById('noProductMessage');
            
            let productFound = false;
            
            rows.forEach(row => {
                const rowText = row.textContent.toLowerCase().replace(/\s+/g, '');
                if (rowText.includes(aramaMetni)) {
                    row.style.display = '';
                    productFound = true;
                } else {
                    row.style.display = 'none';
                }
            });
            
            cards.forEach(card => {
                const cardText = card.textContent.toLowerCase().replace(/\s+/g, '');
                if (cardText.includes(aramaMetni)) {
                    card.style.display = '';
                    productFound = true;
                } else {
                    card.style.display = 'none';
                }
            });
            
            // Ürün bulunamadıysa mesaj göster
            if (!productFound && aramaMetni.length > 0) {
                noProductMessage.style.display = 'block';
            } else {
                noProductMessage.style.display = 'none';
            }
            
            // 60 saniye sonra arama kutusunu temizle (eğer değişiklik yapılmazsa)
            clearTimeout(searchTimeout);
            if (aramaMetni.length > 0) {
                searchTimeout = setTimeout(() => {
                    if (searchInput.value === searchInput.value) { // Değişiklik kontrol etmek için
                        searchInput.value = '';
                        aramaYap(); // Temizlendikten sonra filtreyi kaldır
                    }
                }, 60000); // 60 saniye
            }
        }
        
        // Yeni ürün ekleme teklifi
        function yeniUrunEkle() {
            const searchInput = document.getElementById('searchInput');
            document.getElementById('urunAdi').value = searchInput.value;
            searchInput.value = '';
            document.getElementById('noProductMessage').style.display = 'none';
            document.getElementById('barkod').focus();
        }
        
        // Satış geçmişini filtrele
        function filterSales(period) {
            const now = new Date();
            const salesBody = document.getElementById('salesBody');
            salesBody.innerHTML = '';
            
            let filteredSales = satisGecmisi;
            
            if (period !== 'all') {
                filteredSales = satisGecmisi.filter(satis => {
                    const saleDate = new Date(satis.tarih);
                    
                    if (period === 'daily') {
                        return saleDate.getDate() === now.getDate() && 
                               saleDate.getMonth() === now.getMonth() && 
                               saleDate.getFullYear() === now.getFullYear();
                    } else if (period === 'weekly') {
                        const oneWeekAgo = new Date();
                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                        return saleDate > oneWeekAgo;
                    } else if (period === 'monthly') {
                        return saleDate.getMonth() === now.getMonth() && 
                               saleDate.getFullYear() === now.getFullYear();
                    } else if (period === 'yearly') {
                        return saleDate.getFullYear() === now.getFullYear();
                    }
                    
                    return true;
                });
            }
            
            if (filteredSales && filteredSales.length > 0) {
                filteredSales.forEach(satis => {
                    const tr = document.createElement('tr');
                    const tarih = new Date(satis.tarih);
                    const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()} ${tarih.getHours().toString().padStart(2, '0')}:${tarih.getMinutes().toString().padStart(2, '0')}`;
                    
                    // Müşteri adını bul
                    let musteriAdi = '-';
                    if (satis.musteriId && musteriler[satis.musteriId]) {
                        musteriAdi = musteriler[satis.musteriId].ad;
                    }
                    
                    tr.innerHTML = `
                        <td>${tarihStr}</td>
                        <td>${satis.barkod}</td>
                        <td>${satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'))}</td>
                        <td>${satis.miktar}</td>
                        <td>${(parseFloat(satis.alisFiyati) || 0) > 0 ? (parseFloat(satis.alisFiyati)).toFixed(2) : '-'}</td>
                        <td>${(parseFloat(satis.fiyat) || 0).toFixed(2)}</td>
                        <td>${(parseFloat(satis.toplam) || ((parseFloat(satis.fiyat) || 0) * (parseInt(satis.miktar) || 0))).toFixed(2)}</td>
                        <td>${satis.borc ? '<span class="credit-indicator">Borç</span>' : 'Nakit'}</td>
                        <td>${musteriAdi}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-return" title="İade" onclick="urunIade('${satis.id}')">
                                    <i class="fas fa-undo"></i>
                                </button>
                                <button class="action-btn btn-edit" title="Düzenle" onclick="satisDuzenle('${satis.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn btn-delete" title="Sil" onclick="satisSil('${satis.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    
                    salesBody.appendChild(tr);
                });
            }
            
            updateSalesSummary(filteredSales);
        }
        // Barkod basma fonksiyonu
        function barkodBas(barkod) {
            if (!barkod) {
                Swal.fire('Hata', 'Barkod değeri girilmemiş!', 'error');
                return;
            }
            
            // Find the product by barcode
            let urunAdi = '';
            let marka = '';
            
            // stokListesi barkod ile indexlendiği için direkt erişim
            if (stokListesi[barkod]) {
                urunAdi = stokListesi[barkod].ad || '';
                marka = stokListesi[barkod].marka || '';
            } else {
                // Fallback: tüm listeyi tara
                for (const [id, urun] of Object.entries(stokListesi)) {
                    if (urun.barkod === barkod) {
                        urunAdi = urun.ad || '';
                        marka = urun.marka || '';
                        break;
                    }
                }
            }
            
            // Set the product info in the modal
            document.getElementById('barcode-product-name').textContent = urunAdi;
            document.getElementById('barcode-brand').textContent = marka;
            document.getElementById('barcode-number').value = barkod;
            
            // Clear previous barcode
            document.getElementById('barcode').innerHTML = '';
            
            // Generate the barcode
            try {
                JsBarcode("#barcode", barkod, {
                    format: "CODE128",
                    displayValue: true,
                    fontSize: 16,
                    height: 40,
                    margin: 10
                });
            } catch (e) {
                console.error("Barkod oluşturma hatası:", e);
                Swal.fire('Hata', 'Barkod oluşturulamadı!', 'error');
                return;
            }
            
            // Show the modal
            document.getElementById('barcodeModal').style.display = 'flex';
        }
        // Barkod yazdırma
        function printBarcode() {
            try {
                const barcodeContainer = document.querySelector('.barcode-container');
                if (!barcodeContainer) {
                    Swal.fire('Hata', 'Barkod önizlemesi bulunamadı!', 'error');
                    return;
                }
                
                const barcodeContent = barcodeContainer.innerHTML;
                const printWindow = window.open('', '_blank');
                
                if (!printWindow) {
                    Swal.fire('Hata', 'Yazdırma penceresi açılamadı! Tarayıcı popup engelliyor olabilir.', 'error');
                    return;
                }
                
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Barkod Yazdır</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                margin: 0;
                                text-align: center;
                                background: white;
                            }
                            .barcode-text h3 {
                                margin: 10px 0;
                                font-size: 18px;
                                color: black;
                            }
                            .barcode-text p {
                                margin: 5px 0;
                                font-size: 14px;
                                color: black;
                            }
                            svg {
                                margin: 10px 0;
                                display: block;
                                margin-left: auto;
                                margin-right: auto;
                            }
                            .barcode-actions {
                                display: none !important;
                            }
                            @media print {
                                body {
                                    margin: 0;
                                    padding: 10px;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        ${barcodeContent}
                        <script>
                            window.onload = function() {
                                window.print();
                                window.close();
                            };
                        <\/script>
                    
    <!-- Eksik Ürünler Modal (kaldırıldı) -->
    <div id="missingProductsModal" class="modal">
        <div class="modal-content" style="max-width: 1200px; width: 90%;">
            <div class="modal-header">
                <h2><i class="fas fa-exclamation-triangle"></i> Eksik Ürünler Yönetimi</h2>
                <span class="close" onclick="closeMissingProductsModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="missing-products-info">
                    <p>Bu bölümde eksik_urunler.json dosyasındaki ürünleri veritabanına ekleyebilirsiniz.</p>
                    <div class="missing-products-stats">
                        <div class="stat-card">
                            <h3 id="missingProductsCount">-</h3>
                            <p>Toplam Eksik Ürün</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="selectedProductsCount">0</h3>
                            <p>Seçilen Ürün</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="processedCount">-</h3>
                            <p>İşlenen</p>
                        </div>
                    </div>
                </div>
                
                <div class="missing-products-actions">
                    <button class="btn btn-info" onclick="loadMissingProducts()">
                        <i class="fas fa-search"></i> Eksik Ürünleri Listele
                    </button>
                    <button class="btn btn-warning" onclick="selectAllProducts()" id="selectAllBtn" style="display: none;">
                        <i class="fas fa-check-square"></i> Tümünü Seç
                    </button>
                    <button class="btn btn-secondary" onclick="clearSelection()" id="clearAllBtn" style="display: none;">
                        <i class="fas fa-square"></i> Seçimi Temizle
                    </button>
                    <button class="btn btn-primary" onclick="importSelectedProducts()" id="importSelectedBtn" style="display: none;">
                        <i class="fas fa-download"></i> Seçilenleri İçe Aktar
                    </button>
                    <button class="btn btn-success" onclick="importAllProducts()" id="importAllBtn" style="display: none;">
                        <i class="fas fa-download"></i> Tümünü İçe Aktar
                    </button>
                </div>

                <div id="missingProductsList" class="missing-products-list" style="display: none;">
                    <div class="search-filter" style="margin-bottom: 15px;">
                        <input type="text" id="productSearchInput" placeholder="Ürün ara (barkod, isim)..." 
                               onkeyup="filterProducts()" style="width: 100%; padding: 8px; margin-bottom: 10px;">
                        <div class="filter-options">
                            <label><input type="checkbox" id="filterWithBarcode" onchange="filterProducts()" checked> Barkodlu ürünler</label>
                            <label><input type="checkbox" id="filterWithoutBarcode" onchange="filterProducts()" checked> Barkodsuz ürünler</label>
                            <label><input type="checkbox" id="filterFromSales" onchange="filterProducts()" checked> Satış geçmişinden</label>
                        </div>
                    </div>
                    
                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th style="width: 40px;"><input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll()"></th>
                                    <th>Barkod</th>
                                    <th>Ürün Adı</th>
                                    <th>Marka</th>
                                    <th>Kaynak</th>
                                    <th>Tarih</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody id="missingProductsTableBody">
                                <!-- Ürünler buraya yüklenecek -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <div id="missingProductsResults" class="missing-products-results" style="display: none;">
                    <h3>İşlem Sonuçları:</h3>
                    <div id="missingProductsLog"></div>
                </div>
            </div>
        </div>
    </div>

</body>
                    </html>
                `);
                printWindow.document.close();
            } catch (error) {
                console.error('Yazdırma hatası:', error);
                Swal.fire('Hata', 'Barkod yazdırılırken bir hata oluştu!', 'error');
            }
        }
        
        // Müşteri satış geçmişini göster
        function showCustomerSales(musteriId) {
            const musteri = musteriler[musteriId];
            if (!musteri) return;
            
            document.getElementById('customerSalesTitle').textContent = `${musteri.ad} Satış Geçmişi`;
            
            const customerSalesBody = document.getElementById('customerSalesBody');
            customerSalesBody.innerHTML = '';
            
            // Müşteriye ait satışları filtrele
            const musteriSatislari = satisGecmisi.filter(satis => satis.musteriId === musteriId);
            
            if (musteriSatislari.length === 0) {
                customerSalesBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Bu müşteriye ait satış bulunamadı.</td></tr>';
            } else {
                // Duplicate satışları filtrele (barkod+tarih+miktar+fiyat)
                const uniq = new Map();
                musteriSatislari.forEach(s => {
                    const key = `${s.barkod}_${s.tarih}_${s.miktar}_${s.fiyat}`;
                    if (!uniq.has(key)) uniq.set(key, s);
                });
                Array.from(uniq.values()).forEach(satis => {
                    const tarih = new Date(satis.tarih);
                    const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()}`;
                    
                    let currentProductName = satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'));
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${tarihStr}</td>
                        <td title="Orijinal: ${satis.urunAdi}">${currentProductName}</td>
                        <td>${satis.miktar}</td>
                        <td>${(parseFloat(satis.fiyat) || 0).toFixed(2)}</td>
                        <td>${(parseFloat(satis.toplam) || ((parseFloat(satis.fiyat)||0) * (parseInt(satis.miktar)||0))).toFixed(2)}</td>
                        <td>${satis.borc ? 'Borç' : 'Nakit'}</td>
                        <td>
                            <button class="action-btn btn-edit" title="Düzenle" onclick="satisGecmisiDuzenle('${satis.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn btn-return" title="İade" onclick="urunIade('${satis.id}')">
                                <i class="fas fa-undo"></i>
                            </button>
                        </td>
                    `;
                    
                    customerSalesBody.appendChild(tr);
                });
            }
            
            document.getElementById('customerSalesModal').style.display = 'flex';
        }
        
        // Müşteri satış geçmişi düzenle
        async function satisGecmisiDuzenle(satisId) {
            try {
                const satis = satisGecmisi.find(s => s.id == satisId);
                if (!satis) {
                    showNotification('❌ Satış kaydı bulunamadı', 'error');
                    return;
                }

                const { value: formValues } = await Swal.fire({
                    title: 'Satış Geçmişi Düzenle',
                    html: `
                        <div style="text-align: left;">
                            <div class="form-group">
                                <label for="edit-satis-urun">Ürün Adı:</label>
                                <input type="text" id="edit-satis-urun" class="swal2-input" value="${satis.urunAdi || satis.urun_adi || ''}" style="margin: 5px 0;">
                            </div>
                            <div class="form-group">
                                <label for="edit-satis-miktar">Miktar:</label>
                                <input type="number" id="edit-satis-miktar" class="swal2-input" value="${satis.miktar || 1}" min="1" style="margin: 5px 0;">
                            </div>
                            <div class="form-group">
                                <label for="edit-satis-fiyat">Birim Fiyat:</label>
                                <input type="number" id="edit-satis-fiyat" class="swal2-input" value="${satis.fiyat || 0}" step="0.01" min="0" style="margin: 5px 0;">
                            </div>
                            <div class="form-group">
                                <label for="edit-satis-tarih">Tarih:</label>
                                <input type="date" id="edit-satis-tarih" class="swal2-input" value="${new Date(satis.tarih).toISOString().split('T')[0]}" style="margin: 5px 0;">
                            </div>
                        </div>
                    `,
                    focusConfirm: false,
                    showCancelButton: true,
                    confirmButtonText: 'Güncelle',
                    cancelButtonText: 'İptal',
                    preConfirm: () => {
                        const urunAdi = document.getElementById('edit-satis-urun').value;
                        const miktar = parseInt(document.getElementById('edit-satis-miktar').value);
                        const fiyat = parseFloat(document.getElementById('edit-satis-fiyat').value);
                        const tarih = document.getElementById('edit-satis-tarih').value;

                        if (!urunAdi.trim()) {
                            Swal.showValidationMessage('Ürün adı gerekli');
                            return false;
                        }
                        if (isNaN(miktar) || miktar <= 0) {
                            Swal.showValidationMessage('Miktar 1 veya daha büyük olmalı');
                            return false;
                        }
                        if (isNaN(fiyat) || fiyat < 0) {
                            Swal.showValidationMessage('Fiyat 0 veya daha büyük olmalı');
                            return false;
                        }

                        return { urunAdi, miktar, fiyat, tarih };
                    }
                });

                if (formValues) {
                    const updateData = {
                        urunAdi: formValues.urunAdi,
                        miktar: formValues.miktar,
                        fiyat: formValues.fiyat,
                        toplam: formValues.miktar * formValues.fiyat,
                        tarih: formValues.tarih
                    };

                    const response = await fetch(`${API_BASE}/api/satis-guncelle/${satisId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });

                    const result = await response.json();
                    if (result.success) {
                        showNotification('✅ Satış kaydı başarıyla güncellendi', 'success');
                        
                        // Update local data
                        const satisIndex = satisGecmisi.findIndex(s => s.id == satisId);
                        if (satisIndex !== -1) {
                            satisGecmisi[satisIndex] = { ...satisGecmisi[satisIndex], ...updateData };
                        }
                        
                        // Refresh the customer sales view
                        showCustomerSales(satis.musteriId);
                    } else {
                        showNotification('❌ Satış kaydı güncellenemedi: ' + (result.error || 'Bilinmeyen hata'), 'error');
                    }
                }
            } catch (error) {
                console.error('Satış düzenleme hatası:', error);
                showNotification('❌ Satış düzenlenirken hata oluştu', 'error');
            }
        }

        // Müşteri arama
        function musteriAramaYap() {
            const aramaMetni = document.getElementById('customerSearchInput').value.toLowerCase().replace(/\s+/g, '');
            const rows = document.querySelectorAll('#musteriTablosu tbody tr');
            
            rows.forEach(row => {
                const rowText = row.textContent.toLowerCase().replace(/\s+/g, '');
                if (rowText.includes(aramaMetni)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
        
        // Borç arama
        function borcAramaYap() {
            const aramaMetni = document.getElementById('debtSearchInput').value.toLowerCase().replace(/\s+/g, '');
            const rows = document.querySelectorAll('#borcTablosu tbody tr');
            
            rows.forEach(row => {
                const rowText = row.textContent.toLowerCase().replace(/\s+/g, '');
                if (rowText.includes(aramaMetni)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
        // Müşteri tablosunu sırala
        function sortCustomerTable(column) {
            // Sıralama yönünü belirle
            if (currentCustomerSort.column === column) {
                currentCustomerSort.direction = currentCustomerSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentCustomerSort.column = column;
                currentCustomerSort.direction = 'asc';
            }
            
            musteriTablosunuGuncelle();
        }
        
        // Tabloyu sırala
        function sortTable(column) {
            // Sıralama yönünü belirle
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            
            stokTablosunuGuncelle();
        }
        
        // Satış geçmişi tablosunu sırala
        function sortSalesTable(column) {
            // Sıralama yönünü belirle
            if (currentSalesSort.column === column) {
                currentSalesSort.direction = currentSalesSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSalesSort.column = column;
                currentSalesSort.direction = 'asc';
            }
            
            satisTablosunuGuncelle();
        }
        
        // Senkronizasyon durumunu güncelle - Geliştirilmiş
        function updateSyncStatus(status, text) {
            const indicator = document.getElementById('syncIndicator');
            const statusText = document.getElementById('syncText');
            
            if (indicator) {
                indicator.className = `sync-indicator ${status}`;
                
                // Animasyon ekle
                if (status === 'online') {
                    indicator.style.animation = 'pulse 2s infinite';
                } else {
                    indicator.style.animation = 'none';
                }
            }
            
            if (statusText) {
                statusText.textContent = text;
            }
            
            // Bildirim göster
            if (status === 'online') {
                showNotification('🟢 Bağlantı kuruldu', 'success');
            } else if (status === 'offline') {
                showNotification('🔴 Bağlantı kesildi', 'warning');
            }
        }

        // Pulse animasyonu ekle
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
        
        // Ana menüyü aç/kapat - Modern hamburger animasyon ile
        function toggleMainMenu() {
            const dropdown = document.getElementById('mainMenuDropdown');
            const button = document.getElementById('mainMenuButton');
            
            dropdown.classList.toggle('show');
            button.classList.toggle('active');
            
            // Smooth animasyon için timeout
            if (dropdown.classList.contains('show')) {
                dropdown.style.display = 'block';
                setTimeout(() => {
                    dropdown.style.opacity = '1';
                    dropdown.style.transform = 'translateY(0)';
                }, 10);
            } else {
                dropdown.style.opacity = '0';
                dropdown.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    dropdown.style.display = 'none';
                }, 200);
            }
        }
        
        // Menü dışına tıklandığında kapat - iyileştirilmiş
        document.addEventListener('click', function(event) {
            const button = document.getElementById('mainMenuButton');
            const dropdown = document.getElementById('mainMenuDropdown');
            
            if (!button.contains(event.target) && !dropdown.contains(event.target)) {
                dropdown.classList.remove('show');
                button.classList.remove('active');
                dropdown.style.opacity = '0';
                dropdown.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    dropdown.style.display = 'none';
                }, 200);
            }
        });
        
        // Ayarlar modali göster
        function showSettings() {
            document.getElementById('mainMenuDropdown').classList.remove('show');
            Swal.fire({
                title: 'Ayarlar',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Stok Uyarı Seviyesi:</strong> 5 ve altı</p>
                        <p><strong>Bildirim Süresi:</strong> 5 dakika</p>
                        <p><strong>Tema:</strong> Varsayılan</p>
                        <p><strong>Dil:</strong> Türkçe</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Tamam'
            });
        }
        
        // Yedekleme modali göster
        function showBackup() {
            document.getElementById('mainMenuDropdown').classList.remove('show');
            Swal.fire({
                title: 'Veri Yedekleme',
                html: `
                    <div style="text-align: left;">
                        <p>Verilerinizi güvenli bir şekilde yedekleyin:</p>
                        <ul>
                            <li>Stok verileri</li>
                            <li>Satış geçmişi</li>
                            <li>Müşteri bilgileri</li>
                        </ul>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Excel Olarak İndir',
                cancelButtonText: 'İptal'
            }).then((result) => {
                if (result.isConfirmed) {
                    exportToExcel();
                }
            });
        }
        
        // Hakkında modali göster
        function showAbout() {
            document.getElementById('mainMenuDropdown').classList.remove('show');
            Swal.fire({
                title: 'Hakkında',
                html: `
                    <div style="text-align: center;">
                        <h3>Otomotiv Stok ve Satış Yönetimi</h3>
                        <p><strong>Sürüm:</strong> 2.0</p>
                        <p><strong>Geliştirici:</strong></p>
                        <p><strong>Son Güncelleme:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
                        <hr>
                        <p style="font-size: 14px; color: #666;">
                            Bu uygulama otomotiv parça satışı ve stok yönetimi için tasarlanmıştır.
                        </p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Tamam'
            });
        }
        // Satış düzenle fonksiyonu
        function satisDuzenle(satisId) {
            const satisIndex = satisGecmisi.findIndex(s => s.id === satisId);
            if (satisIndex === -1) return;
            const satis = satisGecmisi[satisIndex];
            
            Swal.fire({
                title: 'Satışı Düzenle',
                html: `
                    <div class="form-group">
                        <label>Ürün Adı</label>
                        <input type="text" id="edit-urunAdi" class="form-control" value="${satis.urunAdi}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Miktar</label>
                        <input type="number" id="edit-miktar" class="form-control" min="1" value="${satis.miktar}">
                    </div>
                    <div class="form-group">
                        <label>Satış Fiyatı (₺)</label>
                        <input type="number" id="edit-fiyat" class="form-control" min="0" step="0.01" value="${satis.fiyat}">
                    </div>
                    <div class="form-group">
                        <label>Açıklama</label>
                        <input type="text" id="edit-aciklama" class="form-control" value="${satis.aciklama || ''}">
                    </div>
                    <div class="form-group">
                        <label>Müşteri</label>
                        <select id="edit-musteri" class="form-control">
                            <option value="">Seçili değil</option>
                            ${Object.entries(musteriler).map(([id, m]) => `<option value="${id}" ${satis.musteriId === id ? 'selected' : ''}>${m.ad}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Borçlu Satış</label>
                        <input type="checkbox" id="edit-borc" ${satis.borc ? 'checked' : ''}>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Kaydet',
                cancelButtonText: 'İptal',
                preConfirm: () => {
                    const miktar = parseInt(document.getElementById('edit-miktar').value);
                    const fiyat = parseFloat(document.getElementById('edit-fiyat').value);
                    const aciklama = document.getElementById('edit-aciklama').value;
                    const musteriId = document.getElementById('edit-musteri').value || null;
                    const borc = document.getElementById('edit-borc').checked;
                    if (isNaN(miktar) || miktar <= 0) {
                        Swal.showValidationMessage('Miktar 1 veya daha büyük olmalı');
                        return false;
                    }
                    if (isNaN(fiyat) || fiyat < 0) {
                        Swal.showValidationMessage('Fiyat 0 veya daha büyük olmalı');
                        return false;
                    }
                    return { miktar, fiyat, aciklama, musteriId, borc };
                }
            }).then(result => {
                if (result.isConfirmed && result.value) {
                    const { miktar, fiyat, aciklama, musteriId, borc } = result.value;
                    satisGecmisi[satisIndex].miktar = miktar;
                    satisGecmisi[satisIndex].fiyat = fiyat;
                    satisGecmisi[satisIndex].toplam = fiyat * miktar;
                    satisGecmisi[satisIndex].aciklama = aciklama;
                    satisGecmisi[satisIndex].musteriId = musteriId;
                    satisGecmisi[satisIndex].borc = borc;
                    saveData();
                    satisTablosunuGuncelle();
                    Swal.fire({
                        icon: 'success',
                        title: 'Satış güncellendi!',
                        showConfirmButton: false,
                        timer: 1500
                    });
                }
            });
        }
        
        // Müşteri detaylarını göster
        function showCustomerDetails(customerId) {
            const musteri = musteriler[customerId];
            if (!musteri) return;
            
            // Müşteri satış geçmişini getir
            const musteriSatislari = satisGecmisi.filter(s => s.musteriId === customerId);
            let toplamBorc = 0;
            let toplamNakit = 0;
            
            musteriSatislari.forEach(satis => {
                if (satis.borc) {
                    toplamBorc += satis.toplam;
                } else {
                    toplamNakit += satis.toplam;
                }
            });
            
            // Müşteri detaylarını oluştur
            const detailsContent = `
                <h3>${musteri.ad}</h3>
                <p><strong>Telefon:</strong> ${musteri.telefon || '-'}</p>
                <p><strong>Adres:</strong> ${musteri.adres || '-'}</p>
                <p><strong>Açıklama:</strong> ${musteri.aciklama || '-'}</p>
                            <p><strong>Toplam Nakit Satış:</strong> ${(toplamNakit || 0).toFixed(2)} ₺</p>
            <p><strong>Toplam Borç:</strong> ${(toplamBorc || 0).toFixed(2)} ₺</p>
                
                <div class="customer-sales-list">
                    <h4>Satış Geçmişi</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Tarih</th>
                                <th>Ürün</th>
                                <th>Miktar</th>
                                <th>Fiyat</th>
                                <th>Toplam</th>
                                <th>Tür</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${musteriSatislari.map(satis => {
                                const tarih = new Date(satis.tarih);
                                const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()}`;
                                return `
                                    <tr>
                                        <td>${tarihStr}</td>
                                        <td>${satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'))}</td>
                                        <td>${satis.miktar}</td>
                                        <td>${satis.fiyat.toFixed(2)}</td>
                                        <td>${satis.toplam.toFixed(2)}</td>
                                        <td>${satis.borc ? 'Borç' : 'Nakit'}</td>
                                        <td>
                                            <button class="btn btn-danger btn-sm" onclick="deleteCustomerSale('${customerId}', '${satis.id}')" title="Bu satışı sil">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="generateCustomerPDF('${customerId}')">
                        <i class="fas fa-file-pdf"></i> PDF Oluştur
                    </button>
                </div>
            `;
            
            document.getElementById('customerDetailsContent').innerHTML = detailsContent;
            document.getElementById('customerDetailsModal').style.display = 'flex';
        }
        
                // Müşteri satışını sil
        async function deleteCustomerSale(customerId, saleId) {
            Swal.fire({
                title: 'Emin misiniz?',
                text: 'Bu satış kaydını silmek istediğinizden emin misiniz?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'İptal'
            }).then(async (dialog) => {
                if (!dialog.isConfirmed) return;
                try {
                    const response = await fetch(`${API_BASE}/api/satis-sil/${saleId}`, { method: 'DELETE' });
                    const apiResult = await response.json();
                    if (!response.ok || !apiResult.success) throw new Error(apiResult.message || 'Satış silinemedi');

                    // FIX: Only delete locally, don't emit socket event to prevent double deletion
                    const saleIndex = satisGecmisi.findIndex(s => s.id == saleId || s.id === parseInt(saleId));
                    if (saleIndex !== -1) {
                        satisGecmisi.splice(saleIndex, 1);
                    }

                    stokTablosunuGuncelle();
                    satisTablosunuGuncelle();
                    guncellenenVerileriKaydet();
                    showCustomerDetails(customerId);

                    showNotification('🗑️ Satış silindi', 'success');
                    Swal.fire('Başarılı', 'Satış kaydı silindi.', 'success');
                } catch (error) {
                    console.error('Satış silme hatası:', error);
                    Swal.fire('Hata', error.message || 'Satış silinirken hata oluştu.', 'error');
                }
            });
        }
        
        // Müşteri için PDF oluştur
        function generateCustomerPDF(customerId) {
            const musteri = musteriler[customerId];
            if (!musteri) return;
            
            // Müşteri satış geçmişini getir
            const musteriSatislari = satisGecmisi.filter(s => s.musteriId === customerId);
            
            // jsPDF kullanarak PDF oluştur
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Başlık
            doc.setFontSize(18);
            doc.text(`${musteri.ad} Müşteri Raporu`, 105, 15, null, null, 'center');
            
            // Müşteri bilgileri
            doc.setFontSize(12);
            doc.text(`Telefon: ${musteri.telefon || '-'}`, 15, 25);
            doc.text(`Adres: ${musteri.adres || '-'}`, 15, 32);
            
            // Satış tablosu başlığı
            doc.setFontSize(14);
            doc.text('Satış Geçmişi', 15, 45);
            
            // Tablo başlıkları
            const headers = [['Tarih', 'Ürün', 'Miktar', 'Fiyat', 'Toplam', 'Tür']];
            
            // Tablo verileri
            const data = musteriSatislari.map(satis => {
                const tarih = new Date(satis.tarih);
                const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()}`;
                return [
                    tarihStr,
                    satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-')),
                    satis.miktar,
                    `${satis.fiyat.toFixed(2)} ₺`,
                    `${satis.toplam.toFixed(2)} ₺`,
                    satis.borc ? 'Borç' : 'Nakit'
                ];
            });
            
            // Tabloyu ekle
            doc.autoTable({
                startY: 50,
                head: headers,
                body: data,
                theme: 'grid',
                styles: { fontSize: 10 },
                headStyles: { fillColor: [44, 111, 187] }
            });
            // Toplamları ekle
            const toplamNakit = musteriSatislari.filter(s => !s.borc).reduce((sum, s) => sum + s.toplam, 0);
            const toplamBorc = musteriSatislari.filter(s => s.borc).reduce((sum, s) => sum + s.toplam, 0);
            const toplamGenel = toplamNakit + toplamBorc;
            
            const lastY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(12);
            doc.text(`Toplam Nakit: ${toplamNakit.toFixed(2)} ₺`, 15, lastY);
            doc.text(`Toplam Borç: ${toplamBorc.toFixed(2)} ₺`, 15, lastY + 7);
            doc.text(`Genel Toplam: ${toplamGenel.toFixed(2)} ₺`, 15, lastY + 14);
            
            // PDF'i indir
            doc.save(`${musteri.ad}_Satis_Raporu.pdf`);
        }
        
        // Atilgan'da ara (POST ile)
        function searchAtilganWithBarcode(barkod) {
            if (!barkod) {
                Swal.fire('Uyarı', 'Lütfen bir barkod girin!', 'warning');
                return;
            }
            
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'https://www.atilgan.online/View/UrunListe';
            form.target = '_blank';
            
            const searchField = document.createElement('input');
            searchField.type = 'hidden';
            searchField.name = 'search';
            searchField.value = barkod;
            
            form.appendChild(searchField);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        }
        
        // Prensoto'da ara (POST ile)
        function searchPrensotoWithBarcode(barkod) {
            if (!barkod) {
                Swal.fire('Uyarı', 'Lütfen bir barkod girin!', 'warning');
                return;
            }
            
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'https://b2b.prensoto.com/Search.aspx';
            form.target = '_blank';
            
            const searchField = document.createElement('input');
            searchField.type = 'hidden';
            searchField.name = 'ctl00$MainContent$txtSearch';
            searchField.value = barkod;
            
            form.appendChild(searchField);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        }
        
        // Başbuğ'da ara (GET ile)
        function searchBasbugWithBarcode(barkod) {
            if (!barkod) {
                Swal.fire('Uyarı', 'Lütfen bir barkod girin!', 'warning');
                return;
            }
            window.open(`https://www.b4bbasbug.com/Arama/UrunArama?TumAlanlarda=${barkod}`, '_blank');
        }
        // Tarihe göre filtrele
        function filterByDate() {
            const startDateInput = document.getElementById('startDate').value;
            const endDateInput = document.getElementById('endDate').value;
            
            if (!startDateInput || !endDateInput) {
                Swal.fire('Uyarı', 'Lütfen başlangıç ve bitiş tarihlerini seçin!', 'warning');
                return;
            }
            
            const startDate = new Date(startDateInput);
            const endDate = new Date(endDateInput);
            endDate.setDate(endDate.getDate() + 1); // Bitiş tarihini dahil etmek için
            
            const filteredSales = satisGecmisi.filter(satis => {
                const saleDate = new Date(satis.tarih);
                return saleDate >= startDate && saleDate <= endDate;
            });
            
            const salesBody = document.getElementById('salesBody');
            salesBody.innerHTML = '';
            
            if (filteredSales && filteredSales.length > 0) {
                filteredSales.forEach(satis => {
                    const tr = document.createElement('tr');
                    const tarih = new Date(satis.tarih);
                    const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()} ${tarih.getHours().toString().padStart(2, '0')}:${tarih.getMinutes().toString().padStart(2, '0')}`;
                    
                    // Müşteri adını bul
                    let musteriAdi = '-';
                    if (satis.musteriId && musteriler[satis.musteriId]) {
                        musteriAdi = musteriler[satis.musteriId].ad;
                    }
                    
                    tr.innerHTML = `
                        <td>${tarihStr}</td>
                        <td>${satis.barkod}</td>
                        <td>${satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'))}</td>
                        <td>${satis.miktar}</td>
                        <td>${(parseFloat(satis.alisFiyati) || 0) > 0 ? (parseFloat(satis.alisFiyati)).toFixed(2) : '-'}</td>
                        <td>${(parseFloat(satis.fiyat) || 0).toFixed(2)}</td>
                        <td>${(parseFloat(satis.toplam) || ((parseFloat(satis.fiyat) || 0) * (parseInt(satis.miktar) || 0))).toFixed(2)}</td>
                        <td>${satis.borc ? '<span class="credit-indicator">Borç</span>' : 'Nakit'}</td>
                        <td>${musteriAdi}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-return" title="İade" onclick="urunIade('${satis.id}')">
                                    <i class="fas fa-undo"></i>
                                </button>
                                <button class="action-btn btn-edit" title="Düzenle" onclick="satisDuzenle('${satis.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn btn-delete" title="Sil" onclick="satisSil('${satis.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    
                    salesBody.appendChild(tr);
                });
            } else {
                salesBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Bu tarih aralığında satış bulunamadı.</td></tr>';
            }
            
            updateSalesSummary(filteredSales);
        }
        
        // Çok satanları göster
        function showBestSellers() {
            if (!satisGecmisi || satisGecmisi.length === 0) {
                Swal.fire('Bilgi', 'Henüz satış kaydı bulunmamaktadır.', 'info');
                return;
            }
            
            // Son 1 ayın tarihini hesapla
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            
            // Ürün bazında satış miktarlarını hesapla (sadece son 1 ay)
            let productSales = {};
            
            satisGecmisi.forEach(satis => {
                const satisTarihi = new Date(satis.tarih);
                if (satisTarihi >= oneMonthAgo) {
                    const productKey = satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'));
                    if (!productSales[productKey]) {
                        productSales[productKey] = {
                            sales: 0,
                            revenue: 0,
                            barkod: '',
                            price: 0
                        };
                    }
                    productSales[productKey].sales += satis.miktar;
                    productSales[productKey].revenue += satis.toplam || 0;
                    
                    // Find product details
                    for (const [id, urun] of Object.entries(stokListesi)) {
                        if (urun.ad === productKey) {
                            productSales[productKey].barkod = urun.barkod || id;
                            productSales[productKey].price = urun.satisFiyati || 0;
                            break;
                        }
                    }
                }
            });
            
            // Convert to array, filter for products with more than 5 sales, and sort by sales
            const sortedProducts = Object.entries(productSales)
                .map(([product, data]) => ({
                    name: product,
                    sales: data.sales,
                    revenue: data.revenue,
                    barkod: data.barkod,
                    price: data.price
                }))
                .filter(product => product.sales > 5) // Only show products sold more than 5 times
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 15);
            // Create modal with sorting options
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-star"></i> En Çok Satan Ürünler</h2>
                        <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 15px;">
                            <label style="margin-right: 10px;">Sıralama:</label>
                            <select id="bestSellersSort" onchange="sortBestSellers()" class="form-control" style="display: inline-block; width: auto;">
                                <option value="sales">Satış Adedi (Azalan)</option>
                                <option value="sales-asc">Satış Adedi (Artan)</option>
                                <option value="revenue">Gelir (Azalan)</option>
                                <option value="revenue-asc">Gelir (Artan)</option>
                                <option value="name">Ürün Adı (A-Z)</option>
                                <option value="name-desc">Ürün Adı (Z-A)</option>
                            </select>
                        </div>
                        <div id="bestSellersList" class="best-sellers-list">
                            ${generateBestSellersHTML(sortedProducts)}
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Store data for sorting
            window.bestSellersData = sortedProducts;
        }
        
        // Generate HTML for best sellers list
        function generateBestSellersHTML(products) {
            return products.map((product, index) => `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border-color);">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: var(--text-primary);">${index + 1}. ${product.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                            Satış Adedi: ${product.sales} | Gelir: ${product.revenue.toFixed(2)} ₺ | Fiyat: ${product.price.toFixed(2)} ₺
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-success btn-sm" title="Hızlı Satış" onclick="quickSell('${product.barkod}')">
                            <i class="fas fa-cash-register"></i> Sat
                        </button>
                        <button class="btn btn-info btn-sm" title="Ürün Detayları" onclick="showProductDetails('${product.barkod}')">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </li>
            `).join('');
        }
        // Sort best sellers
        function sortBestSellers() {
            if (!window.bestSellersData) return;
            
            const sortType = document.getElementById('bestSellersSort').value;
            let sorted = [...window.bestSellersData];
            
            switch(sortType) {
                case 'sales':
                    sorted.sort((a, b) => b.sales - a.sales);
                    break;
                case 'sales-asc':
                    sorted.sort((a, b) => a.sales - b.sales);
                    break;
                case 'revenue':
                    sorted.sort((a, b) => b.revenue - a.revenue);
                    break;
                case 'revenue-asc':
                    sorted.sort((a, b) => a.revenue - b.revenue);
                    break;
                case 'name':
                    sorted.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'name-desc':
                    sorted.sort((a, b) => b.name.localeCompare(a.name));
                    break;
            }
            
            document.getElementById('bestSellersList').innerHTML = generateBestSellersHTML(sorted);
        }
        
        // Quick sell function
        function quickSell(barkod) {
            // Find product details
            let product = null;
            for (const [id, urun] of Object.entries(stokListesi)) {
                if (urun.barkod === barkod || id === barkod) {
                    product = urun;
                    break;
                }
            }
            
            if (!product) {
                Swal.fire('Hata', 'Ürün bulunamadı!', 'error');
                return;
            }
            
            // Show quick sell modal
            Swal.fire({
                title: 'Hızlı Satış',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Ürün:</strong> ${product.ad}</p>
                        <p><strong>Mevcut Stok:</strong> ${product.miktar}</p>
                        <p><strong>Satış Fiyatı:</strong> ${product.satisFiyati} ₺</p>
                    </div>
                    <div style="margin-top: 20px;">
                        <label>Satış Miktarı:</label>
                        <input type="number" id="quickSellAmount" class="swal2-input" value="1" min="1" max="${product.miktar}">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Sat',
                cancelButtonText: 'İptal',
                preConfirm: () => {
                    const amount = parseInt(document.getElementById('quickSellAmount').value);
                    if (!amount || amount < 1 || amount > product.miktar) {
                        Swal.showValidationMessage('Geçerli bir miktar girin!');
                        return false;
                    }
                    return amount;
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    // Perform the sale
                    urunSat(barkod, result.value);
                }
            });
        }
        
        // Satış analizi modalını göster
        function showSalesAnalysisModal() {
            if (!satisGecmisi || satisGecmisi.length === 0) {
                Swal.fire('Bilgi', 'Henüz satış kaydı bulunmamaktadır.', 'info');
                return;
            }
            
            // Grafikleri oluştur
            renderCharts();
            
            // Modalı göster
            document.getElementById('salesAnalysisModal').style.display = 'flex';
        }
        
        // Grafikleri oluştur
        function renderCharts() {
            // En çok satılan ürünler grafiği
            renderTopProductsChart();
            
            // Ödeme türü dağılım grafiği
            renderPaymentTypeChart();
            
            // En çok satış yapan müşteriler grafiği
            renderTopCustomersChart();
        }
        // En çok satılan ürünler grafiği
        function renderTopProductsChart() {
            // Ürün bazında satış miktarlarını hesapla
            let productSales = {};
            
            satisGecmisi.forEach(satis => {
                const productKey = satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'));
                if (!productSales[productKey]) {
                    productSales[productKey] = 0;
                }
                productSales[productKey] += satis.miktar;
            });
            
            // En çok satan 5 ürünü belirle
            const sortedProducts = Object.entries(productSales)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            const labels = sortedProducts.map(item => item[0]);
            const data = sortedProducts.map(item => item[1]);
            
            const ctx = document.getElementById('topProductsChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Satış Adedi',
                        data: data,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Ödeme türü dağılım grafiği
        function renderPaymentTypeChart() {
            let cashCount = 0;
            let creditCount = 0;
            
            satisGecmisi.forEach(satis => {
                if (satis.borc) {
                    creditCount++;
                } else {
                    cashCount++;
                }
            });
            
            const ctx = document.getElementById('paymentTypeChart').getContext('2d');
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Nakit', 'Borç'],
                    datasets: [{
                        data: [cashCount, creditCount],
                        backgroundColor: ['#10b981', '#059669'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
        
        // En çok satış yapan müşteriler grafiği
        function renderTopCustomersChart() {
            // Müşteri bazında toplam satışları hesapla
            let customerSales = {};
            
            satisGecmisi.forEach(satis => {
                if (satis.musteriId && musteriler[satis.musteriId]) {
                    const customerName = musteriler[satis.musteriId].ad;
                    if (!customerSales[customerName]) {
                        customerSales[customerName] = 0;
                    }
                    customerSales[customerName] += satis.toplam;
                }
            });
            
            // En çok satış yapan 5 müşteriyi belirle
            const sortedCustomers = Object.entries(customerSales)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            const labels = sortedCustomers.map(item => item[0]);
            const data = sortedCustomers.map(item => item[1]);
            
            const ctx = document.getElementById('topCustomersChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Toplam Satış (₺)',
                        data: data,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Modalı kapat
        function closeModal() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
        
        // Atilgan'da ara
        function searchAtilgan() {
            const barkod = document.getElementById('barkod').value.trim();
            if (!barkod) {
                Swal.fire('Uyarı', 'Lütfen bir barkod girin!', 'warning');
                return;
            }
            searchAtilganWithBarcode(barkod);
        }
        
        // Prensoto'da ara
        function searchPrensoto() {
            const barkod = document.getElementById('barkod').value.trim();
            if (!barkod) {
                Swal.fire('Uyarı', 'Lütfen bir barkod girin!', 'warning');
                return;
            }
            searchPrensotoWithBarcode(barkod);
        }
        
        // Başbuğ'da ara
        function searchBasbug() {
            const barkod = document.getElementById('barkod').value.trim();
            if (!barkod) {
                Swal.fire('Uyarı', 'Lütfen bir barkod girin!', 'warning');
                return;
            }
            searchBasbugWithBarcode(barkod);
        }
        // Borç ekle - FIX: API entegrasyonu ile
        async function borcEkle() {
            // Devam eden işlemi kaydet
            savePendingOperation('borc_ekleme', {
                alacakli: document.getElementById('alacakliAdi').value.trim(),
                miktar: document.getElementById('borcMiktari').value,
                aciklama: document.getElementById('borcAciklama').value.trim(),
                tarih: document.getElementById('borcTarihi').value,
                odemeTarihi: document.getElementById('borcOdemeTarihi').value,
                durum: document.getElementById('borcDurumu').value
            });
            
            const alacakli = document.getElementById('alacakliAdi').value.trim();
            const miktar = parseFloat(document.getElementById('borcMiktari').value) || 0;
            const aciklama = document.getElementById('borcAciklama').value.trim();
            const tarih = document.getElementById('borcTarihi').value;
            const odemeTarihi = document.getElementById('borcOdemeTarihi').value;
            const durum = document.getElementById('borcDurumu').value;
            
            if (!alacakli || miktar <= 0) {
                clearPendingOperation(); // Hata durumunda işlemi temizle
                Swal.fire('Hata', 'Alacaklı adı ve borç miktarı zorunludur.', 'error');
                return;
            }
            
            try {
                let id;
                let isUpdate = false;
                
                if (editingDebtId && borclarim[editingDebtId]) {
                    id = editingDebtId;
                    isUpdate = true;
                } else {
                    id = 'debt_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
                }
                
                const borcData = {
                    id,
                    musteriId: alacakli, // Using alacakli as musteriId for now
                    tutar: miktar,
                    aciklama: aciklama || '',
                    tarih: tarih || new Date().toISOString(),
                    odemeTarihi: odemeTarihi || null,
                    durum: durum || 'Ödenmedi'
                };
                
                // Send to API - FIX: Added API integration for debt management
                const endpoint = isUpdate ? '/api/borc-guncelle' : '/api/borc-ekle';
                const method = isUpdate ? 'PUT' : 'POST';
                
                const response = await fetch(`${API_BASE}${endpoint}`, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(borcData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Update local data using backend response
                    const backendData = result.data || {};
                    borclarim[id] = {
                        id,
                        alacakli: backendData.musteriId || alacakli,
                        miktar: backendData.tutar || miktar,
                        aciklama: backendData.aciklama || aciklama || null,
                        tarih: backendData.tarih ? backendData.tarih.split('T')[0] : (tarih || new Date().toISOString().split('T')[0]),
                        odemeTarihi: backendData.odemeTarihi || odemeTarihi || null,
                        durum: backendData.durum || durum || 'Ödenmedi'
                    };
                    
                    // Emit real-time sync to other clients
                    socket.emit('dataUpdate', {
                        type: isUpdate ? 'borc-update' : 'borc-add',
                        data: borclarim[id]
                    });
                    
                    // Also emit to dataUpdated for consistency
                    socket.emit('dataUpdated', {
                        type: isUpdate ? 'borc-update' : 'borc-add',
                        data: borclarim[id],
                        timestamp: new Date().toISOString()
                    });
                    
                    guncellenenVerileriKaydet();
                    borcTablosunuGuncelle();
                    borcFormTemizle();
                    editingDebtId = null;
                    
                    // İşlem başarılı, pending operation'ı temizle
                    clearPendingOperation();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Başarılı',
                        text: isUpdate ? 'Borç güncellendi.' : 'Borç eklendi.',
                        showConfirmButton: false,
                        timer: 1500
                    });
                } else {
                    throw new Error(result.message || 'Borç kaydedilemedi');
                }
                
            } catch (error) {
                console.error('Borç kaydetme hatası:', error);
                clearPendingOperation(); // Hata durumunda işlemi temizle
                Swal.fire('Hata', 'Borç kaydedilirken hata oluştu: ' + error.message, 'error');
            }
        }
        
        // Borç formunu temizle
        function borcFormTemizle() {
            document.getElementById('alacakliAdi').value = '';
            document.getElementById('borcMiktari').value = '';
            document.getElementById('borcAciklama').value = '';
            document.getElementById('borcTarihi').value = new Date().toISOString().split('T')[0];
            document.getElementById('borcOdemeTarihi').value = '';
            document.getElementById('borcDurumu').value = 'Ödenmedi';
            
            editingDebtId = null;
        }
        
        // Satış düzenleme - Inline modal ile
        async function satisDuzenle(satisId) {
            console.log('🔄 Satış düzenleme:', satisId);
            
            // Satışı farklı yollarla bulmaya çalış
            let satis = satisGecmisi.find(s => s.id == satisId || s.id === satisId);
            
            if (!satis) {
                satis = satisGecmisi.find(s => String(s.id) === String(satisId));
            }
            
            if (!satis) {
                console.error('❌ Satış bulunamadı:', { satisId });
                Swal.fire('Hata', `Satış bulunamadı. ID: ${satisId}`, 'error');
                return;
            }
            
            // Müşteri listesini oluştur
            let musteriOptions = '<option value="">Müşteri Seç</option>';
            for (const [id, musteri] of Object.entries(musteriler)) {
                const selected = satis.musteriId === id ? 'selected' : '';
                musteriOptions += `<option value="${id}" ${selected}>${musteri.ad}</option>`;
            }
            
            const { value: formValues } = await Swal.fire({
                title: 'Satış Düzenle',
                html: `
                    <div style="text-align: left;">
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="edit-satis-urun">Ürün Adı:</label>
                            <input type="text" id="edit-satis-urun" class="swal2-input" value="${satis.urunAdi || satis.urun_adi || ''}" style="margin: 5px 0;">
                        </div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="edit-satis-miktar">Miktar:</label>
                            <input type="number" id="edit-satis-miktar" class="swal2-input" value="${satis.miktar || 1}" min="1" style="margin: 5px 0;">
                        </div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="edit-satis-fiyat">Satış Fiyatı:</label>
                            <input type="number" id="edit-satis-fiyat" class="swal2-input" value="${satis.fiyat || 0}" step="0.01" min="0" style="margin: 5px 0;">
                        </div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="edit-satis-musteri">Müşteri:</label>
                            <select id="edit-satis-musteri" class="swal2-input" style="margin: 5px 0;">
                                ${musteriOptions}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label>
                                <input type="checkbox" id="edit-satis-borc" ${satis.borc ? 'checked' : ''}> Borç Satışı
                            </label>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Kaydet',
                cancelButtonText: 'İptal',
                preConfirm: () => {
                    return {
                        urunAdi: document.getElementById('edit-satis-urun').value,
                        miktar: parseInt(document.getElementById('edit-satis-miktar').value),
                        fiyat: parseFloat(document.getElementById('edit-satis-fiyat').value),
                        musteriId: document.getElementById('edit-satis-musteri').value,
                        borc: document.getElementById('edit-satis-borc').checked
                    }
                }
            });

            if (formValues) {
                try {
                    // Satış kaydını güncelle
                    const satisIndex = satisGecmisi.findIndex(s => s.id == satisId);
                    if (satisIndex !== -1) {
                        satisGecmisi[satisIndex] = {
                            ...satisGecmisi[satisIndex],
                            urunAdi: formValues.urunAdi,
                            urun_adi: formValues.urunAdi,
                            miktar: formValues.miktar,
                            fiyat: formValues.fiyat,
                            toplam: formValues.miktar * formValues.fiyat,
                            musteriId: formValues.musteriId || null,
                            borc: formValues.borc
                        };
                        
                        // Müşteri adını da güncelle
                        if (formValues.musteriId && musteriler[formValues.musteriId]) {
                            satisGecmisi[satisIndex].musteriAdi = musteriler[formValues.musteriId].ad;
                        }
                        
                        // API'ye güncelleme gönder
                        const response = await fetch(`${API_BASE}/api/satis-guncelle/${satisId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                urunAdi: formValues.urunAdi,
                                miktar: formValues.miktar,
                                fiyat: formValues.fiyat,
                                toplam: formValues.miktar * formValues.fiyat,
                                musteriId: formValues.musteriId,
                                borc: formValues.borc
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Real-time sync
                            socket.emit('dataUpdate', {
                                type: 'satis-update',
                                data: { satisId: satisId, updatedSatis: satisGecmisi[satisIndex] },
                                source: socket.id
                            });
                            
                            satisTablosunuGuncelle();
                            guncellenenVerileriKaydet();
                            
                            showNotification('✅ Satış kaydı güncellendi', 'success');
                        } else {
                            throw new Error(result.message || 'Güncelleme başarısız');
                        }
                    }
                } catch (error) {
                    console.error('❌ Satış düzenleme hatası:', error);
                    showNotification('❌ Satış düzenlenirken hata oluştu', 'error');
                }
            }
        }
        
        // Eski stub kaldırıldı: satisSil fonksiyonu yukarıda tanımlı API tabanlı sürüm kullanılacaktır.
        function urunIade(satisId) {
            console.log('🔄 Ürün iade:', satisId);
            console.log('🔍 Mevcut satışlar:', satisGecmisi.map(s => ({ id: s.id, barkod: s.barkod, urunAdi: s.urunAdi })));
            
            // Satışı farklı yollarla bulmaya çalış
            let satis = satisGecmisi.find(s => s.id == satisId || s.id === satisId);
            
            if (!satis) {
                // ID ile bulunamadıysa barkod ile dene
                satis = satisGecmisi.find(s => s.barkod == satisId || s.barkod === satisId);
            }
            
            if (!satis) {
                // String ID ile de dene
                satis = satisGecmisi.find(s => String(s.id) === String(satisId));
            }
            
            if (!satis) {
                console.error('❌ Satış bulunamadı:', { satisId, satisGecmisiLength: satisGecmisi.length });
                console.log('🔍 Mevcut satışlar:', satisGecmisi.map(s => ({ id: s.id, barkod: s.barkod, urunAdi: s.urunAdi })));
                Swal.fire('Hata', `Satış bulunamadı. ID: ${satisId}`, 'error');
                return;
            }
            
            Swal.fire({
                title: 'Ürün İadesi',
                text: `${satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-'))} ürününü iade etmek istediğinizden emin misiniz?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Evet, İade Et',
                cancelButtonText: 'İptal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        console.log('🔄 İade işlemi başlatılıyor (Customer):', satisId);
                        
                        // API'ye iade isteği gönder - aynı API'yi kullan
                        const response = await fetch(`${API_BASE}/api/satis-iade`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                satisId: satisId,
                                barkod: satis.barkod,
                                miktar: satis.miktar,
                                urunAdi: satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-')),
                                alisFiyati: satis.alisFiyati || 0
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Local data'dan satışı sil
                            const satisIndex = satisGecmisi.findIndex(s => s.id === parseInt(satisId));
                            if (satisIndex !== -1) {
                                satisGecmisi.splice(satisIndex, 1);
                            }
                            
                            // Stok güncellemesi varsa local data'yı güncelle
                            if (result.stokGuncellemesi) {
                                // Use composite key for stock update
                                const compositeKey = `${result.stokGuncellemesi.barkod}_${result.stokGuncellemesi.marka || ''}_${result.stokGuncellemesi.varyant_id || ''}`;
                                
                                // Map backend fields to frontend expected fields
                                const mappedData = {
                                    ...result.stokGuncellemesi,
                                    urun_adi: result.stokGuncellemesi.ad || result.stokGuncellemesi.urun_adi || '',
                                    stok_miktari: result.stokGuncellemesi.miktar || result.stokGuncellemesi.stok_miktari || 0,
                                    fiyat: result.stokGuncellemesi.satisFiyati || result.stokGuncellemesi.fiyat || 0
                                };
                                
                                stokListesi[compositeKey] = mappedData;
                            }
                            
                            // Real-time sync to other clients
                            socket.emit('dataUpdate', {
                                type: 'satis-iade',
                                data: { satisId: satisId, barkod: satis.barkod },
                                source: socket.id
                            });
                            
                            stokTablosunuGuncelle();
                            satisTablosunuGuncelle();
                            guncellenenVerileriKaydet();
                            
                            Swal.fire({
                                icon: 'success',
                                title: 'İade Tamamlandı!',
                                text: result.message || 'Ürün stoklara geri eklendi.',
                                showConfirmButton: false,
                                timer: 1500
                            });
                        } else {
                            throw new Error(result.message);
                        }
                        
                    } catch (error) {
                        console.error('❌ İade hatası:', error);
                        Swal.fire('Hata', error.message || 'İade işlemi başarısız', 'error');
                    }
                }
            });
        }
        
        // Borç ödeme fonksiyonu - FIX: Eksik fonksiyon eklendi
        function borcOdeme(debtId) {
            console.log('🔄 Borç ödeme:', debtId);
            
            const borc = borclarim[debtId];
            if (!borc) {
                Swal.fire('Hata', 'Borç bulunamadı.', 'error');
                return;
            }
            
            if (borc.durum === 'Ödendi') {
                Swal.fire('Bilgi', 'Bu borç zaten ödenmiş.', 'info');
                return;
            }
            
            Swal.fire({
                title: 'Borç Ödeme',
                text: `${borc.alacakli} adına ${borc.miktar} ₺ borç ödemesi yapılacak. Onaylıyor musunuz?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Evet, Öde',
                cancelButtonText: 'İptal'
            }).then((result) => {
                if (result.isConfirmed) {
                    try {
                        // Borç durumunu güncelle
                        borc.durum = 'Ödendi';
                        borc.odemeTarihi = new Date().toISOString().split('T')[0];
                        
                        // Real-time sync
                        socket.emit('dataUpdate', {
                            type: 'borc-update',
                            data: borc
                        });
                        
                        // UI güncelle
                        borcTablosunuGuncelle();
                        guncellenenVerileriKaydet();
                        
                        Swal.fire('Başarılı', 'Borç ödendi.', 'success');
                    } catch (error) {
                        console.error('Borç ödeme hatası:', error);
                        Swal.fire('Hata', 'Borç ödenirken hata oluştu.', 'error');
                    }
                }
            });
        }
        
        // Borç düzenle
        function borcDuzenle(debtId) {
            const borc = borclarim[debtId];
            if (!borc) return;
            
            document.getElementById('alacakliAdi').value = borc.alacakli;
            document.getElementById('borcMiktari').value = borc.miktar;
            document.getElementById('borcAciklama').value = borc.aciklama || '';
            document.getElementById('borcTarihi').value = borc.tarih;
            document.getElementById('borcDurumu').value = borc.durum;
            
            editingDebtId = debtId;
        }
        // Borç sil - FIX: API entegrasyonu ile
        async function borcSil(debtId) {
            if (!borclarim[debtId]) return;
            
            Swal.fire({
                title: 'Borcu silmek istiyor musunuz?',
                text: "Bu işlem geri alınamaz!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Evet, sil!',
                cancelButtonText: 'İptal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        // Send delete request to API - FIX: Added API integration
                        const response = await fetch(`${API_BASE}/api/borc-sil/${debtId}`, {
                            method: 'DELETE'
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Update local data
                            delete borclarim[debtId];
                            
                            // Emit real-time sync to other clients
                            socket.emit('dataUpdate', {
                                type: 'borc-delete',
                                data: { id: debtId }
                            });
                            
                            guncellenenVerileriKaydet();
                            borcTablosunuGuncelle();
                            Swal.fire('Silindi!', 'Borç başarıyla silindi.', 'success');
                        } else {
                            throw new Error(result.message || 'Borç silinemedi');
                        }
                        
                    } catch (error) {
                        console.error('Borç silme hatası:', error);
                        Swal.fire('Hata', 'Borç silinirken hata oluştu: ' + error.message, 'error');
                    }
                }
            });
        }
        // Excel'e aktar
        function exportToExcel(type) {
            let data = [];
            let fileName = '';
            let sheetName = '';
            
            switch(type) {
                case 'stock':
                    data = Object.values(stokListesi).map(urun => ({
                        Barkod: urun.barkod,
                        Ürün_Adı: urun.ad,
                        Marka: urun.marka || '',
                        Açıklama: urun.aciklama || '',
                        Miktar: urun.miktar,
                        Alış_Fiyatı: urun.alisFiyati || 0
                    }));
                    fileName = 'stok_listesi.xlsx';
                    sheetName = 'Stok Listesi';
                    break;
                    
                case 'sales':
                    data = satisGecmisi.map(satis => {
                        const tarih = new Date(satis.tarih);
                        const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()} ${tarih.getHours().toString().padStart(2, '0')}:${tarih.getMinutes().toString().padStart(2, '0')}`;
                        
                        return {
                            Tarih: tarihStr,
                            Barkod: satis.barkod,
                            Ürün_Adı: satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-')),
                            Miktar: satis.miktar,
                            Alış_Fiyatı: satis.alisFiyati || 0,
                            Satış_Fiyatı: satis.fiyat,
                            Toplam: satis.toplam,
                            Tür: satis.borc ? 'Borç' : 'Nakit',
                            Müşteri: satis.musteriId ? musteriler[satis.musteriId]?.ad : '-'
                        };
                    });
                    fileName = 'satis_gecmisi.xlsx';
                    sheetName = 'Satış Geçmişi';
                    break;
                    
                case 'customers':
                    data = Object.values(musteriler).map(musteri => ({
                        Müşteri_Adı: musteri.ad,
                        Telefon: musteri.telefon || '',
                        Adres: musteri.adres || '',
                        Açıklama: musteri.aciklama || ''
                    }));
                    fileName = 'musteri_listesi.xlsx';
                    sheetName = 'Müşteri Listesi';
                    break;
                    
                case 'debts':
                    data = Object.values(borclarim).map(borc => ({
                        Alacaklı: borc.alacakli,
                        Miktar: borc.miktar,
                        Tarih: borc.tarih,
                        Durum: borc.durum,
                        Açıklama: borc.aciklama || ''
                    }));
                    fileName = 'borclarim_listesi.xlsx';
                    sheetName = 'Borçlarım';
                    break;
            }
            
            if (data.length === 0) {
                Swal.fire('Uyarı', 'Aktarılacak veri bulunamadı.', 'warning');
                return;
            }
            
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, fileName);
        }
        
        // Tüm verileri Excel'e aktar
        function exportAllToExcel() {
            const wb = XLSX.utils.book_new();
            
            // Stok listesi
            const stockData = Object.values(stokListesi).map(urun => ({
                Barkod: urun.barkod,
                Ürün_Adı: urun.ad,
                Marka: urun.marka || '',
                Açıklama: urun.aciklama || '',
                Miktar: urun.miktar,
                Alış_Fiyatı: urun.alisFiyati || 0
            }));
            if (stockData.length > 0) {
                const wsStock = XLSX.utils.json_to_sheet(stockData);
                XLSX.utils.book_append_sheet(wb, wsStock, 'Stok Listesi');
            }
            
            // Satış geçmişi
            const salesData = satisGecmisi.map(satis => {
                const tarih = new Date(satis.tarih);
                const tarihStr = `${tarih.getDate().toString().padStart(2, '0')}.${(tarih.getMonth()+1).toString().padStart(2, '0')}.${tarih.getFullYear()} ${tarih.getHours().toString().padStart(2, '0')}:${tarih.getMinutes().toString().padStart(2, '0')}`;
                
                return {
                    Tarih: tarihStr,
                    Barkod: satis.barkod,
                    Ürün_Adı: satis.urunAdi || satis.urun_adi || satis.ad || (stokListesi[satis.barkod]?.ad || stokListesi[satis.barkod]?.urun_adi || stokListesi[satis.barkod]?.urunAdi) || ('Barkod: ' + (satis.barkod || '-')),
                    Miktar: satis.miktar,
                    Alış_Fiyatı: satis.alisFiyati || 0,
                    Satış_Fiyatı: satis.fiyat,
                    Toplam: satis.toplam,
                    Tür: satis.borc ? 'Borç' : 'Nakit',
                    Müşteri: satis.musteriId ? musteriler[satis.musteriId]?.ad : '-'
                };
            });
            if (salesData.length > 0) {
                const wsSales = XLSX.utils.json_to_sheet(salesData);
                XLSX.utils.book_append_sheet(wb, wsSales, 'Satış Geçmişi');
            }
            
            // Müşteriler
            const customersData = Object.values(musteriler).map(musteri => ({
                Müşteri_Adı: musteri.ad,
                Telefon: musteri.telefon || '',
                Adres: musteri.adres || '',
                Açıklama: musteri.aciklama || ''
            }));
            if (customersData.length > 0) {
                const wsCustomers = XLSX.utils.json_to_sheet(customersData);
                XLSX.utils.book_append_sheet(wb, wsCustomers, 'Müşteriler');
            }
            
            // Borçlarım
            const debtsData = Object.values(borclarim).map(borc => ({
                Alacaklı: borc.alacakli,
                Miktar: borc.miktar,
                Tarih: borc.tarih,
                Durum: borc.durum,
                Açıklama: borc.aciklama || ''
            }));
            if (debtsData.length > 0) {
                const wsDebts = XLSX.utils.json_to_sheet(debtsData);
                XLSX.utils.book_append_sheet(wb, wsDebts, 'Borçlarım');
            }
            
            if (wb.SheetNames.length === 0) {
                Swal.fire('Uyarı', 'Aktarılacak veri bulunamadı.', 'warning');
                return;
            }
            
            XLSX.writeFile(wb, 'sabancioglu_otomotiv_veriler.xlsx');
        }
        
        // Veri yedekle
        function backupData() {
            const data = {
                stokListesi,
                satisGecmisi,
                musteriler,
                borclarim,
                version: '1.0',
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `sabancioglu_backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Swal.fire('Başarılı!', 'Verileriniz başarıyla indirildi.', 'success');
        }
        // Manuel yedekleme
        async function manuelYedekleme() {
            try {
                showNotification('🔄 Manuel yedekleme başlatılıyor...', 'info');
                
                const response = await fetch(`${API_BASE}/api/backup-manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('✅ Manuel yedekleme başarıyla tamamlandı', 'success');
                } else {
                    throw new Error(result.message || 'Manuel yedekleme başarısız');
                }
                
            } catch (error) {
                console.error('Manuel yedekleme hatası:', error);
                showNotification('❌ Manuel yedekleme hatası: ' + error.message, 'error');
            }
        }

        // Excel Export
        async function excelExport() {
            try {
                const { value: selectedTables } = await Swal.fire({
                    title: '📊 Excel Export',
                    html: `
                        <div style="text-align: left;">
                            <p>Hangi tabloları export etmek istiyorsunuz?</p>
                            <label><input type="checkbox" id="table-stok" checked> Stok</label><br>
                            <label><input type="checkbox" id="table-sales" checked> Satış Geçmişi</label><br>
                            <label><input type="checkbox" id="table-customers" checked> Müşteriler</label><br>
                            <label><input type="checkbox" id="table-debts" checked> Borçlarım</label>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Export Et',
                    cancelButtonText: 'İptal',
                    preConfirm: () => {
                        const tables = [];
                        if (document.getElementById('table-stok').checked) tables.push('stok');
                        if (document.getElementById('table-sales').checked) tables.push('satisGecmisi');
                        if (document.getElementById('table-customers').checked) tables.push('musteriler');
                        if (document.getElementById('table-debts').checked) tables.push('borclarim');
                        return tables;
                    }
                });

                if (!selectedTables) return;

                showNotification('📊 Excel export başlatılıyor...', 'info');
                
                const response = await fetch(`${API_BASE}/api/export-excel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tables: selectedTables })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('✅ Excel export başarıyla tamamlandı!', 'success');
                    
                    // Download linkini göster
                    Swal.fire({
                        title: '✅ Export Tamamlandı',
                        html: `
                            <p>Dosya boyutu: ${(result.fileSize / 1024).toFixed(2)} KB</p>
                            <a href="${API_BASE}/api/download-excel/${result.fileName}" download 
                               class="btn btn-success">
                                <i class="fas fa-download"></i> İndir
                            </a>
                        `,
                        showConfirmButton: false,
                        showCloseButton: true
                    });
                } else {
                    showNotification('❌ Export başarısız: ' + result.error, 'error');
                }
                
            } catch (error) {
                showNotification('❌ Export hatası: ' + error.message, 'error');
                console.error('Excel export hatası:', error);
            }
        }

        // Backup Analizi
        async function backupAnalysis() {
            try {
                showNotification('🔍 Backup analizi başlatılıyor...', 'info');
                
                const response = await fetch(`${API_BASE}/api/backup-analysis`);
                const result = await response.json();
                
                if (result.success) {
                    const analysis = result.analysis;
                    
                    let html = `
                        <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                            <h4>📊 Veritabanı Durumu</h4>
                            <p><strong>Dosya Boyutu:</strong> ${(analysis.database.size / 1024).toFixed(2)} KB</p>
                            <p><strong>Son Güncelleme:</strong> ${new Date(analysis.database.lastModified).toLocaleString('tr-TR')}</p>
                            
                            <h4>📋 Tablo İstatistikleri</h4>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr style="background: #f0f0f0;">
                                    <th style="border: 1px solid #ddd; padding: 8px;">Tablo</th>
                                    <th style="border: 1px solid #ddd; padding: 8px;">Kayıt</th>
                                    <th style="border: 1px solid #ddd; padding: 8px;">Son Güncelleme</th>
                                </tr>
                    `;
                    
                    Object.entries(analysis.database.tables).forEach(([table, data]) => {
                        html += `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px;">${table}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${data.records}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${data.last_updated ? new Date(data.last_updated).toLocaleDateString('tr-TR') : 'N/A'}</td>
                            </tr>
                        `;
                    });
                    
                    html += `</table>`;
                    
                    html += `
                        <h4>⚠️ Veri Bütünlüğü</h4>
                        <p><strong>Orphaned Satışlar:</strong> ${analysis.integrity.orphaned_sales}</p>
                        <p><strong>Duplicate Barkodlar:</strong> ${analysis.integrity.duplicate_barcodes}</p>
                        <p><strong>Geçersiz Müşteri Ref:</strong> ${analysis.integrity.invalid_customers}</p>
                        
                        <h4>💾 Backup Dosyaları (${analysis.backup_files.length})</h4>
                    `;
                    
                    analysis.backup_files.slice(0, 5).forEach(file => {
                        html += `
                            <p style="font-size: 12px;">
                                📁 ${file.name} - ${(file.size / 1024).toFixed(2)} KB 
                                (${new Date(file.created).toLocaleDateString('tr-TR')})
                            </p>
                        `;
                    });
                    
                    html += `</div>`;
                    
                    Swal.fire({
                        title: '🔍 Backup Analizi',
                        html: html,
                        width: 600,
                        showCloseButton: true,
                        showConfirmButton: false
                    });
                    
                    showNotification('✅ Backup analizi tamamlandı!', 'success');
                } else {
                    showNotification('❌ Analiz başarısız: ' + result.error, 'error');
                }
                
            } catch (error) {
                showNotification('❌ Analiz hatası: ' + error.message, 'error');
                console.error('Backup analizi hatası:', error);
            }
        }
        // Veri geri yükle - GELİŞTİRİLMİŞ: Senkronizasyon ile
        async function restoreData(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // Gelişmiş veri analizi ve dönüştürme
                    const processedData = await analyzeAndProcessBackupData(data);
                    
                    if (!processedData) {
                        document.getElementById('restoreStatus').innerHTML = '<p style="color: #e74c3c;">Yedek dosyası işlenemedi!</p>';
                        return;
                    }
                    
                    // Kullanıcıya analiz sonucunu göster
                    const analysisResult = await Swal.fire({
                        title: 'Yedek Dosyası Analizi',
                        html: `
                            <div style="text-align: left;">
                                <p><strong>Dosya Analizi:</strong></p>
                                <ul>
                                    <li>Stok Kayıtları: ${Object.keys(processedData.stokListesi || {}).length} adet</li>
                                    <li>Satış Kayıtları: ${(processedData.satisGecmisi || []).length} adet</li>
                                    <li>Müşteri Kayıtları: ${Object.keys(processedData.musteriler || {}).length} adet</li>
                                    <li>Borç Kayıtları: ${Object.keys(processedData.borclarim || {}).length} adet</li>
                                </ul>
                                <p style="margin-top: 15px;">Yedek veriler yüklenecek ve tüm cihazlarla senkronize edilecek.</p>
                            </div>
                        `,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Evet, Yükle',
                        cancelButtonText: 'İptal',
                        confirmButtonColor: '#27ae60',
                        cancelButtonColor: '#6c757d'
                    });
                    
                    if (!analysisResult.isConfirmed) {
                        document.getElementById('restoreFile').value = '';
                        return;
                    }
                    
                    // Mevcut verilerle merge et (silme yerine)
                    await mergeBackupData(processedData);
                    
                    // Tüm tabloları güncelle
                    stokTablosunuGuncelle();
                    satisTablosunuGuncelle();
                    musteriTablosunuGuncelle();
                    borcTablosunuGuncelle();
                    guncelleIstatistikler();
                    
                    // Backend'e senkronize et
                    await syncBackupData(processedData);
                    
                    document.getElementById('restoreStatus').innerHTML = '<p style="color: #27ae60;">Veriler başarıyla geri yüklendi ve senkronize edildi!</p>';
                    
                    setTimeout(() => {
                        document.getElementById('restoreStatus').innerHTML = '';
                        document.getElementById('restoreFile').value = '';
                    }, 3000);
                    
                } catch (error) {
                    console.error('Veri geri yükleme hatası:', error);
                    document.getElementById('restoreStatus').innerHTML = '<p style="color: #e74c3c;">Yedek dosyası okunamadı: ' + error.message + '</p>';
                }
            };
            reader.readAsText(file);
        }
        
        // Yedek dosyasını analiz et ve işle - farklı veri yapılarını destekle
        async function analyzeAndProcessBackupData(data) {
            try {
                const processed = {
                    stokListesi: {},
                    satisGecmisi: [],
                    musteriler: {},
                    borclarim: {}
                };
                
                // Stok verilerini işle - farklı formatları destekle
                if (data.stokListesi) {
                    processed.stokListesi = data.stokListesi;
                } else if (data.stok) {
                    processed.stokListesi = data.stok;
                } else if (data.products) {
                    // İngilizce format
                    for (const [key, product] of Object.entries(data.products)) {
                        processed.stokListesi[key] = {
                            barkod: product.barcode || product.barkod || key,
                            urun_adi: product.name || product.urun_adi || product.ad || '',
                            marka: product.brand || product.marka || '',
                            stok_miktari: product.stock || product.stok_miktari || product.miktar || 0,
                            fiyat: product.price || product.fiyat || product.satisFiyati || 0,
                            alisFiyati: product.cost || product.alisFiyati || 0,
                            kategori: product.category || product.kategori || '',
                            aciklama: product.description || product.aciklama || ''
                        };
                    }
                } else if (Array.isArray(data)) {
                    // Dizi formatında stok verileri
                    for (const item of data) {
                        if (item.barkod || item.barcode) {
                            const key = item.barkod || item.barcode;
                            processed.stokListesi[key] = {
                                barkod: key,
                                urun_adi: item.urun_adi || item.ad || item.name || '',
                                marka: item.marka || item.brand || '',
                                stok_miktari: item.stok_miktari || item.miktar || item.stock || 0,
                                fiyat: item.fiyat || item.satisFiyati || item.price || 0,
                                alisFiyati: item.alisFiyati || item.cost || 0,
                                kategori: item.kategori || item.category || '',
                                aciklama: item.aciklama || item.description || ''
                            };
                        }
                    }
                }
                
                // Satış verilerini işle
                if (data.satisGecmisi) {
                    processed.satisGecmisi = data.satisGecmisi;
                } else if (data.sales) {
                    processed.satisGecmisi = data.sales.map(sale => ({
                        id: sale.id || Date.now() + Math.random(),
                        barkod: sale.barcode || sale.barkod || '',
                        urunAdi: sale.productName || sale.urunAdi || sale.urun_adi || '',
                        miktar: sale.quantity || sale.miktar || 1,
                        fiyat: sale.price || sale.fiyat || 0,
                        toplam: sale.total || sale.toplam || (sale.price * sale.quantity) || 0,
                        tarih: sale.date || sale.tarih || new Date().toISOString(),
                        musteriId: sale.customerId || sale.musteriId || null,
                        borc: sale.debt || sale.borc || false
                    }));
                }
                
                // Müşteri verilerini işle
                if (data.musteriler) {
                    processed.musteriler = data.musteriler;
                } else if (data.customers) {
                    for (const [key, customer] of Object.entries(data.customers)) {
                        processed.musteriler[key] = {
                            id: customer.id || key,
                            ad: customer.name || customer.ad || '',
                            telefon: customer.phone || customer.telefon || '',
                            adres: customer.address || customer.adres || '',
                            bakiye: customer.balance || customer.bakiye || 0
                        };
                    }
                }
                
                // Borç verilerini işle
                if (data.borclarim) {
                    processed.borclarim = data.borclarim;
                } else if (data.debts) {
                    processed.borclarim = data.debts;
                }
                
                console.log('✅ Yedek dosyası başarıyla işlendi:', processed);
                return processed;
                
            } catch (error) {
                console.error('❌ Yedek dosyası işleme hatası:', error);
                return null;
            }
        }
        
        // Yedek verileri mevcut verilerle birleştir
        async function mergeBackupData(backupData) {
            try {
                let mergeStats = {
                    stok: { added: 0, updated: 0 },
                    satis: { added: 0, updated: 0 },
                    musteri: { added: 0, updated: 0 },
                    borc: { added: 0, updated: 0 }
                };
                
                // Stok verilerini merge et
                for (const [key, urun] of Object.entries(backupData.stokListesi || {})) {
                    if (stokListesi[key]) {
                        // Mevcut ürünü güncelle
                        stokListesi[key] = { ...stokListesi[key], ...urun };
                        mergeStats.stok.updated++;
                    } else {
                        // Yeni ürün ekle
                        stokListesi[key] = urun;
                        mergeStats.stok.added++;
                    }
                }
                
                // Satış verilerini merge et (ID kontrolü ile)
                for (const satis of backupData.satisGecmisi || []) {
                    const existingIndex = satisGecmisi.findIndex(s => s.id === satis.id);
                    if (existingIndex !== -1) {
                        satisGecmisi[existingIndex] = { ...satisGecmisi[existingIndex], ...satis };
                        mergeStats.satis.updated++;
                    } else {
                        // Yeni ID oluştur eğer yoksa
                        if (!satis.id) {
                            satis.id = Date.now() + Math.random();
                        }
                        satisGecmisi.push(satis);
                        mergeStats.satis.added++;
                    }
                }
                
                // Müşteri verilerini merge et
                for (const [key, musteri] of Object.entries(backupData.musteriler || {})) {
                    if (musteriler[key]) {
                        musteriler[key] = { ...musteriler[key], ...musteri };
                        mergeStats.musteri.updated++;
                    } else {
                        musteriler[key] = musteri;
                        mergeStats.musteri.added++;
                    }
                }
                
                // Borç verilerini merge et
                for (const [key, borc] of Object.entries(backupData.borclarim || {})) {
                    if (borclarim[key]) {
                        borclarim[key] = { ...borclarim[key], ...borc };
                        mergeStats.borc.updated++;
                    } else {
                        borclarim[key] = borc;
                        mergeStats.borc.added++;
                    }
                }
                
                // LocalStorage'e kaydet
                saveData();
                
                console.log('✅ Veriler başarıyla birleştirildi:', mergeStats);
                
                // Merge sonucunu göster
                showNotification(`✅ Veriler birleştirildi: ${mergeStats.stok.added + mergeStats.satis.added + mergeStats.musteri.added + mergeStats.borc.added} yeni, ${mergeStats.stok.updated + mergeStats.satis.updated + mergeStats.musteri.updated + mergeStats.borc.updated} güncellendi`, 'success');
                
            } catch (error) {
                console.error('❌ Veri birleştirme hatası:', error);
                throw error;
            }
        }
        
        // Yedek verileri backend'e senkronize et - GELİŞTİRİLMİŞ: Tekrar yükleme kontrolü
        async function syncBackupData(backupData) {
            try {
                console.log('🔄 Yedek veriler backend\'e senkronize ediliyor...');
                
                let syncStats = {
                    stok: { updated: 0, skipped: 0 },
                    satis: { updated: 0, skipped: 0 },
                    musteri: { updated: 0, skipped: 0 },
                    borc: { updated: 0, skipped: 0 }
                };
                
                // Stok verilerini senkronize et - Tekrar kontrolü ile
                for (const [key, urun] of Object.entries(backupData.stokListesi)) {
                    const result = await syncProduct(urun);
                    if (result.updated) syncStats.stok.updated++;
                    else syncStats.stok.skipped++;
                }
                
                // Satış verilerini senkronize et - Tekrar kontrolü ile
                for (const satis of backupData.satisGecmisi) {
                    const result = await syncSale(satis);
                    if (result.updated) syncStats.satis.updated++;
                    else syncStats.satis.skipped++;
                }
                
                // Müşteri verilerini senkronize et - Tekrar kontrolü ile
                for (const [key, musteri] of Object.entries(backupData.musteriler)) {
                    const result = await syncCustomer(musteri);
                    if (result.updated) syncStats.musteri.updated++;
                    else syncStats.musteri.skipped++;
                }
                
                // Borç verilerini senkronize et - Tekrar kontrolü ile
                for (const [key, borc] of Object.entries(backupData.borclarim)) {
                    const result = await syncDebt(borc);
                    if (result.updated) syncStats.borc.updated++;
                    else syncStats.borc.skipped++;
                }
                
                console.log('✅ Yedek veriler başarıyla senkronize edildi:', syncStats);
                
                // Tüm client'lara bildir
                socket.emit('backup-synced', {
                    timestamp: new Date().toISOString(),
                    data: backupData,
                    stats: syncStats
                });
                
            } catch (error) {
                console.error('❌ Yedek senkronizasyon hatası:', error);
                throw error;
            }
        }
        
        // Ürün senkronizasyonu - GELİŞTİRİLMİŞ: Tekrar kontrolü
        async function syncProduct(urun) {
            try {
                // Önce mevcut ürünü kontrol et
                const checkResponse = await fetch(`${API_BASE}/api/stok-kontrol?barkod=${urun.barkod}&marka=${urun.marka || ''}&varyant_id=${urun.varyant_id || ''}`);
                const checkResult = await checkResponse.json();
                
                if (checkResult.exists) {
                    console.log('⏭️ Ürün zaten mevcut, güncelleniyor:', urun.barkod);
                    // Mevcut ürünü güncelle
                    const updateResponse = await fetch(`${API_BASE}/api/stok-guncelle`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: checkResult.product.id,
                            barkod: urun.barkod,
                            ad: urun.urun_adi || urun.ad || '',
                            marka: urun.marka || '',
                            miktar: urun.stok_miktari || urun.miktar || 0,
                            alisFiyati: urun.alisFiyati || 0,
                            satisFiyati: urun.fiyat || urun.satisFiyati || 0,
                            kategori: urun.kategori || '',
                            aciklama: urun.aciklama || '',
                            varyant_id: urun.varyant_id || null
                        })
                    });
                    
                    const updateResult = await updateResponse.json();
                    return { updated: updateResult.success, skipped: false };
                } else {
                    // Yeni ürün ekle
                    const response = await fetch(`${API_BASE}/api/stok-ekle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            barkod: urun.barkod,
                            ad: urun.urun_adi || urun.ad || '',
                            marka: urun.marka || '',
                            miktar: urun.stok_miktari || urun.miktar || 0,
                            alisFiyati: urun.alisFiyati || 0,
                            satisFiyati: urun.fiyat || urun.satisFiyati || 0,
                            kategori: urun.kategori || '',
                            aciklama: urun.aciklama || '',
                            varyant_id: urun.varyant_id || null
                        })
                    });
                    
                    const result = await response.json();
                    return { updated: result.success, skipped: !result.success };
                }
            } catch (error) {
                console.error('❌ Ürün senkronizasyon hatası:', error);
                return { updated: false, skipped: true };
            }
        }
        // Satış senkronizasyonu - GELİŞTİRİLMİŞ: Tekrar kontrolü
        async function syncSale(satis) {
            try {
                // Satış ID'si varsa kontrol et
                if (satis.id) {
                    const checkResponse = await fetch(`${API_BASE}/api/satis-kontrol?id=${satis.id}`);
                    const checkResult = await checkResponse.json();
                    
                    if (checkResult.exists) {
                        console.log('⏭️ Satış zaten mevcut, atlanıyor:', satis.id);
                        return { updated: false, skipped: true };
                    }
                }
                
                // Yeni satış ekle
                const response = await fetch(`${API_BASE}/api/satis-ekle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: satis.id || null,
                        barkod: satis.barkod,
                        urunAdi: satis.urunAdi || satis.urun_adi || '',
                        miktar: satis.miktar || 0,
                        fiyat: satis.fiyat || 0,
                        alisFiyati: satis.alisFiyati || 0,
                        musteriId: satis.musteriId || null,
                        tarih: satis.tarih || new Date().toISOString(),
                        borc: satis.borc || false,
                        toplam: satis.toplam || 0
                    })
                });
                
                const result = await response.json();
                return { updated: result.success, skipped: !result.success };
            } catch (error) {
                console.error('❌ Satış senkronizasyon hatası:', error);
                return { updated: false, skipped: true };
            }
        }
        // Müşteri senkronizasyonu - GELİŞTİRİLMİŞ: Tekrar kontrolü
        async function syncCustomer(musteri) {
            try {
                // Müşteri ID'si varsa kontrol et
                if (musteri.id) {
                    const checkResponse = await fetch(`${API_BASE}/api/musteri-kontrol?id=${musteri.id}`);
                    const checkResult = await checkResponse.json();
                    
                    if (checkResult.exists) {
                        console.log('⏭️ Müşteri zaten mevcut, güncelleniyor:', musteri.id);
                        // Mevcut müşteriyi güncelle
                        const updateResponse = await fetch(`${API_BASE}/api/musteri-guncelle`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: musteri.id,
                                ad: musteri.ad || '',
                                telefon: musteri.telefon || '',
                                adres: musteri.adres || '',
                                bakiye: musteri.bakiye || 0
                            })
                        });
                        
                        const updateResult = await updateResponse.json();
                        return { updated: updateResult.success, skipped: false };
                    }
                }
                
                // Yeni müşteri ekle
                const response = await fetch(`${API_BASE}/api/musteri-ekle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: musteri.id,
                        ad: musteri.ad || '',
                        telefon: musteri.telefon || '',
                        adres: musteri.adres || '',
                        bakiye: musteri.bakiye || 0
                    })
                });
                
                const result = await response.json();
                return { updated: result.success, skipped: !result.success };
            } catch (error) {
                console.error('❌ Müşteri senkronizasyon hatası:', error);
                return { updated: false, skipped: true };
            }
        }
        
        // Borç senkronizasyonu - GELİŞTİRİLMİŞ: Tekrar kontrolü
        async function syncDebt(borc) {
            try {
                // Borç ID'si varsa kontrol et
                if (borc.id) {
                    const checkResponse = await fetch(`${API_BASE}/api/borc-kontrol?id=${borc.id}`);
                    const checkResult = await checkResponse.json();
                    
                    if (checkResult.exists) {
                        console.log('⏭️ Borç zaten mevcut, güncelleniyor:', borc.id);
                        // Mevcut borcu güncelle
                        const updateResponse = await fetch(`${API_BASE}/api/borc-guncelle`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: borc.id,
                                musteriId: borc.alacakli || borc.musteriId || '',
                                tutar: borc.miktar || borc.tutar || 0,
                                aciklama: borc.aciklama || '',
                                tarih: borc.tarih || new Date().toISOString(),
                                durum: borc.durum || 'Ödenmedi'
                            })
                        });
                        
                        const updateResult = await updateResponse.json();
                        return { updated: updateResult.success, skipped: false };
                    }
                }
                
                // Yeni borç ekle
                const response = await fetch(`${API_BASE}/api/borc-ekle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: borc.id,
                        musteriId: borc.alacakli || borc.musteriId || '',
                        tutar: borc.miktar || borc.tutar || 0,
                        aciklama: borc.aciklama || '',
                        tarih: borc.tarih || new Date().toISOString(),
                        durum: borc.durum || 'Ödenmedi'
                    })
                });
                
                const result = await response.json();
                return { updated: result.success, skipped: !result.success };
            } catch (error) {
                console.error('❌ Borç senkronizasyon hatası:', error);
                return { updated: false, skipped: true };
            }
        }
        
        // Veri yedekleme modalını aç
        function openBackupModal() {
            document.getElementById('backupModal').style.display = 'flex';
        }

        // Müşteri düzenle işlevi (eksik olanı ekliyorum)
        function musteriDuzenle(id) {
            if (!musteriler[id]) return;
            editingMode = true;
            editingMusteriId = id;
            const musteri = musteriler[id];
            document.getElementById('musteriAdi').value = musteri.ad || '';
            document.getElementById('musteriTelefon').value = musteri.telefon || '';
            document.getElementById('musteriAdres').value = musteri.adres || '';
            document.getElementById('musteriAciklama').value = musteri.aciklama || '';
            document.getElementById('musteriKaydetBtn').innerHTML = '<i class="fas fa-save"></i> Güncelle';
            document.getElementById('musteriIptalBtn').style.display = 'inline-block';
        }
        // Müşteri silme fonksiyonu (eksik olanı ekliyorum)
        async function musteriSil(id) {
            if (!musteriler[id]) return;
            
            const musteri = musteriler[id];
            
            Swal.fire({
                title: 'Silmeyi onayla',
                html: `<b>${musteri.ad || ''}</b> müşterisini silmek istediğinize emin misiniz?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'İptal',
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#6c757d'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        console.log('🗑️ Müşteri siliniyor:', id);
                        
                        const response = await fetch(`${API_BASE}/api/musteri-sil/${encodeURIComponent(id)}`, {
                            method: 'DELETE'
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // Local data dan sil
                            delete musteriler[id];
                            
                            // Real-time sync to other clients
                            socket.emit('dataUpdate', {
                                type: 'musteri-delete',
                                data: { id: id },
                                source: socket.id
                            });
                            
                            musteriTablosunuGuncelle();
                            guncellenenVerileriKaydet();
                            
                            Swal.fire({
                                icon: 'success',
                                title: 'Müşteri Silindi!',
                                text: result.message,
                                showConfirmButton: false,
                                timer: 1500
                            });
                        } else {
                            throw new Error(result.message);
                        }
                        
                    } catch (error) {
                        console.error('❌ Müşteri silme hatası:', error);
                        Swal.fire('Hata', error.message || 'Müşteri silinemedi', 'error');
                    }
                }
            });
        }

        // Tema değiştirme fonksiyonu
        function toggleTheme() {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', currentTheme);
            localStorage.setItem('theme', currentTheme);
            
            // Menü ikonunu güncelle
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            if (currentTheme === 'dark') {
                themeIcon.className = 'fas fa-sun';
                themeText.textContent = 'Açık Tema';
            } else {
                themeIcon.className = 'fas fa-moon';
                themeText.textContent = 'Karanlık Tema';
            }
        }
        
        // QR Bağlantı modalını aç
        function openQRConnection() {
            // Network bilgilerini al
            fetch(`${API_BASE}/api/network-info`)
                .then(response => response.json())
                .then(result => {
                    if (result.success && result.networkInfo) {
                        const networkInfo = result.networkInfo;
                        const primaryURL = networkInfo.primaryURL;
                        
                        // QR kod oluştur
                        const qrContainer = document.createElement('div');
                        qrContainer.id = 'qrCodeContainer';
                        
                        // Tüm IP adreslerini listele
                        const localIPs = networkInfo.localIPs || [];
                        const ipList = localIPs.map(ip => 
                            `<div style="padding: 5px; margin: 3px 0; background: #f0f0f0; border-radius: 5px; font-size: 11px;">
                                ${ip.interface}: ${ip.ip}
                            </div>`
                        ).join('');
                        
                        Swal.fire({
                            title: 'Mobil Bağlantı Rehberi',
                            html: `
                                <div style="text-align: left; max-width: 500px; margin: 0 auto;">
                                    <div style="text-align: center; margin-bottom: 20px;">
                                        <div id="qrCodeContainer" style="padding: 15px; background: #f8f9fa; border-radius: 10px; margin-bottom: 10px;">
                                            <i class="fas fa-qrcode" style="font-size: 80px; color: var(--primary);"></i>
                                        </div>
                                        <p style="font-size: 12px; color: #999; word-break: break-all; margin: 5px 0;">
                                            <strong>${primaryURL}</strong>
                                        </p>
                                    </div>
                                    
                                    <div style="font-size: 14px;">
                                        <h4 style="color: var(--primary); margin-bottom: 10px;">📱 Bağlantı Adımları:</h4>
                                        <ol style="margin-left: 20px; line-height: 1.6;">
                                            <li>Telefonunuzun aynı Wi-Fi ağında olduğundan emin olun</li>
                                            <li>QR kodu telefonunuzla tarayın VEYA</li>
                                            <li>Bu adresi manuel olarak girin</li>
                                        </ol>
                                        
                                        <h4 style="color: #e74c3c; margin: 15px 0 10px;">❗ Bağlanamıyorsanız:</h4>
                                        <ul style="margin-left: 20px; line-height: 1.5; font-size: 13px;">
                                            <li>Güvenlik duvarını geçici olarak kapatın</li>
                                            <li>Windows Defender'da 3000 portuna izin verin</li>
                                            <li>Telefon ve bilgisayar aynı alt ağda olmalı</li>
                                            <li>Aşağıdaki IP adreslerinden birini deneyin</li>
                                        </ul>
                                        
                                        <div style="margin-top: 15px; padding: 10px; background: #e8f4fd; border-radius: 5px;">
                                            <strong style="color: var(--primary);">📡 Mevcut IP Adresleri:</strong>
                                            ${ipList || '<div style="color: #999; font-style: italic;">IP adresi bulunamadı</div>'}
                                        </div>
                                    </div>
                                </div>
                            `,
                            width: 600,
                            showConfirmButton: true,
                            confirmButtonText: 'Kopyala',
                            showCancelButton: true,
                            cancelButtonText: 'Kapat',
                            didOpen: () => {
                                // QR kod oluştur
                                if (window.QRCode) {
                                    const qrContainer = document.getElementById('qrCodeContainer');
                                    if (qrContainer) {
                                        qrContainer.innerHTML = '';
                                        new QRCode(qrContainer, {
                                            text: primaryURL,
                                            width: 200,
                                            height: 200,
                                            colorDark: "#000000",
                                            colorLight: "#ffffff",
                                            correctLevel: QRCode.CorrectLevel.H
                                        });
                                    }
                                }
                            }
                        }).then((result) => {
                            if (result.isConfirmed) {
                                navigator.clipboard.writeText(primaryURL).then(() => {
                                    showNotification('Bağlantı adresi kopyalandı!', 'success');
                                }).catch(() => {
                                    showNotification('Kopyalama başarısız', 'error');
                                });
                            }
                        });
                    } else {
                        Swal.fire('Hata', 'Ağ bilgileri alınamadı', 'error');
                    }
                })
                .catch(error => {
                    console.error('QR bağlantı hatası:', error);
                    Swal.fire('Hata', 'QR bağlantı oluşturulamadı', 'error');
                });
        }

        // Tema ayarlarını yükle
        function loadTheme() {
            // LocalStorage'dan tema tercihini al
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                currentTheme = savedTheme;
            }
            
            document.documentElement.setAttribute('data-theme', currentTheme);
            
            // Menü ikonunu güncelle
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            if (currentTheme === 'dark') {
                themeIcon.className = 'fas fa-sun';
                themeText.textContent = 'Açık Tema';
            } else {
                themeIcon.className = 'fas fa-moon';
                themeText.textContent = 'Karanlık Tema';
            }
            
            console.log('🎨 Tema yüklendi:', currentTheme);
        }
        // Global scope fonksiyonları hemen tanımla - ULTRA OPTIMIZED
        // switchTab fonksiyonunu global scope'a ekle
        window.switchTab = function(tabName) {
            console.log('🔄 Tab değiştiriliyor:', tabName);
            
            try {
                // Tüm tabları gizle
                const panels = ['stock-panel', 'sales-panel', 'customers-panel', 'debts-panel'];
                panels.forEach(panelId => {
                    const panel = document.getElementById(panelId);
                    if (panel) panel.style.display = 'none';
                });
                
                // Tüm tab butonlarından active class'ını kaldır
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                // Seçilen tabı göster
                const targetPanel = document.getElementById(tabName + '-panel');
                if (targetPanel) {
                    targetPanel.style.display = 'block';
                }
                
                // Seçilen tab butonuna active class'ı ekle
                const activeTab = document.querySelector('[data-tab="' + tabName + '"]');
                if (activeTab) {
                    activeTab.classList.add('active');
                }
                
                // Tab değiştiğinde verileri güncelle
                setTimeout(() => {
                    if (tabName === 'sales') {
                        if (typeof satisTablosunuGuncelle === 'function') {
                            satisTablosunuGuncelle();
                        }
                        if (typeof guncelleIstatistikler === 'function') {
                            guncelleIstatistikler();
                        }
                    } else if (tabName === 'customers') {
                        if (typeof musteriTablosunuGuncelle === 'function') {
                            musteriTablosunuGuncelle();
                        }
                    } else if (tabName === 'debts') {
                        if (typeof borcTablosunuGuncelle === 'function') {
                            borcTablosunuGuncelle();
                        }
                    } else if (tabName === 'stock') {
                        if (typeof stokTablosunuGuncelle === 'function') {
                            stokTablosunuGuncelle();
                        }
                        if (typeof guncelleIstatistikler === 'function') {
                            guncelleIstatistikler();
                        }
                    }
                }, 100);
                
                console.log('✅ Tab değiştirildi:', tabName);
            } catch (error) {
                console.error('❌ Tab değiştirme hatası:', error);
            }
        };
        console.log('✅ switchTab fonksiyonu global scope\'a eklendi');
        // Sayfa yüklendiğinde gerekli işlemleri başlat
        window.onload = async function() {
            console.log('🚀 Sayfa yükleniyor...');
            
            // Tema ayarlarını yükle
            loadTheme();
            
            // Senkronizasyon durumunu başlat
            if (navigator.onLine) {
                updateSyncStatus('online', 'Bağlı');
                console.log('🟢 Online mode');
            } else {
                updateSyncStatus('offline', 'Çevrimdışı');
                console.log('🔴 Offline mode');
            }
            
            // Verileri yükle (iyileştirilmiş)
            await initializeData();
            
            // Tablo ve istatistikleri güncelle
            stokTablosunuGuncelle();
            guncelleIstatistikler();
            borcTablosunuGuncelle();
            
            console.log('✅ Sayfa yüklemesi tamamlandı');

            // Tab menü olayları - DIRECT EVENT LISTENERS
            console.log('🔧 Tab event listener ekleniyor...');
            
            // Tab switching fonksiyonu zaten global scope'ta tanımlandı
            console.log('✅ switchTab fonksiyonu kullanıma hazır');
            
            console.log('✅ switchTab fonksiyonu global scope\'ta tanımlandı');
            
            // Test fonksiyonları
            console.log('🔧 Test fonksiyonları ekleniyor...');
            
            // Test switchTab
            if (typeof window.switchTab === 'function') {
                console.log('✅ switchTab fonksiyonu global scope\'ta mevcut');
            } else {
                console.error('❌ switchTab fonksiyonu global scope\'ta bulunamadı');
            }
            
            // Test urunKaydet
            if (typeof window.urunKaydet === 'function') {
                console.log('✅ urunKaydet fonksiyonu global scope\'ta mevcut');
            } else {
                console.error('❌ urunKaydet fonksiyonu global scope\'ta bulunamadı');
            }
            
            // Sıralama olayları
            document.querySelectorAll('#stokTablosu th[data-sort]').forEach(th => {
                th.addEventListener('click', function(e) {
                    e.preventDefault();
                    const column = th.dataset.sort;
                    sortTable(column);
                });
            });
            
            // Müşteri sıralama olayları
            document.querySelectorAll('#musteriTablosu th[data-sort]').forEach(th => {
                th.addEventListener('click', function(e) {
                    e.preventDefault();
                    const column = th.dataset.sort;
                    sortCustomerTable(column);
                });
            });
            
            // Veri kaybını önlemek için periyodik yedekleme (15 dakikada bir) - ULTRA OPTIMIZED
            setInterval(() => {
                guncellenenVerileriKaydet();
            }, 900000); // 15 dakikada bir kaydet - ULTRA PERFORMANCE OPTIMIZATION
            
            // Senkronizasyon mesajını 10 dakikada bir göster (sadece gerçek senkronizasyon olaylarında)
            let lastSyncTime = 0;
            const syncNotificationInterval = setInterval(() => {
                const now = Date.now();
                // Sadece son 10 dakika içinde gerçek bir senkronizasyon olayı olduysa mesaj göster
                if (now - lastSyncTime < 600000) { // 10 dakika
                    // showNotification('🔄 Veriler senkronize edildi', 'info');
                }
            }, 600000); // 10 dakikada bir kontrol et
            
            // Yerel IP adresini al ve göster
            getLocalIpAddress();
            
            // İnternet bağlantı durumunu izle
            window.addEventListener('online', () => {
                updateSyncStatus('online', 'Çevrimiçi');
                console.log('🟢 Bağlantı geri geldi');
                tumVerileriYukle(); // Bağlantı geri gelince fresh data al
            });
            
            window.addEventListener('offline', () => {
                updateSyncStatus('offline', 'Çevrimdışı');
                console.log('🔴 Bağlantı kesildi');
            });
            
            // Enhanced Offline Mode Support - ULTRA OPTIMIZED
            let isOfflineMode = false;
            let offlineQueue = [];
            let lastOnlineCheck = Date.now();
            let offlineData = {
                products: new Map(),
                sales: [],
                customers: new Map(),
                debts: new Map(),
                lastSync: null
            };
            
            // Keyboard Shortcuts Support - ENHANCED
            const keyboardShortcuts = {
                'Ctrl+N': () => urunEkle(),
                'Ctrl+F': () => document.getElementById('aramaInput')?.focus(),
                'Ctrl+S': () => satisYap(),
                'Ctrl+M': () => musteriEkle(),
                'Ctrl+B': () => borcEkle(),
                'Ctrl+E': () => excelAktar(),
                'Ctrl+P': () => window.print(),
                'Escape': () => closeAllModals(),
                'F1': () => showHelp(),
                'F5': () => tumVerileriYukle()
            };
            
            // Keyboard event handler
            document.addEventListener('keydown', (e) => {
                const key = (e.ctrlKey ? 'Ctrl+' : '') + 
                           (e.altKey ? 'Alt+' : '') + 
                           (e.shiftKey ? 'Shift+' : '') + 
                           e.key;
                
                if (keyboardShortcuts[key]) {
                    e.preventDefault();
                    keyboardShortcuts[key]();
                }
                
                // Quick search on any alphanumeric key
                if (!e.ctrlKey && !e.altKey && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
                    const activeElement = document.activeElement;
                    if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
                        const searchInput = document.getElementById('aramaInput');
                        if (searchInput) {
                            searchInput.focus();
                            // Let the key press go through to the input
                            setTimeout(() => {
                                if (searchInput.value === '') {
                                    searchInput.value = e.key;
                                    aramaYap();
                                }
                            }, 0);
                        }
                    }
                }
            });
            
            // Helper functions for keyboard shortcuts
            function closeAllModals() {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(modal => modal.style.display = 'none');
            }
            
            function showHelp() {
                Swal.fire({
                    title: '⌨️ Klavye Kısayolları',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Ctrl+N:</strong> Yeni ürün ekle</p>
                            <p><strong>Ctrl+F:</strong> Arama yap</p>
                            <p><strong>Ctrl+S:</strong> Satış yap</p>
                            <p><strong>Ctrl+M:</strong> Müşteri ekle</p>
                            <p><strong>Ctrl+B:</strong> Borç ekle</p>
                            <p><strong>Ctrl+E:</strong> Excel'e aktar</p>
                            <p><strong>Ctrl+P:</strong> Yazdır</p>
                            <p><strong>Escape:</strong> Modalleri kapat</p>
                            <p><strong>F1:</strong> Yardım göster</p>
                            <p><strong>F5:</strong> Verileri yenile</p>
                            <p><strong>Herhangi bir harf/rakam:</strong> Hızlı arama</p>
                        </div>
                    `,
                    icon: 'info',
                    confirmButtonText: 'Tamam'
                });
            }

            // Initialize offline data from localStorage
            function initializeOfflineData() {
                try {
                    const stored = localStorage.getItem('offline_data');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.products) {
                            offlineData.products = new Map(Object.entries(parsed.products));
                        }
                        if (parsed.customers) {
                            offlineData.customers = new Map(Object.entries(parsed.customers));
                        }
                        if (parsed.debts) {
                            offlineData.debts = new Map(Object.entries(parsed.debts));
                        }
                        offlineData.sales = parsed.sales || [];
                        offlineData.lastSync = parsed.lastSync;
                    }
                    
                    const storedQueue = localStorage.getItem('offline_queue');
                    if (storedQueue) {
                        offlineQueue = JSON.parse(storedQueue);
                    }
                } catch (error) {
                    console.error('❌ Offline data initialization error:', error);
                }
            }
            
            // Save offline data to localStorage
            function saveOfflineData() {
                try {
                    const dataToSave = {
                        products: Object.fromEntries(offlineData.products),
                        sales: offlineData.sales,
                        customers: Object.fromEntries(offlineData.customers),
                        debts: Object.fromEntries(offlineData.debts),
                        lastSync: offlineData.lastSync
                    };
                    localStorage.setItem('offline_data', JSON.stringify(dataToSave));
                } catch (error) {
                    console.error('❌ Offline data save error:', error);
                }
            }
            
            // Offline queue işlemleri
            function addToOfflineQueue(action, data) {
                const queueItem = {
                    id: Date.now() + Math.random(),
                    action: action,
                    data: data,
                    timestamp: new Date().toISOString()
                };
                offlineQueue.push(queueItem);
                localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
                console.log('📝 Offline queue\'ya eklendi:', action);
            }
            function processOfflineQueue() {
                if (offlineQueue.length === 0) return;
                
                console.log('🔄 Offline queue işleniyor...');
                const queueToProcess = [...offlineQueue];
                offlineQueue = [];
                localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
                
                queueToProcess.forEach(async (item) => {
                    try {
                        switch (item.action) {
                            case 'add_product':
                                await fetch(`${API_BASE}/api/urun-ekle`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(item.data)
                                });
                                break;
                            case 'update_product':
                                await fetch(`${API_BASE}/api/urun-guncelle`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(item.data)
                                });
                                break;
                            case 'delete_product':
                                await fetch(`${API_BASE}/api/urun-sil`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(item.data)
                                });
                                break;
                            case 'add_sale':
                                await fetch(`${API_BASE}/api/satis-ekle`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(item.data)
                                });
                                break;
                            case 'add_customer':
                                await fetch(`${API_BASE}/api/musteri-ekle`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(item.data)
                                });
                                break;
                            case 'add_debt':
                                await fetch(`${API_BASE}/api/borc-ekle`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(item.data)
                                });
                                break;
                        }
                        console.log('✅ Offline queue item işlendi:', item.action);
                    } catch (error) {
                        console.error('❌ Offline queue item hatası:', error);
                        // Başarısız olan işlemi tekrar queue'ya ekle
                        offlineQueue.push(item);
                        localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
                    }
                });
                
                if (offlineQueue.length === 0) {
                    showNotification('🔄 Offline işlemler senkronize edildi', 'success');
                } else {
                    showNotification(`⚠️ ${offlineQueue.length} işlem senkronize edilemedi`, 'warning');
                }
            }
            
            // Online/offline durumu kontrolü
            async function checkOnlineStatus() {
                try {
                    const response = await fetch(`${API_BASE}/api/health`, { 
                        method: 'GET',
                        timeout: 3000 
                    });
                    
                    if (response.ok && !isOfflineMode) {
                        // Online moda geç
                        isOfflineMode = false;
                        updateSyncStatus('online', 'Çevrimiçi');
                        showNotification('🌐 Online moda geçildi', 'success');
                        
                        // Offline queue'yu işle
                        setTimeout(() => {
                            processOfflineQueue();
                        }, 1000);
                        
                        return true;
                    } else if (!response.ok && !isOfflineMode) {
                        // Offline moda geç
                        isOfflineMode = true;
                        updateSyncStatus('offline', 'Çevrimdışı');
                        showNotification('📱 Offline moda geçildi', 'warning');
                        return false;
                    }
                    
                    return response.ok;
                } catch (error) {
                    if (!isOfflineMode) {
                        isOfflineMode = true;
                        updateSyncStatus('offline', 'Çevrimdışı');
                        showNotification('📱 Offline moda geçildi', 'warning');
                    }
                    return false;
                }
            }
            
            // Periyodik online durumu kontrolü
            setInterval(() => {
                if (Date.now() - lastOnlineCheck > 30000) { // 30 saniyede bir
                    checkOnlineStatus();
                    lastOnlineCheck = Date.now();
                }
            }, 5000);
            
            // Sayfa yüklendiğinde offline queue'yu yükle
            const savedQueue = localStorage.getItem('offline_queue');
            if (savedQueue) {
                try {
                    offlineQueue = JSON.parse(savedQueue);
                    console.log(`📝 ${offlineQueue.length} offline işlem yüklendi`);
                } catch (error) {
                    console.error('❌ Offline queue yükleme hatası:', error);
                    offlineQueue = [];
                }
            }
            
            // Sayfa görünür olduğunda verileri senkronize et
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    console.log('👁️ Sayfa görünür oldu, veriler senkronize ediliyor...');
                    setTimeout(() => {
                        tumVerileriYukle();
                    }, 1000);
                }
            });
            
            // Context menu kapatma
            document.addEventListener('click', function(e) {
                const contextMenu = document.getElementById('contextMenu');
                if (contextMenu && !contextMenu.contains(e.target)) {
                    contextMenu.style.display = 'none';
                }
            });
            
            // Veri geri yükleme inputu
            document.getElementById('restoreFile').addEventListener('change', function(e) {
                restoreData(e);
            });
            
            // Kullanıcı çıkarken verileri yedekle
            window.addEventListener('beforeunload', function(e) {
                guncellenenVerileriKaydet();
                
                // Sekme kapandığında otomatik backup dosyası oluştur
                const backupData = {
                    stokListesi: stokListesi,
                    satisGecmisi: satisGecmisi,
                    musteriler: musteriler,
                    borclarim: borclarim,
                    backupTime: new Date().toISOString(),
                    backupType: 'tab-close'
                };
                
                // Backup dosyasını oluştur
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const backupUrl = URL.createObjectURL(backupBlob);
                
                const a = document.createElement('a');
                a.href = backupUrl;
                a.download = `tab-close-backup_${timestamp}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(backupUrl);
                
                console.log('💾 Sekme kapatılırken backup dosyası oluşturuldu');
            });
        };
        // Manuel senkronizasyon fonksiyonu
        async function manuelSenkronizasyon() {
            try {
                console.log('🔄 Manuel senkronizasyon başlıyor...');
                
                // Sync butonunu döndür
                const syncButton = document.querySelector('.sync-button i');
                syncButton.classList.add('fa-spin');
                
                // Socket üzerinden fresh data iste
                socket.emit('syncRequest');
                
                // 3 saniye sonra butonu durdur
                setTimeout(() => {
                    syncButton.classList.remove('fa-spin');
                }, 3000);
                
                lastSyncTime = Date.now();
                showNotification('🔄 Veriler senkronize ediliyor...', 'info');
                
            } catch (error) {
                console.error('❌ Manuel senkronizasyon hatası:', error);
                showNotification('Senkronizasyon hatası: ' + error.message, 'error');
                
                const syncButton = document.querySelector('.sync-button i');
                syncButton.classList.remove('fa-spin');
            }
        }

        // Veri geri yükleme fonksiyonu
        async function geriYukle() {
            try {
                console.log('🔄 Veri geri yükleme başlıyor...');
                
                // LocalStorage'dan veriyi geri yükle
                const savedData = localStorage.getItem('saban_data');
                if (savedData) {
                    const data = JSON.parse(savedData);
                    
                    stokListesi = data.stokListesi || {};
                    satisGecmisi = data.satisGecmisi || [];
                    musteriler = data.musteriler || {};
                    borclarim = data.borclarim || {};
                    
                    // Tabloları güncelle
                    stokTablosunuGuncelle();
                    satisTablosunuGuncelle();
                    musteriTablosunuGuncelle();
                    guncelleIstatistikler();
                    
                    showNotification('🔄 Veriler localStorage\'dan geri yüklendi', 'success');
                    console.log('✅ Veri geri yükleme başarılı');
                } else {
                    showNotification('⚠️ LocalStorage\'da veri bulunamadı', 'warning');
                }
                
            } catch (error) {
                console.error('❌ Veri geri yükleme hatası:', error);
                showNotification('Veri geri yükleme hatası: ' + error.message, 'error');
            }
        }

        // Email backup fonksiyonu
        async function sendEmailBackup() {
            try {
                console.log('📧 Email backup başlatılıyor...');
                
                const response = await fetch(`${API_BASE}/api/backup-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('📧 Email backup başarıyla gönderildi', 'success');
                } else {
                    throw new Error(result.message);
                }
                
            } catch (error) {
                console.error('❌ Email backup hatası:', error);
                showNotification('Email backup hatası: ' + error.message, 'error');
            }
        }


        
        async function testAPI() {
            try {
                const response = await fetch(`${API_BASE}/api/test`);
                
                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Server JSON yanıtı döndürmedi');
                }
                
                const result = await response.json();
                showNotification(`API Test: ${result.success ? 'Başarılı' : 'Başarısız'}`, result.success ? 'success' : 'error');
            } catch (error) {
                showNotification(`API Test Hatası: ${error.message}`, 'error');
            }
        }
        
        async function testDatabase() {
            try {
                const response = await fetch(`${API_BASE}/api/database-status`);
                
                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Server JSON yanıtı döndürmedi');
                }
                
                const result = await response.json();
                showNotification(`Database Test: ${result.success ? 'Başarılı' : 'Başarısız'}`, result.success ? 'success' : 'error');
            } catch (error) {
                showNotification(`Database Test Hatası: ${error.message}`, 'error');
            }
        }
        
        async function forceSync() {
            try {
                await topluSenkronizasyon();
                showNotification('Zorla senkronizasyon tamamlandı', 'success');
            } catch (error) {
                showNotification(`Senkronizasyon hatası: ${error.message}`, 'error');
            }
        }
        
        function clearLocalStorage() {
            try {
                localStorage.removeItem('saban_data');
                showNotification('LocalStorage temizlendi', 'success');
            } catch (error) {
                showNotification(`LocalStorage temizleme hatası: ${error.message}`, 'error');
            }
        }
