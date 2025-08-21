const Database = require('better-sqlite3');

// Verilen JSON verisi
const stokListesi = {
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
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
    "varyant_id": "",
    "created_at": "2025-08-05 21:24:26",
    "updated_at": "2025-08-14 08:15:22"
  }
};

const db = new Database('veritabani.db');

console.log('🚀 Ürün ekleme işlemi başlıyor...');

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO stok 
  (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  let count = 0;
  for (const [key, urun] of Object.entries(stokListesi)) {
    try {
      insertStmt.run(
        urun.urun_id,
        urun.barkod,
        urun.urun_adi,
        urun.marka || '',
        urun.stok_miktari,
        urun.alisFiyati,
        urun.satisFiyati,
        urun.kategori || '',
        urun.aciklama || '',
        urun.varyant_id || '',
        urun.created_at,
        urun.updated_at
      );
      count++;
      console.log(`✅ Eklendi: ${urun.barkod} - ${urun.urun_adi} (${urun.marka || 'Marka yok'})`);
    } catch (error) {
      console.error(`❌ Hata: ${key}`, error.message);
    }
  }
  return count;
});

const result = transaction();
console.log(`\n🎉 Toplam ${result} ürün başarıyla eklendi/güncellendi!`);

db.close();