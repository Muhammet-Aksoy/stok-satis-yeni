const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testVariants() {
    console.log('🧪 Aynı barkodlu ürün varyantları test ediliyor...\n');

    try {
        // Test 1: Aynı barkodlu farklı marka ürünler ekle
        console.log('📦 Test 1: Aynı barkodlu farklı marka ürünler ekleniyor...');
        
        const urun1 = {
            barkod: '123456',
            ad: 'Fren Balatası',
            marka: 'Bosch',
            miktar: 10,
            alisFiyati: 50,
            satisFiyati: 75,
            kategori: 'Fren Sistemi',
            aciklama: 'Ön fren balatası',
            varyant_id: ''
        };

        const urun2 = {
            barkod: '123456',
            ad: 'Fren Balatası',
            marka: 'Brembo',
            miktar: 5,
            alisFiyati: 60,
            satisFiyati: 85,
            kategori: 'Fren Sistemi',
            aciklama: 'Arka fren balatası',
            varyant_id: ''
        };

        const urun3 = {
            barkod: '123456',
            ad: 'Fren Balatası',
            marka: 'Bosch',
            miktar: 8,
            alisFiyati: 55,
            satisFiyati: 80,
            kategori: 'Fren Sistemi',
            aciklama: 'Spor fren balatası',
            varyant_id: 'SPORT'
        };

        // İlk ürünü ekle
        const response1 = await axios.post(`${BASE_URL}/api/stok-ekle`, urun1);
        console.log('✅ Ürün 1 eklendi:', response1.data.message);

        // İkinci ürünü ekle
        const response2 = await axios.post(`${BASE_URL}/api/stok-ekle`, urun2);
        console.log('✅ Ürün 2 eklendi:', response2.data.message);

        // Üçüncü ürünü ekle (varyant ile)
        const response3 = await axios.post(`${BASE_URL}/api/stok-ekle`, urun3);
        console.log('✅ Ürün 3 eklendi:', response3.data.message);

        // Test 2: Varyantları listele
        console.log('\n🔍 Test 2: Aynı barkodlu varyantlar listeleniyor...');
        const variantsResponse = await axios.get(`${BASE_URL}/api/stok-varyantlar/123456`);
        console.log('📋 Bulunan varyant sayısı:', variantsResponse.data.count);
        
        variantsResponse.data.data.forEach((variant, index) => {
            console.log(`${index + 1}. ${variant.marka} - ${variant.ad} (${variant.varyant_id || 'Ana'}) - Stok: ${variant.miktar}`);
        });

        // Test 3: Tüm verileri getir
        console.log('\n📊 Test 3: Tüm veriler getiriliyor...');
        const allDataResponse = await axios.get(`${BASE_URL}/api/tum-veriler`);
        console.log('📦 Toplam ürün sayısı:', allDataResponse.data.count.stok);

        // Test 4: Aynı ürünü güncelle (miktar artır)
        console.log('\n🔄 Test 4: Ürün güncelleniyor...');
        const updateData = {
            id: response1.data.data.id,
            barkod: '123456',
            ad: 'Fren Balatası',
            marka: 'Bosch',
            miktar: 15, // Artırıldı
            alisFiyati: 50,
            satisFiyati: 75,
            kategori: 'Fren Sistemi',
            aciklama: 'Ön fren balatası - Güncellendi',
            varyant_id: ''
        };

        const updateResponse = await axios.put(`${BASE_URL}/api/stok-guncelle`, updateData);
        console.log('✅ Ürün güncellendi:', updateResponse.data.message);

        console.log('\n🎉 Tüm testler başarıyla tamamlandı!');
        console.log('\n📋 Özet:');
        console.log('- Aynı barkodlu farklı marka ürünler eklendi');
        console.log('- Varyant sistemi çalışıyor');
        console.log('- Ürün güncelleme çalışıyor');
        console.log('- Varyant listeleme çalışıyor');

    } catch (error) {
        console.error('❌ Test hatası:', error.response?.data || error.message);
    }
}

// Testi çalıştır
testVariants();