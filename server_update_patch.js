// Server.js için güvenli güncelleme sistemi patch'i

const Database = require('better-sqlite3');

/**
 * Güvenli ürün güncelleme fonksiyonu
 * Server.js'e eklenecek
 */
function safeUpdateProduct(db, urunId, updateData) {
    const result = {
        success: false,
        message: '',
        warnings: [],
        data: null
    };

    try {
        // 1. Mevcut ürünü bul
        const currentProduct = db.prepare('SELECT * FROM stok WHERE urun_id = ? OR id = ?').get(urunId, urunId);
        
        if (!currentProduct) {
            result.message = 'Ürün bulunamadı';
            return result;
        }

        console.log(`🔍 Güvenli güncelleme: ${currentProduct.barkod} - ${currentProduct.ad} (${currentProduct.marka})`);

        // 2. Yeni değerlerle composite key oluştur
        const newBarkod = updateData.barkod || currentProduct.barkod;
        const newMarka = updateData.marka !== undefined ? updateData.marka : currentProduct.marka;
        const newVaryant = updateData.varyant_id !== undefined ? updateData.varyant_id : currentProduct.varyant_id;

        // 3. Kritik değişiklik kontrolü
        const barkodChanged = newBarkod !== currentProduct.barkod;
        const markaChanged = newMarka !== currentProduct.marka;
        const varyantChanged = newVaryant !== currentProduct.varyant_id;

        if (barkodChanged || markaChanged || varyantChanged) {
            console.log(`⚠️ Kritik değişiklik tespit edildi:`);
            if (barkodChanged) console.log(`   Barkod: ${currentProduct.barkod} → ${newBarkod}`);
            if (markaChanged) console.log(`   Marka: "${currentProduct.marka}" → "${newMarka}"`);
            if (varyantChanged) console.log(`   Varyant: "${currentProduct.varyant_id}" → "${newVaryant}"`);

            // Çakışma kontrolü
            const conflictCheck = db.prepare(`
                SELECT * FROM stok 
                WHERE barkod = ? AND marka = ? AND varyant_id = ? AND urun_id != ? AND id != ?
            `).get(newBarkod, newMarka || '', newVaryant || '', currentProduct.urun_id, currentProduct.id);

            if (conflictCheck) {
                result.message = `ÇAKIŞMA TESPİT EDİLDİ: Bu kombinasyon (${newBarkod} + ${newMarka} + ${newVaryant}) zaten mevcut!
                Çakışan ürün: ${conflictCheck.ad} (${conflictCheck.marka}) - ID: ${conflictCheck.urun_id}`;
                result.conflictProduct = conflictCheck;
                return result;
            }
        }

        // 4. Barkod değişikliği özel kontrolü
        if (barkodChanged) {
            const barkodExists = db.prepare('SELECT * FROM stok WHERE barkod = ? AND urun_id != ? AND id != ?')
                .get(newBarkod, currentProduct.urun_id, currentProduct.id);
            
            if (barkodExists) {
                result.message = `BARKOD ÇAKIŞMASI: ${newBarkod} barkodu zaten kullanılıyor!
                Mevcut ürün: ${barkodExists.ad} (${barkodExists.marka}) - ID: ${barkodExists.urun_id}`;
                result.conflictProduct = barkodExists;
                return result;
            }
            result.warnings.push(`Barkod değiştirildi: ${currentProduct.barkod} → ${newBarkod}`);
        }

        // 5. Boş marka kontrolü
        if (markaChanged && newMarka === '') {
            const emptyBrandConflict = db.prepare(`
                SELECT * FROM stok 
                WHERE barkod = ? AND (marka = '' OR marka IS NULL) AND urun_id != ? AND id != ?
            `).get(newBarkod, currentProduct.urun_id, currentProduct.id);

            if (emptyBrandConflict) {
                result.message = `BOŞ MARKA ÇAKIŞMASI: ${newBarkod} barkodunda zaten boş markalı ürün var!
                Çakışan ürün: ${emptyBrandConflict.ad} - ID: ${emptyBrandConflict.urun_id}`;
                result.conflictProduct = emptyBrandConflict;
                return result;
            }
            result.warnings.push('Marka boş bırakıldı - dikkatli olun!');
        }

        // 6. Güvenli güncelleme
        const updateFields = [];
        const updateValues = [];

        // Güncelleme alanlarını hazırla
        const fieldMapping = {
            'urun_adi': 'ad',
            'ad': 'ad',
            'marka': 'marka', 
            'stok_miktari': 'miktar',
            'miktar': 'miktar',
            'alisFiyati': 'alisFiyati',
            'satisFiyati': 'satisFiyati',
            'fiyat': 'satisFiyati',
            'kategori': 'kategori',
            'aciklama': 'aciklama',
            'varyant_id': 'varyant_id',
            'barkod': 'barkod'
        };

        Object.keys(updateData).forEach(key => {
            const dbField = fieldMapping[key];
            if (dbField && updateData[key] !== undefined) {
                updateFields.push(`${dbField} = ?`);
                updateValues.push(updateData[key]);
            }
        });

        if (updateFields.length === 0) {
            result.message = 'Güncellenecek alan yok';
            return result;
        }

        // Updated_at alanını ekle
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // ID veya urun_id ile güncelle
        const whereClause = currentProduct.id ? 'id = ?' : 'urun_id = ?';
        const whereValue = currentProduct.id || currentProduct.urun_id;
        
        const updateQuery = `UPDATE stok SET ${updateFields.join(', ')} WHERE ${whereClause}`;
        updateValues.push(whereValue);

        console.log(`🔄 Güvenli güncelleme SQL: ${updateQuery}`);

        db.prepare(updateQuery).run(...updateValues);

        // 7. Güncellenmiş ürünü getir
        const updatedProduct = db.prepare('SELECT * FROM stok WHERE id = ? OR urun_id = ?').get(currentProduct.id, currentProduct.urun_id);

        result.success = true;
        result.message = 'Ürün başarıyla güncellendi';
        result.data = updatedProduct;

        console.log(`✅ Güvenli güncelleme tamamlandı: ${updatedProduct.barkod} - ${updatedProduct.ad} (${updatedProduct.marka})`);

        return result;

    } catch (error) {
        result.message = `Güncelleme hatası: ${error.message}`;
        console.error('❌ Güvenli güncelleme hatası:', error);
        return result;
    }
}

/**
 * Server.js'e eklenecek API endpoint
 */
function addSafeUpdateEndpoint(app, db) {
    app.put('/api/safe-update/:id', async (req, res) => {
        try {
            if (!db) {
                return res.status(500).json({
                    success: false,
                    message: 'Database connection not available'
                });
            }

            const urunId = req.params.id;
            const updateData = req.body;

            console.log(`📡 Güvenli güncelleme isteği: ${urunId}`, updateData);

            const result = safeUpdateProduct(db, urunId, updateData);

            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    warnings: result.warnings,
                    data: result.data
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.message,
                    conflictProduct: result.conflictProduct || null
                });
            }

        } catch (error) {
            console.error('❌ Safe update endpoint error:', error);
            res.status(500).json({
                success: false,
                message: 'Sunucu hatası',
                error: error.message
            });
        }
    });

    // Çakışma analizi endpoint'i
    app.get('/api/analyze-conflicts/:barkod', async (req, res) => {
        try {
            const { barkod } = req.params;
            const { marka = '', varyant = '' } = req.query;

            const conflicts = db.prepare(`
                SELECT * FROM stok 
                WHERE barkod = ? AND marka = ? AND varyant_id = ?
            `).all(barkod, marka, varyant);

            res.json({
                success: true,
                hasConflict: conflicts.length > 0,
                conflicts: conflicts,
                count: conflicts.length
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Duplicate analizi endpoint'i
    app.get('/api/duplicates', async (req, res) => {
        try {
            const duplicates = db.prepare(`
                SELECT barkod, marka, varyant_id, COUNT(*) as count, 
                       GROUP_CONCAT(urun_id) as urun_ids,
                       GROUP_CONCAT(ad) as names,
                       GROUP_CONCAT(id) as db_ids
                FROM stok 
                GROUP BY barkod, marka, varyant_id 
                HAVING COUNT(*) > 1
                ORDER BY count DESC
            `).all();

            res.json({
                success: true,
                duplicates: duplicates,
                totalGroups: duplicates.length,
                totalDuplicates: duplicates.reduce((sum, dup) => sum + dup.count, 0)
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    console.log('✅ Güvenli güncelleme endpoints eklendi:');
    console.log('   PUT /api/safe-update/:id - Güvenli ürün güncelleme');
    console.log('   GET /api/analyze-conflicts/:barkod - Çakışma analizi');
    console.log('   GET /api/duplicates - Duplicate ürün analizi');
}

module.exports = {
    safeUpdateProduct,
    addSafeUpdateEndpoint
};