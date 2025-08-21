const fetch = require(\"node-fetch\");

async function testSyncIssues() {
    console.log(\"🔍 Senkronizasyon sorunları test ediliyor...\");
    
    try {
        // 1. Yeni bir satış ekle
        console.log(\"💰 Yeni satış ekleniyor...\");
        const newSale = {
            barkod: \"SYNC_TEST_\" + Date.now(),
            urunAdi: \"Senkronizasyon Test Ürünü\",
            miktar: 1,
            fiyat: 50,
            alisFiyati: 30,
            toplam: 50,
            borc: false,
            tarih: new Date().toISOString(),
            musteriId: \"\",
            musteriAdi: \"\"
        };
        
        const addSaleResponse = await fetch(\"http://localhost:3001/api/satis-ekle\", {
            method: \"POST\",
            headers: { \"Content-Type\": \"application/json\" },
            body: JSON.stringify(newSale)
        });
        
        const addResult = await addSaleResponse.json();
        console.log(\"💰 Satış ekleme sonucu:\", addResult.success ? \"Başarılı\" : \"Başarısız\");
        
        if (addResult.success) {
            const newSaleId = addResult.data.id;
            console.log(`📝 Yeni satış ID: ${newSaleId}`);
            
            // Satışı tekrar kontrol et
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const checkResponse = await fetch(`http://localhost:3001/api/satis-kontrol?id=${newSaleId}`);
            const checkResult = await checkResponse.json();
            
            if (checkResult.success && checkResult.exists) {
                console.log(\"✅ Satış veritabanında mevcut\");
            } else {
                console.log(\"❌ Satış veritabanında bulunamadı!\");
            }
        }
        
    } catch (error) {
        console.error(\"❌ Test hatası:\", error.message);
    }
}

testSyncIssues().catch(console.error);
