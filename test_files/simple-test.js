const fetch = require('node-fetch');

async function testSales() {
    console.log('🧪 Basit satış testi başlatılıyor...');
    
    try {
        // Önce veritabanı durumunu kontrol et
        console.log('📊 Veritabanı durumu kontrol ediliyor...');
        const dbResponse = await fetch('http://localhost:3000/api/database-status');
        const dbStatus = await dbResponse.json();
        console.log('✅ Veritabanı durumu:', dbStatus);
        
        // Önce test ürünü ekle
        console.log('📦 Test ürünü ekleniyor...');
        const testProduct = {
            barkod: 'TEST001',
            ad: 'Test Ürün',
            marka: 'Test Marka',
            miktar: 10,
            alisFiyati: 80,
            satisFiyati: 100,
            aciklama: 'Test amaçlı ürün'
        };
        
        const productResponse = await fetch('http://localhost:3000/api/stok-ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testProduct)
        });
        
        const productResult = await productResponse.json();
        console.log('📦 Ürün ekleme sonucu:', productResult);
        
        if (!productResult.success) {
            console.log('⚠️ Ürün eklenemedi, mevcut ürün olabilir');
        }
        
        // Satış ekleme testi
        console.log('💰 Satış ekleme testi...');
        const testSale = {
            barkod: 'TEST001',
            urunAdi: 'Test Ürün',
            miktar: 1,
            fiyat: 100,
            alisFiyati: 80,
            toplam: 100,
            borc: false,
            tarih: new Date().toISOString(),
            musteriId: '',
            musteriAdi: ''
        };
        
        const saleResponse = await fetch('http://localhost:3000/api/satis-ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testSale)
        });
        
        const saleResult = await saleResponse.json();
        console.log('💰 Satış sonucu:', saleResult);
        
        if (saleResult.success) {
            console.log('🎉 Satış başarıyla eklendi!');
        } else {
            console.log('❌ Satış eklenemedi:', saleResult.error || saleResult.message);
        }
        
    } catch (error) {
        console.error('❌ Test hatası:', error);
    }
}

// Test'i çalıştır
testSales().catch(console.error);
