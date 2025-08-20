const puppeteer = require('puppeteer');

async function testSales() {
    console.log('🧪 Satış testleri başlatılıyor...');
    
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    try {
        // Ana sayfaya git
        console.log('📱 Sayfa yükleniyor...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
        
        // Sayfanın yüklenmesini bekle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('✅ Sayfa başarıyla yüklendi');
        
        // Stok yönetimi sekmesine git
        console.log('📦 Stok yönetimi sekmesine geçiliyor...');
        await page.click('div[onclick="window.switchTab(\'stock\')"]');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // İlk ürünü bul ve sat butonuna tıkla
        console.log('🛒 İlk ürün için satış testi...');
        const satButtons = await page.$$('button[onclick*="urunSat"]');
        
        if (satButtons.length > 0) {
            await satButtons[0].click();
            console.log('✅ Satış modalı açıldı');
            
            // Modal'ın açılmasını bekle
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Fiyat girişi alanını bul ve test et
            const fiyatInput = await page.$('#satisFiyati');
            if (fiyatInput) {
                console.log('💰 Fiyat girişi alanı bulundu');
                
                // Test fiyatı gir
                await fiyatInput.type('100');
                console.log('✅ Test fiyatı girildi: 100');
                
                // Miktar girişi
                const miktarInput = await page.$('#satisMiktari');
                if (miktarInput) {
                    await miktarInput.type('1');
                    console.log('✅ Test miktarı girildi: 1');
                }
                
                // Satışı onayla
                const confirmButton = await page.$('button.swal2-confirm');
                if (confirmButton) {
                    await confirmButton.click();
                    console.log('✅ Satış onaylandı');
                    
                    // Başarı mesajını bekle
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Başarı mesajını kontrol et
                    const successMessage = await page.$('.swal2-success');
                    if (successMessage) {
                        console.log('🎉 Satış başarıyla tamamlandı!');
                    } else {
                        console.log('⚠️ Başarı mesajı görünmedi, hata olabilir');
                    }
                }
            } else {
                console.log('❌ Fiyat girişi alanı bulunamadı');
            }
        } else {
            console.log('❌ Satış butonu bulunamadı');
        }
        
        // Satış geçmişi testi
        console.log('📊 Satış geçmişi testi...');
        await page.click('div[onclick="window.switchTab(\'sales\')"]');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Satış geçmişi tablosunu kontrol et
        const salesTable = await page.$('#salesTable');
        if (salesTable) {
            console.log('✅ Satış geçmişi tablosu bulundu');
            
            // İlk satış kaydında düzenle butonunu bul
            const editButtons = await page.$$('button[onclick*="satisDuzenle"]');
            if (editButtons.length > 0) {
                console.log('✅ Düzenle butonu bulundu');
                
                // Düzenle butonuna tıkla
                await editButtons[0].click();
                console.log('✅ Düzenle butonuna tıklandı');
                
                // Stok sekmesine geçiş yapıldığını kontrol et
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const barkodInput = await page.$('#barkod');
                if (barkodInput) {
                    const barkodValue = await barkodInput.evaluate(el => el.value);
                    console.log(`✅ Satış bilgileri forma yüklendi. Barkod: ${barkodValue}`);
                }
            } else {
                console.log('⚠️ Düzenle butonu bulunamadı (henüz satış kaydı olmayabilir)');
            }
        } else {
            console.log('❌ Satış geçmişi tablosu bulunamadı');
        }
        
        console.log('🎯 Test tamamlandı!');
        
    } catch (error) {
        console.error('❌ Test hatası:', error);
    } finally {
        // Test sonuçlarını görmek için biraz bekle
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();
    }
}

// Test'i çalıştır
testSales().catch(console.error);
