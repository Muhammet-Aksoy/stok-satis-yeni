const Database = require('better-sqlite3');

// Tüm stok listesi (verilen JSON'dan)
const allProducts = {
  "230965__": {
    "barkod": "230965",
    "urun_adi": "V184 Ön Amörtisör",
    "marka": "",
    "stok_miktari": 2,
    "alisFiyati": 1750,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "kod:2C16 18045 AA",
    "urun_id": "urun_mdz1rng9_zac5id",
    "varyant_id": ""
  },
  "6C1118045_ORJ_": {
    "barkod": "6C1118045",
    "urun_adi": "Ön Amortisör",
    "marka": "ORJ",
    "stok_miktari": 5,
    "alisFiyati": 2000,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_8vpcmh",
    "varyant_id": ""
  },
  "BK3118045 BSG_BSG_": {
    "barkod": "BK3118045 BSG",
    "urun_adi": "Ön Amortisör",
    "marka": "BSG",
    "stok_miktari": 2,
    "alisFiyati": 800,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_6ns25l",
    "varyant_id": ""
  },
  "BK3118045 ORJ_ORJ_": {
    "barkod": "BK3118045 ORJ",
    "urun_adi": "Ön Amortisör",
    "marka": "ORJ",
    "stok_miktari": 4,
    "alisFiyati": 2580,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_1vxp4k",
    "varyant_id": ""
  },
  "5C161K353CC__": {
    "barkod": "5C161K353CC",
    "urun_adi": "STEPNE TAŞIYICI Ö.ÇEKER",
    "marka": "",
    "stok_miktari": 1,
    "alisFiyati": 3000,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_ran7xo",
    "varyant_id": ""
  },
  "6C1118045NE_DP_": {
    "barkod": "6C1118045NE",
    "urun_adi": "v347 Ön Amortisör",
    "marka": "DP",
    "stok_miktari": 4,
    "alisFiyati": 1500,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_y8la5r",
    "varyant_id": ""
  },
  "5C161K353 BC_ORJ_": {
    "barkod": "5C161K353 BC",
    "urun_adi": "STEPNE TAŞIYICI Arka Çift Teker",
    "marka": "ORJ",
    "stok_miktari": 6,
    "alisFiyati": 2500,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_wm7hqo",
    "varyant_id": ""
  },
  "95VT1K353AA_SOMSAN_": {
    "barkod": "95VT1K353AA",
    "urun_adi": "İSTETME TAŞIYICISI T12",
    "marka": "SOMSAN",
    "stok_miktari": 2,
    "alisFiyati": 1050,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_988xit",
    "varyant_id": ""
  },
  "8C1V 2A 315__": {
    "barkod": "8C1V 2A 315",
    "urun_adi": "Arka Disk Aynası 200PC",
    "marka": "",
    "stok_miktari": 6,
    "alisFiyati": 725,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_z7v0qo",
    "varyant_id": ""
  },
  "8C1V 1125 AA__": {
    "barkod": "8C1V 1125 AA",
    "urun_adi": "Ön Disk Ayna Transit - ÖÇ",
    "marka": "",
    "stok_miktari": 5,
    "alisFiyati": 950,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_n4iq55",
    "varyant_id": ""
  },
  "BK3118045 VOTTO_VOTTO_": {
    "barkod": "BK3118045 VOTTO",
    "urun_adi": "V363 Ön Amortisör",
    "marka": "VOTTO",
    "stok_miktari": 3,
    "alisFiyati": 1500,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_184fd3",
    "varyant_id": ""
  },
  "5C161K353_DP_": {
    "barkod": "5C161K353",
    "urun_adi": "Tek teker istetme taşıyıcısı",
    "marka": "DP",
    "stok_miktari": 1,
    "alisFiyati": 1200,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_q0tym0",
    "varyant_id": ""
  },
  "5C16 1K353 DC_DC_": {
    "barkod": "5C16 1K353 DC",
    "urun_adi": "STEPNE TAŞIYICI Ö.ÇEKER UZUN ŞASE",
    "marka": "DC",
    "stok_miktari": 1,
    "alisFiyati": 4500,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_mh42jf",
    "varyant_id": ""
  },
  "95VT1K353BA_SOMSAN_": {
    "barkod": "95VT1K353BA",
    "urun_adi": "T15 İSTETME TAŞIYICISI",
    "marka": "SOMSAN",
    "stok_miktari": 4,
    "alisFiyati": 1000,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_ctu4kt",
    "varyant_id": ""
  },
  "5C161K353 BC ORJ_ORJ_": {
    "barkod": "5C161K353 BC ORJ",
    "urun_adi": "STEPNE TAŞIYICI Arka Çift Teker",
    "marka": "ORJ",
    "stok_miktari": 6,
    "alisFiyati": 2500,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_2al5oq",
    "varyant_id": ""
  },
  "YC15 2261 AA_Naiba_": {
    "barkod": "YC15 2261 AA",
    "urun_adi": "Arka Fren Silindiri",
    "marka": "Naiba",
    "stok_miktari": 18,
    "alisFiyati": 320,
    "satisFiyati": 0,
    "kategori": "",
    "aciklama": "",
    "urun_id": "urun_mdz1rnga_clb849",
    "varyant_id": ""
  }
};

const db = new Database('veritabani.db');

console.log('🚀 Tüm ürünlerin eklenmesi başlıyor...');

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO stok 
  (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const transaction = db.transaction(() => {
  let count = 0;
  let errors = 0;
  
  for (const [key, urun] of Object.entries(allProducts)) {
    try {
      insertStmt.run(
        urun.urun_id,
        urun.barkod,
        urun.urun_adi,
        urun.marka || '',
        urun.stok_miktari || 0,
        urun.alisFiyati || 0,
        urun.satisFiyati || 0,
        urun.kategori || '',
        urun.aciklama || '',
        urun.varyant_id || ''
      );
      count++;
      
      if (count % 50 === 0) {
        console.log(`⏳ ${count} ürün işlendi...`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Hata [${key}]: ${error.message}`);
    }
  }
  
  return { count, errors };
});

const result = transaction();
console.log(`\n🎉 İşlem tamamlandı!`);
console.log(`✅ Başarıyla eklenen: ${result.count}`);
console.log(`❌ Hata olan: ${result.errors}`);

// Son kontrol
const totalCount = db.prepare('SELECT COUNT(*) as count FROM stok').get();
console.log(`📊 Veritabanındaki toplam ürün sayısı: ${totalCount.count}`);

db.close();