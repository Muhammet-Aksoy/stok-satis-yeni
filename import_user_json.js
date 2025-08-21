const Database = require('better-sqlite3');

// Kullanıcının verdiği JSON verisi - SADECE YENİ ÜRÜNLER
const userJsonProducts = {
  "SCH313283_SACHS_": {"barkod": "SCH313283", "urun_adi": "AMORTİSÖR ÖN SOL", "marka": "SACHS", "stok_miktari": 4, "alisFiyati": 1810, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_npbr71", "varyant_id": ""},
  "BSG30300020_BSG_": {"barkod": "BSG30300020", "urun_adi": "AMORTİSÖR ÖN SAĞ", "marka": "BSG", "stok_miktari": 2, "alisFiyati": 782, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_e1ssgf", "varyant_id": ""},
  "BSG30300021_BSG_": {"barkod": "BSG30300021", "urun_adi": "AMORTİSÖR ÖN SOL", "marka": "BSG", "stok_miktari": 3, "alisFiyati": 782, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_zrxl1s", "varyant_id": ""},
  "SCH 230 709_SACHS_": {"barkod": "SCH 230 709", "urun_adi": "AMORTİSÖR ÖN SAĞ", "marka": "SACHS", "stok_miktari": 2, "alisFiyati": 1394, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_l2vpa7", "varyant_id": ""},
  "BSG30300033_BSG_": {"barkod": "BSG30300033", "urun_adi": "AMORTİSÖR ÖN SOL", "marka": "BSG", "stok_miktari": 1, "alisFiyati": 851, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_bkxqw7", "varyant_id": ""},
  "SCH315469_SACHS_": {"barkod": "SCH315469", "urun_adi": "AMORTİSÖR ÖN", "marka": "SACHS", "stok_miktari": 1, "alisFiyati": 1818, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_e0jets", "varyant_id": ""},
  "SCH200375_SACHS_": {"barkod": "SCH200375", "urun_adi": "Ön Amortisör", "marka": "SACHS", "stok_miktari": 1, "alisFiyati": 1818, "satisFiyati": 0, "kategori": "", "aciklama": "SAG/SOL (GAZLI TIP)", "urun_id": "urun_mdz1rnga_sqit6t", "varyant_id": ""},
  "SCH 315241_SACHS_": {"barkod": "SCH 315241", "urun_adi": "AMORTISOR ON SOL", "marka": "SACHS", "stok_miktari": 2, "alisFiyati": 2030, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_ew8fds", "varyant_id": ""},
  "sch 315242_SACHS_": {"barkod": "sch 315242", "urun_adi": "AMORTISOR ON SAG", "marka": "SACHS", "stok_miktari": 2, "alisFiyati": 2169, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_tk5nlo", "varyant_id": ""},
  "sch 290685_SACHS_": {"barkod": "sch 290685", "urun_adi": "AMORTISOR ON GAZLI", "marka": "SACHS", "stok_miktari": 4, "alisFiyati": 1824, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_su1y1n", "varyant_id": ""},
  "93bb 2a451_MGA_": {"barkod": "93bb 2a451", "urun_adi": "VAKUM POMPASI", "marka": "MGA", "stok_miktari": 3, "alisFiyati": 770, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_47g068", "varyant_id": ""},
  "BSG 30-300-031_BSG_": {"barkod": "BSG 30-300-031", "urun_adi": "AMORTİSÖR ÖN SOL", "marka": "BSG", "stok_miktari": 1, "alisFiyati": 833, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_5t2s0b", "varyant_id": ""},
  "313502_SACHS_": {"barkod": "313502", "urun_adi": "Ön Amortisör", "marka": "SACHS", "stok_miktari": 3, "alisFiyati": 1878, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_02srby", "varyant_id": ""},
  "BSG 30300024_BSG_": {"barkod": "BSG 30300024", "urun_adi": "AMORTİSÖR ARKA", "marka": "BSG", "stok_miktari": 6, "alisFiyati": 758, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_731ufq", "varyant_id": ""},
  "BSG 311897_SACHS_": {"barkod": "BSG 311897", "urun_adi": "AMORTİSÖR ARKA", "marka": "SACHS", "stok_miktari": 6, "alisFiyati": 1158, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_ug8mdy", "varyant_id": ""},
  "SCH 230713_SACHS_": {"barkod": "SCH 230713", "urun_adi": "AMORTİSÖR ARKA", "marka": "SACHS", "stok_miktari": 4, "alisFiyati": 1306, "satisFiyati": 0, "kategori": "", "aciklama": "SAG/SOL (SEDAN/H.B)", "urun_id": "urun_mdz1rnga_2yd12l", "varyant_id": ""},
  "SCH 230858_SACHS_": {"barkod": "SCH 230858", "urun_adi": "AMORTİSÖR ARKA", "marka": "SACHS", "stok_miktari": 5, "alisFiyati": 1023, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_tjs4l0", "varyant_id": ""},
  "PN7330608MM_MaysanMado_": {"barkod": "PN7330608MM", "urun_adi": "Arka Amortisör", "marka": "MaysanMado", "stok_miktari": 6, "alisFiyati": 0, "satisFiyati": 0, "kategori": "", "aciklama": "gazlı", "urun_id": "urun_mdz1rnga_i3qz4w", "varyant_id": ""},
  "9T1613404AD_DP_": {"barkod": "9T1613404AD", "urun_adi": "STOP LAMBASI - SAĞ CONNECT  2009-", "marka": "DP", "stok_miktari": 4, "alisFiyati": 467, "satisFiyati": 0, "kategori": "", "aciklama": "CONNECT\n\n2009-", "urun_id": "urun_mdz1rnga_wzy6sx", "varyant_id": ""},
  "6C1113405AC_DP_": {"barkod": "6C1113405AC", "urun_adi": "STOP LAMBASI - SOL", "marka": "DP", "stok_miktari": 10, "alisFiyati": 414, "satisFiyati": 0, "kategori": "", "aciklama": "TRANSIT\n\n2006-", "urun_id": "urun_mdz1rnga_8ftlrt", "varyant_id": ""},
  "6C1113404AC_DP_": {"barkod": "6C1113404AC", "urun_adi": "STOP LAMBASI - SAĞ TRANSIT 2006-", "marka": "DP", "stok_miktari": 3, "alisFiyati": 414, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_oboaw7", "varyant_id": ""},
  "XS4J 8591 DB_dp-OES_": {"barkod": "XS4J 8591 DB", "urun_adi": "DEVİRDAİM KORNET", "marka": "dp-OES", "stok_miktari": 5, "alisFiyati": 1160, "satisFiyati": 0, "kategori": "", "aciklama": "", "urun_id": "urun_mdz1rnga_j6kl1p", "varyant_id": ""}
};

const db = new Database('veriler/veritabani.db');

console.log('🚀 KULLANICI JSON VERİSİNDEN EKSİK ÜRÜN İMPORT İŞLEMİ\n');

console.log(`📋 Kontrol edilecek ürün sayısı: ${Object.keys(userJsonProducts).length}`);

// Önce sistemdeki mevcut durumu öğren
const currentStats = db.prepare(`
    SELECT 
        COUNT(*) as count,
        SUM(miktar * alisFiyati) as total_value
    FROM stok
`).get();

console.log(`📊 İşlem öncesi sistem durumu:`);
console.log(`   Ürün sayısı: ${currentStats.count}`);
console.log(`   Toplam değer: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL\n`);

let foundCount = 0;
let missingCount = 0;
const missingProducts = [];

console.log('🔍 Eksik ürünler tespit ediliyor...\n');

for (const [key, product] of Object.entries(userJsonProducts)) {
    // Composite key ile kontrol et (barkod + marka)
    const existing = db.prepare(`
        SELECT * FROM stok 
        WHERE barkod = ? AND marka = ?
    `).get(
        product.barkod, 
        product.marka || ''
    );

    if (existing) {
        foundCount++;
        console.log(`✅ MEVCUT: ${product.barkod} - ${product.urun_adi} (${product.marka || 'Marka yok'})`);
    } else {
        missingCount++;
        missingProducts.push(product);
        console.log(`❌ EKSİK: ${product.barkod} - ${product.urun_adi} (${product.marka || 'Marka yok'})`);
    }
}

console.log('\n' + '='.repeat(80));
console.log('EKSİK ÜRÜN ANALİZİ');
console.log('='.repeat(80));
console.log(`✅ Sistemde mevcut: ${foundCount} ürün`);
console.log(`❌ Eksik olan: ${missingCount} ürün`);

if (missingCount > 0) {
    console.log(`\n🚀 ${missingCount} EKSİK ÜRÜN EKLENİYOR...\n`);
    
    const insertStmt = db.prepare(`
        INSERT INTO stok 
        (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const transaction = db.transaction(() => {
        let addedCount = 0;
        let totalValue = 0;
        let errorCount = 0;
        
        missingProducts.forEach((product, index) => {
            try {
                insertStmt.run(
                    product.urun_id,
                    product.barkod,
                    product.urun_adi,
                    product.marka || '',
                    product.stok_miktari || 0,
                    product.alisFiyati || 0,
                    product.satisFiyati || 0,
                    product.kategori || '',
                    product.aciklama || '',
                    product.varyant_id || ''
                );
                addedCount++;
                totalValue += (product.stok_miktari || 0) * (product.alisFiyati || 0);
                
                console.log(`➕ EKLENDİ: ${product.barkod} - ${product.urun_adi} (${product.marka || 'Marka yok'})`);
                
            } catch (error) {
                errorCount++;
                console.error(`❌ HATA: ${product.barkod} - ${error.message}`);
            }
        });
        
        return { addedCount, totalValue, errorCount };
    });

    console.log('⏳ Transaction başlatılıyor...');
    const result = transaction();
    
    console.log('\n' + '='.repeat(80));
    console.log('EKLEME SONUÇLARI');
    console.log('='.repeat(80));
    console.log(`🎉 Başarıyla eklenen: ${result.addedCount} ürün`);
    if (result.errorCount > 0) {
        console.log(`❌ Hata olan: ${result.errorCount} ürün`);
    }
    console.log(`💰 Eklenen ürünlerin toplam değeri: ${result.totalValue.toLocaleString('tr-TR')} TL`);
} else {
    console.log('\n🎉 Kontrol edilen tüm ürünler zaten sistemde mevcut!');
}

// Son durum
const finalStats = db.prepare(`
    SELECT 
        COUNT(*) as total_count,
        SUM(miktar * alisFiyati) as total_value,
        COUNT(DISTINCT marka) as brand_count
    FROM stok
`).get();

console.log('\n' + '='.repeat(80));
console.log('GÜNCEL SİSTEM DURUMU');
console.log('='.repeat(80));
console.log(`📊 Toplam ürün sayısı: ${finalStats.total_count} (önceki: ${currentStats.count})`);
console.log(`💰 Toplam stok değeri: ${(finalStats.total_value || 0).toLocaleString('tr-TR')} TL (önceki: ${(currentStats.total_value || 0).toLocaleString('tr-TR')} TL)`);
console.log(`🏷️ Farklı marka sayısı: ${finalStats.brand_count}`);

const addedProductCount = finalStats.total_count - currentStats.count;
const addedValue = (finalStats.total_value || 0) - (currentStats.total_value || 0);

if (addedProductCount > 0) {
    console.log(`\n📈 DEĞİŞİM:`);
    console.log(`   +${addedProductCount} ürün eklendi`);
    console.log(`   +${addedValue.toLocaleString('tr-TR')} TL değer artışı`);
}

db.close();

console.log('\n✅ Kullanıcı JSON import işlemi tamamlandı!');