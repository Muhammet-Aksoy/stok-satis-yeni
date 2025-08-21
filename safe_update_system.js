const Database = require('better-sqlite3');

class SafeProductUpdateSystem {
    constructor(dbPath) {
        this.db = new Database(dbPath);
    }

    /**
     * Güvenli ürün güncelleme fonksiyonu
     * Tüm kritik senaryoları kontrol eder
     */
    safeUpdateProduct(urunId, updateData) {
        const result = {
            success: false,
            message: '',
            warnings: [],
            data: null
        };

        try {
            // 1. Mevcut ürünü bul
            const currentProduct = this.db.prepare('SELECT * FROM stok WHERE urun_id = ?').get(urunId);
            
            if (!currentProduct) {
                result.message = 'Ürün bulunamadı';
                return result;
            }

            console.log(`🔍 Güncelleniyor: ${currentProduct.barkod} - ${currentProduct.ad} (${currentProduct.marka})`);

            // 2. Yeni değerlerle composite key oluştur
            const newBarkod = updateData.barkod || currentProduct.barkod;
            const newMarka = updateData.marka !== undefined ? updateData.marka : currentProduct.marka;
            const newVaryant = updateData.varyant_id !== undefined ? updateData.varyant_id : currentProduct.varyant_id;

            // 3. Kritik değişiklik kontrolü
            const barkodChanged = newBarkod !== currentProduct.barkod;
            const markaChanged = newMarka !== currentProduct.marka;
            const varyantChanged = newVaryant !== currentProduct.varyant_id;

            if (barkodChanged) {
                console.log(`⚠️ Barkod değişiyor: ${currentProduct.barkod} → ${newBarkod}`);
            }
            if (markaChanged) {
                console.log(`⚠️ Marka değişiyor: "${currentProduct.marka}" → "${newMarka}"`);
            }
            if (varyantChanged) {
                console.log(`⚠️ Varyant değişiyor: "${currentProduct.varyant_id}" → "${newVaryant}"`);
            }

            // 4. Çakışma kontrolü
            if (barkodChanged || markaChanged || varyantChanged) {
                const conflictCheck = this.db.prepare(`
                    SELECT * FROM stok 
                    WHERE barkod = ? AND marka = ? AND varyant_id = ? AND urun_id != ?
                `).get(newBarkod, newMarka || '', newVaryant || '', urunId);

                if (conflictCheck) {
                    result.message = `❌ ÇAKIŞMA: Bu kombinasyon zaten mevcut!
                    Mevcut: ${conflictCheck.barkod} - ${conflictCheck.ad} (${conflictCheck.marka}) 
                    ID: ${conflictCheck.urun_id}`;
                    return result;
                }
            }

            // 5. Barkod değişikliği özel kontrolü
            if (barkodChanged) {
                const barkodExists = this.db.prepare('SELECT * FROM stok WHERE barkod = ? AND urun_id != ?').get(newBarkod, urunId);
                if (barkodExists) {
                    result.message = `❌ BARKOD ÇAKIŞMASI: ${newBarkod} barkodu zaten kullanılıyor!
                    Mevcut ürün: ${barkodExists.ad} (${barkodExists.marka}) - ID: ${barkodExists.urun_id}`;
                    return result;
                }
                result.warnings.push(`Barkod değiştirildi: ${currentProduct.barkod} → ${newBarkod}`);
            }

            // 6. Boş marka kontrolü
            if (markaChanged && newMarka === '') {
                const emptyBrandConflict = this.db.prepare(`
                    SELECT * FROM stok 
                    WHERE barkod = ? AND (marka = '' OR marka IS NULL) AND urun_id != ?
                `).get(newBarkod, urunId);

                if (emptyBrandConflict) {
                    result.message = `❌ BOŞ MARKA ÇAKIŞMASI: ${newBarkod} barkodunda zaten boş markalı ürün var!
                    Mevcut: ${emptyBrandConflict.ad} - ID: ${emptyBrandConflict.urun_id}`;
                    return result;
                }
                result.warnings.push('Marka boş bırakıldı - dikkatli olun!');
            }

            // 7. Güvenli güncelleme
            const updateFields = [];
            const updateValues = [];

            // Güncelleme alanlarını hazırla
            const fieldsToUpdate = ['ad', 'marka', 'miktar', 'alisFiyati', 'satisFiyati', 'kategori', 'aciklama', 'varyant_id', 'barkod'];
            
            fieldsToUpdate.forEach(field => {
                if (updateData[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updateData[field]);
                }
            });

            if (updateFields.length === 0) {
                result.message = 'Güncellenecek alan yok';
                return result;
            }

            // Updated_at alanını ekle
            updateFields.push('updated_at = CURRENT_TIMESTAMP');

            const updateQuery = `UPDATE stok SET ${updateFields.join(', ')} WHERE urun_id = ?`;
            updateValues.push(urunId);

            console.log(`🔄 SQL: ${updateQuery}`);
            console.log(`📋 Values:`, updateValues);

            this.db.prepare(updateQuery).run(...updateValues);

            // 8. Güncellenmiş ürünü getir
            const updatedProduct = this.db.prepare('SELECT * FROM stok WHERE urun_id = ?').get(urunId);

            result.success = true;
            result.message = 'Ürün başarıyla güncellendi';
            result.data = updatedProduct;

            console.log(`✅ Güncellendi: ${updatedProduct.barkod} - ${updatedProduct.ad} (${updatedProduct.marka})`);

            return result;

        } catch (error) {
            result.message = `Güncelleme hatası: ${error.message}`;
            console.error('❌ Güncelleme hatası:', error);
            return result;
        }
    }

    /**
     * Ürün çakışma analizi
     */
    analyzeConflicts(barkod, marka = '', varyant = '') {
        const conflicts = this.db.prepare(`
            SELECT * FROM stok 
            WHERE barkod = ? AND marka = ? AND varyant_id = ?
        `).all(barkod, marka, varyant);

        return {
            hasConflict: conflicts.length > 0,
            conflicts: conflicts,
            count: conflicts.length
        };
    }

    /**
     * Tüm duplicate ürünleri bul
     */
    findDuplicates() {
        const duplicates = this.db.prepare(`
            SELECT barkod, marka, varyant_id, COUNT(*) as count, 
                   GROUP_CONCAT(urun_id) as urun_ids,
                   GROUP_CONCAT(ad) as names
            FROM stok 
            GROUP BY barkod, marka, varyant_id 
            HAVING COUNT(*) > 1
        `).all();

        return duplicates;
    }

    /**
     * Güvenli ürün silme
     */
    safeDeleteProduct(urunId) {
        const product = this.db.prepare('SELECT * FROM stok WHERE urun_id = ?').get(urunId);
        
        if (!product) {
            return { success: false, message: 'Ürün bulunamadı' };
        }

        // Satış geçmişi kontrolü
        const salesHistory = this.db.prepare('SELECT COUNT(*) as count FROM satisGecmisi WHERE barkod = ?').get(product.barkod);
        
        const warnings = [];
        if (salesHistory.count > 0) {
            warnings.push(`Bu ürünün ${salesHistory.count} adet satış kaydı var`);
        }

        this.db.prepare('DELETE FROM stok WHERE urun_id = ?').run(urunId);

        return {
            success: true,
            message: 'Ürün silindi',
            warnings: warnings,
            deletedProduct: product
        };
    }

    close() {
        this.db.close();
    }
}

// Test fonksiyonu
function runTests() {
    console.log('🧪 GÜVENLİ GÜNCELLEME SİSTEMİ TESTLERİ\n');
    
    const system = new SafeProductUpdateSystem('veritabani.db');

    // Test ürünleri ekle
    const testProducts = [
        {
            urun_id: 'safe_test_001',
            barkod: 'TEST001',
            ad: 'Test Ürünü 1',
            marka: 'BSG',
            miktar: 5,
            alisFiyati: 100,
            satisFiyati: 150
        },
        {
            urun_id: 'safe_test_002', 
            barkod: 'TEST002',
            ad: 'Test Ürünü 2',
            marka: 'ORJ',
            miktar: 3,
            alisFiyati: 200,
            satisFiyati: 300
        }
    ];

    // Test ürünlerini ekle
    const insertStmt = system.db.prepare(`
        INSERT OR REPLACE INTO stok 
        (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    testProducts.forEach(product => {
        insertStmt.run(
            product.urun_id, product.barkod, product.ad, product.marka,
            product.miktar, product.alisFiyati, product.satisFiyati, '', '', ''
        );
        console.log(`➕ Test ürünü eklendi: ${product.barkod} - ${product.ad} (${product.marka})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Normal güncelleme');
    console.log('='.repeat(60));

    const result1 = system.safeUpdateProduct('safe_test_001', {
        ad: 'Güncellenmiş Test Ürünü 1',
        alisFiyati: 120,
        satisFiyati: 180
    });

    console.log(`Sonuç: ${result1.success ? '✅' : '❌'} ${result1.message}`);
    if (result1.warnings.length > 0) {
        result1.warnings.forEach(w => console.log(`⚠️ ${w}`));
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Çakışmalı barkod güncelleme');
    console.log('='.repeat(60));

    const result2 = system.safeUpdateProduct('safe_test_001', {
        barkod: 'TEST002' // Bu zaten mevcut!
    });

    console.log(`Sonuç: ${result2.success ? '✅' : '❌'} ${result2.message}`);

    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Güvenli barkod değişikliği');
    console.log('='.repeat(60));

    const result3 = system.safeUpdateProduct('safe_test_001', {
        barkod: 'TEST001_NEW'
    });

    console.log(`Sonuç: ${result3.success ? '✅' : '❌'} ${result3.message}`);
    if (result3.warnings.length > 0) {
        result3.warnings.forEach(w => console.log(`⚠️ ${w}`));
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Duplicate analizi');
    console.log('='.repeat(60));

    const duplicates = system.findDuplicates();
    console.log(`📊 ${duplicates.length} duplicate grup bulundu:`);
    duplicates.forEach(dup => {
        console.log(`   - ${dup.barkod} (${dup.marka}): ${dup.count} adet - IDs: ${dup.urun_ids}`);
    });

    // Temizlik
    system.db.prepare("DELETE FROM stok WHERE urun_id LIKE 'safe_test_%'").run();
    console.log('\n🧹 Test verileri temizlendi.');

    system.close();
}

// Eğer doğrudan çalıştırılırsa test yap
if (require.main === module) {
    runTests();
}

module.exports = SafeProductUpdateSystem;