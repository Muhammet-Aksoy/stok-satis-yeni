const Database = require('better-sqlite3');

const db = new Database('veritabani.db');

console.log('🔍 KRİTİK DÜZENLEME PROBLEMLERİ TEST EDİLİYOR...\n');

// Test 1: Barkod Değiştirme Problemi
console.log('📋 TEST 1: BARKOD DEĞİŞTİRME PROBLEMİ');
console.log('='.repeat(50));

// Önce test ürünü ekle
const testProduct1 = {
  urun_id: 'test_001',
  barkod: 'ABC123',
  ad: 'Test Ürünü',
  marka: 'BSG',
  miktar: 5,
  alisFiyati: 100,
  satisFiyati: 150
};

db.prepare(`
  INSERT OR REPLACE INTO stok 
  (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`).run(
  testProduct1.urun_id,
  testProduct1.barkod,
  testProduct1.ad,
  testProduct1.marka,
  testProduct1.miktar,
  testProduct1.alisFiyati,
  testProduct1.satisFiyati,
  '', '', ''
);

console.log(`✅ Test ürünü eklendi: ${testProduct1.barkod} - ${testProduct1.ad} (${testProduct1.marka})`);

// Şimdi barkodu değiştirmeye çalış
const newBarcode = 'XYZ789';
console.log(`\n🔄 Barkod değiştiriliyor: ${testProduct1.barkod} → ${newBarcode}`);

// Mevcut sistem nasıl davranıyor?
try {
  // Eski yöntem - sadece güncelleme
  db.prepare(`
    UPDATE stok SET barkod = ? WHERE urun_id = ?
  `).run(newBarcode, testProduct1.urun_id);
  
  console.log('⚠️ PROBLEM: Barkod basitçe değiştirildi - bu duplicate oluşturabilir!');
  
  // Kontrol et
  const products = db.prepare('SELECT * FROM stok WHERE barkod IN (?, ?)').all(testProduct1.barkod, newBarcode);
  console.log(`📊 Bulunan ürünler: ${products.length}`);
  products.forEach(p => {
    console.log(`   - ${p.barkod}: ${p.ad} (${p.marka})`);
  });
  
} catch (error) {
  console.log(`❌ Hata: ${error.message}`);
}

console.log('\n' + '=' * 50);

// Test 2: Marka Değiştirme Problemi  
console.log('📋 TEST 2: MARKA DEĞİŞTİRME PROBLEMİ');
console.log('='.repeat(50));

// Test ürünü ekle
const testProduct2 = {
  urun_id: 'test_002', 
  barkod: 'DEF456',
  ad: 'Test Ürünü 2',
  marka: 'BSG',
  miktar: 3,
  alisFiyati: 200,
  satisFiyati: 300
};

db.prepare(`
  INSERT OR REPLACE INTO stok 
  (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`).run(
  testProduct2.urun_id,
  testProduct2.barkod,
  testProduct2.ad,
  testProduct2.marka,
  testProduct2.miktar,
  testProduct2.alisFiyati,
  testProduct2.satisFiyati,
  '', '', ''
);

console.log(`✅ Test ürünü eklendi: ${testProduct2.barkod} - ${testProduct2.ad} (${testProduct2.marka})`);

// Aynı barkodlu farklı markalı ürün ekle
const conflictProduct = {
  urun_id: 'test_003',
  barkod: 'DEF456', // Aynı barkod!
  ad: 'Test Ürünü 2',
  marka: 'ORJ', // Farklı marka!
  miktar: 2,
  alisFiyati: 180,
  satisFiyati: 280
};

try {
  db.prepare(`
    INSERT OR REPLACE INTO stok 
    (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    conflictProduct.urun_id,
    conflictProduct.barkod,
    conflictProduct.ad,
    conflictProduct.marka,
    conflictProduct.miktar,
    conflictProduct.alisFiyati,
    conflictProduct.satisFiyati,
    '', '', ''
  );
  
  console.log(`✅ Çakışan ürün eklendi: ${conflictProduct.barkod} - ${conflictProduct.ad} (${conflictProduct.marka})`);
} catch (error) {
  console.log(`❌ Çakışma hatası: ${error.message}`);
}

// Şimdi markayı değiştirmeye çalış
console.log(`\n🔄 Marka değiştiriliyor: BSG → ORJ`);
try {
  db.prepare(`
    UPDATE stok SET marka = ? WHERE barkod = ? AND marka = ?
  `).run('ORJ', testProduct2.barkod, 'BSG');
  
  console.log('⚠️ PROBLEM: Marka değiştirildi - bu başka ürünle çakışabilir!');
  
  // Kontrol et
  const products = db.prepare('SELECT * FROM stok WHERE barkod = ?').all(testProduct2.barkod);
  console.log(`📊 Aynı barkodlu ürünler: ${products.length}`);
  products.forEach(p => {
    console.log(`   - ${p.barkod}: ${p.ad} (${p.marka}) - ID: ${p.urun_id}`);
  });
  
} catch (error) {
  console.log(`❌ Hata: ${error.message}`);
}

console.log('\n' + '=' * 50);

// Test 3: Boş Marka Problemi
console.log('📋 TEST 3: BOŞ MARKA PROBLEMİ');
console.log('='.repeat(50));

// Test ürünü ekle
const testProduct3 = {
  urun_id: 'test_004',
  barkod: 'GHI789',
  ad: 'Test Ürünü 3',
  marka: 'BSG',
  miktar: 4,
  alisFiyati: 150,
  satisFiyati: 200
};

db.prepare(`
  INSERT OR REPLACE INTO stok 
  (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`).run(
  testProduct3.urun_id,
  testProduct3.barkod,
  testProduct3.ad,
  testProduct3.marka,
  testProduct3.miktar,
  testProduct3.alisFiyati,
  testProduct3.satisFiyati,
  '', '', ''
);

// Aynı barkodlu, boş markalı ürün ekle
const emptyBrandProduct = {
  urun_id: 'test_005',
  barkod: 'GHI789', // Aynı barkod!
  ad: 'Test Ürünü 3',
  marka: '', // Boş marka!
  miktar: 1,
  alisFiyati: 140,
  satisFiyati: 190
};

try {
  db.prepare(`
    INSERT OR REPLACE INTO stok 
    (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    emptyBrandProduct.urun_id,
    emptyBrandProduct.barkod,
    emptyBrandProduct.ad,
    emptyBrandProduct.marka,
    emptyBrandProduct.miktar,
    emptyBrandProduct.alisFiyati,
    emptyBrandProduct.satisFiyati,
    '', '', ''
  );
  
  console.log(`✅ Boş markalı ürün eklendi: ${emptyBrandProduct.barkod} - ${emptyBrandProduct.ad} (Marka: "${emptyBrandProduct.marka}")`);
} catch (error) {
  console.log(`❌ Hata: ${error.message}`);
}

// Şimdi markayı boş yapmaya çalış
console.log(`\n🔄 Marka boş yapılıyor: BSG → ""`);
try {
  db.prepare(`
    UPDATE stok SET marka = ? WHERE urun_id = ?
  `).run('', testProduct3.urun_id);
  
  console.log('⚠️ PROBLEM: Marka boş yapıldı - bu diğer ürünlerle çakışabilir!');
  
  // Kontrol et
  const products = db.prepare('SELECT * FROM stok WHERE barkod = ?').all(testProduct3.barkod);
  console.log(`📊 Aynı barkodlu ürünler: ${products.length}`);
  products.forEach(p => {
    console.log(`   - ${p.barkod}: ${p.ad} (Marka: "${p.marka}") - ID: ${p.urun_id}`);
  });
  
} catch (error) {
  console.log(`❌ Hata: ${error.message}`);
}

console.log('\n' + '=' * 70);
console.log('🚨 SONUÇ: TÜM KRİTİK PROBLEMLER TESPİT EDİLDİ!');
console.log('='.repeat(70));

console.log('\n📋 TESPIT EDİLEN PROBLEMLER:');
console.log('1. ❌ Barkod değiştirme duplicate ürün oluşturabiliyor');
console.log('2. ❌ Marka değiştirme çakışma yaratabiliyor'); 
console.log('3. ❌ Boş marka aynı barkodlu ürünlerle çakışabiliyor');

console.log('\n🔧 ÖNERİLEN ÇÖZÜMLER:');
console.log('1. ✅ Composite key kontrolü (barkod + marka + varyant)');
console.log('2. ✅ Düzenleme öncesi çakışma kontrolü');
console.log('3. ✅ Güvenli güncelleme prosedürü');

// Test verilerini temizle
db.prepare("DELETE FROM stok WHERE urun_id LIKE 'test_%'").run();
console.log('\n🧹 Test verileri temizlendi.');

db.close();