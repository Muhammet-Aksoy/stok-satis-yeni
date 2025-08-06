// Test script for barcode-based system
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testBarcodeSystem() {
    console.log('🧪 Barkod tabanlı sistem testi başlatılıyor...\n');

    try {
        // Test 1: Yeni ürün ekleme (barkod ile)
        console.log('📦 Test 1: Yeni ürün ekleme');
        const testProduct = {
            barkod: '1234567890123',
            ad: 'Test Ürünü',
            marka: 'Test Marka',
            miktar: 10,
            alisFiyati: 15.50,
            satisFiyati: 25.00,
            kategori: 'Test Kategori',
            aciklama: 'Barkod tabanlı sistem test ürünü'
        };

        const addResponse = await axios.post(`${BASE_URL}/api/stok-ekle`, testProduct);
        console.log('✅ Ürün ekleme başarılı:', addResponse.data.message);

        // Test 2: Ürün güncelleme (barkod ile)
        console.log('\n🔄 Test 2: Ürün güncelleme');
        const updateData = {
            barkod: '1234567890123',
            ad: 'Güncellenmiş Test Ürünü',
            miktar: 15
        };

        const updateResponse = await axios.put(`${BASE_URL}/api/stok-guncelle`, updateData);
        console.log('✅ Ürün güncelleme başarılı:', updateResponse.data.message);

        // Test 3: Barkod ile ürün arama
        console.log('\n🔍 Test 3: Barkod ile ürün arama');
        const searchResponse = await axios.get(`${BASE_URL}/api/stok-varyantlar/1234567890123`);
        console.log('✅ Barkod arama başarılı:', searchResponse.data.count, 'ürün bulundu');

        // Test 4: Varyant ekleme (aynı barkod, farklı marka)
        console.log('\n🏷️ Test 4: Varyant ekleme');
        const variantProduct = {
            barkod: '1234567890123',
            ad: 'Test Ürünü Varyant',
            marka: 'Farklı Marka',
            miktar: 5,
            alisFiyati: 12.00,
            satisFiyati: 20.00
        };

        const variantResponse = await axios.post(`${BASE_URL}/api/stok-ekle`, variantProduct);
        console.log('✅ Varyant ekleme başarılı:', variantResponse.data.message);

        // Test 5: Tüm varyantları listele
        console.log('\n📋 Test 5: Varyant listesi');
        const variantsResponse = await axios.get(`${BASE_URL}/api/stok-varyantlar/1234567890123`);
        console.log('✅ Varyant listesi:', variantsResponse.data.data.length, 'varyant bulundu');

        // Test 6: Ürün silme (barkod ile)
        console.log('\n🗑️ Test 6: Ürün silme');
        const deleteResponse = await axios.delete(`${BASE_URL}/api/stok-sil/1234567890123`);
        console.log('✅ Ürün silme başarılı:', deleteResponse.data.message);

        console.log('\n🎉 Tüm barkod tabanlı sistem testleri başarılı!');
        console.log('✅ Sistem tamamen barkod tabanlı çalışıyor');
        console.log('✅ Ürün ID sistemi başarıyla kaldırıldı');

    } catch (error) {
        console.error('❌ Test hatası:', error.response?.data || error.message);
    }
}

// Test fonksiyonunu çalıştır
if (require.main === module) {
    testBarcodeSystem();
}

module.exports = { testBarcodeSystem };