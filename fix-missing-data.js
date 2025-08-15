const fs = require('fs-extra');
const path = require('path');

// Backup dosyalarından eksik verileri tespit et ve ekle
async function fixMissingData() {
    try {
        console.log('🔍 Eksik veriler tespit ediliyor...');
        
        // En güncel backup dosyasını oku
        const backupPath = path.join(__dirname, 'veriler', 'backups', 'backup_2025-08-14T12-40-32-395Z.json');
        const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
        
        // Mevcut verileri oku
        const stokPath = path.join(__dirname, 'veriler', 'stok.json');
        const musteriPath = path.join(__dirname, 'veriler', 'musteriler.json');
        const satisPath = path.join(__dirname, 'veriler', 'satisGecmisi.json');
        const borcPath = path.join(__dirname, 'veriler', 'borclarim.json');
        
        const currentStok = JSON.parse(await fs.readFile(stokPath, 'utf8'));
        const currentMusteri = JSON.parse(await fs.readFile(musteriPath, 'utf8'));
        const currentSatis = JSON.parse(await fs.readFile(satisPath, 'utf8'));
        const currentBorc = JSON.parse(await fs.readFile(borcPath, 'utf8'));
        
        let addedProducts = 0;
        let addedCustomers = 0;
        let addedSales = 0;
        let addedDebts = 0;
        
        // Stok verilerini karşılaştır ve eksik olanları ekle
        for (const [key, product] of Object.entries(backupData.stokListesi)) {
            const existingProduct = Object.values(currentStok).find(p => p.barkod === product.barkod);
            if (!existingProduct) {
                const newId = Object.keys(currentStok).length + 1;
                currentStok[newId] = {
                    id: parseInt(newId),
                    ...product,
                    updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                };
                addedProducts++;
                console.log(`➕ Yeni ürün eklendi: ${product.urun_adi} (${product.barkod})`);
            }
        }
        
        // Müşteri verilerini karşılaştır
        if (backupData.musteriListesi) {
            for (const [key, customer] of Object.entries(backupData.musteriListesi)) {
                const existingCustomer = Object.values(currentMusteri).find(c => c.musteri_id === customer.musteri_id);
                if (!existingCustomer) {
                    const newId = Object.keys(currentMusteri).length + 1;
                    currentMusteri[newId] = {
                        id: parseInt(newId),
                        ...customer,
                        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    };
                    addedCustomers++;
                    console.log(`➕ Yeni müşteri eklendi: ${customer.musteri_adi}`);
                }
            }
        }
        
        // Satış geçmişi verilerini karşılaştır
        if (backupData.satisGecmisi) {
            for (const [key, sale] of Object.entries(backupData.satisGecmisi)) {
                const existingSale = Object.values(currentSatis).find(s => s.satis_id === sale.satis_id);
                if (!existingSale) {
                    const newId = Object.keys(currentSatis).length + 1;
                    currentSatis[newId] = {
                        id: parseInt(newId),
                        ...sale,
                        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    };
                    addedSales++;
                    console.log(`➕ Yeni satış eklendi: ${sale.urun_adi} - ${sale.musteri_adi}`);
                }
            }
        }
        
        // Borç verilerini karşılaştır
        if (backupData.borcListesi) {
            for (const [key, debt] of Object.entries(backupData.borcListesi)) {
                const existingDebt = Object.values(currentBorc).find(b => b.borc_id === debt.borc_id);
                if (!existingDebt) {
                    const newId = Object.keys(currentBorc).length + 1;
                    currentBorc[newId] = {
                        id: parseInt(newId),
                        ...debt,
                        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    };
                    addedDebts++;
                    console.log(`➕ Yeni borç eklendi: ${debt.musteri_adi} - ${debt.tutar} TL`);
                }
            }
        }
        
        // Güncellenmiş verileri kaydet
        await fs.writeFile(stokPath, JSON.stringify(currentStok, null, 2));
        await fs.writeFile(musteriPath, JSON.stringify(currentMusteri, null, 2));
        await fs.writeFile(satisPath, JSON.stringify(currentSatis, null, 2));
        await fs.writeFile(borcPath, JSON.stringify(currentBorc, null, 2));
        
        console.log(`\n✅ Veri senkronizasyonu tamamlandı:`);
        console.log(`   📦 ${addedProducts} yeni ürün eklendi`);
        console.log(`   👥 ${addedCustomers} yeni müşteri eklendi`);
        console.log(`   💰 ${addedSales} yeni satış eklendi`);
        console.log(`   💳 ${addedDebts} yeni borç eklendi`);
        
        // Tüm verileri tek dosyada birleştir
        const tumVeriler = {
            timestamp: new Date().toISOString(),
            stokListesi: currentStok,
            musteriListesi: currentMusteri,
            satisGecmisi: currentSatis,
            borcListesi: currentBorc
        };
        
        const tumVerilerPath = path.join(__dirname, 'veriler', 'tumVeriler_synced.json');
        await fs.writeFile(tumVerilerPath, JSON.stringify(tumVeriler, null, 2));
        console.log(`\n💾 Tüm veriler 'tumVeriler_synced.json' dosyasında birleştirildi`);
        
    } catch (error) {
        console.error('❌ Hata:', error.message);
    }
}

// Script çalıştır
fixMissingData();
