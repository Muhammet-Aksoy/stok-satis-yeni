const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

console.log('🔄 Importing sabancioglu_backup_*.json into database...');

const dataDir = __dirname;
const dbPath = path.join(__dirname, '..', 'veriler', 'veritabani.db');
const db = new Database(dbPath);

function listBackupFiles() {
	const files = fs.readdirSync(dataDir);
	return files.filter(f => f.startsWith('sabancioglu_backup_') && f.endsWith('.json'))
		.map(f => path.join(dataDir, f));
}

function loadJson(file) {
	try {
		const raw = fs.readFileSync(file, 'utf8');
		return JSON.parse(raw);
	} catch (e) {
		console.warn('⚠️ Failed to load', file, e.message);
		return null;
	}
}

function normalizeProduct(p) {
	return {
		barkod: p.barkod || '',
		ad: p.ad || p.urun_adi || '',
		marka: p.marka || '',
		miktar: parseInt(p.miktar ?? p.stok_miktari ?? 0) || 0,
		alisFiyati: parseFloat(p.alisFiyati ?? 0) || 0,
		satisFiyati: parseFloat(p.satisFiyati ?? p.fiyat ?? 0) || 0,
		kategori: p.kategori || '',
		aciklama: p.aciklama || '',
		varyant_id: p.varyant_id || ''
	};
}

function normalizeSale(s) {
	return {
		barkod: s.barkod || '',
		urunAdi: s.urunAdi || s.urun_adi || s.ad || '',
		miktar: parseInt(s.miktar) || 0,
		fiyat: parseFloat(s.fiyat) || 0,
		alisFiyati: parseFloat(s.alisFiyati ?? 0) || 0,
		toplam: parseFloat(s.toplam ?? (parseFloat(s.fiyat || 0) * parseInt(s.miktar || 0))) || 0,
		borc: s.borc ? 1 : 0,
		tarih: s.tarih || new Date().toISOString(),
		musteriId: s.musteriId || '',
		musteriAdi: s.musteriAdi || ''
	};
}

function importData(files) {
	const seenProducts = new Set();
	const seenSales = new Set();
	let productCount = 0, salesCount = 0;

	const insertProduct = db.prepare(`
		INSERT INTO stok (urun_id, barkod, ad, marka, miktar, alisFiyati, satisFiyati, kategori, aciklama, varyant_id, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`);
	const selectProduct = db.prepare('SELECT id FROM stok WHERE barkod = ? AND marka = ? AND varyant_id = ?');
	const updateProduct = db.prepare(`
		UPDATE stok SET ad=?, marka=?, miktar=?, alisFiyati=?, satisFiyati=?, kategori=?, aciklama=?, varyant_id=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=?
	`);

	const insertSale = db.prepare(`
		INSERT INTO satisGecmisi (barkod, urunAdi, miktar, fiyat, alisFiyati, toplam, borc, tarih, musteriId, musteriAdi)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	const selectSale = db.prepare('SELECT id FROM satisGecmisi WHERE barkod=? AND tarih=? AND miktar=? AND fiyat=?');

	db.transaction(() => {
		for (const file of files) {
			const json = loadJson(file);
			if (!json) continue;
			const stokListesi = json.stokListesi || {};
			const satisGecmisi = json.satisGecmisi || [];

			// Import products
			for (const key of Object.keys(stokListesi)) {
				const p = normalizeProduct(stokListesi[key]);
				if (!p.barkod) continue;
				const productKey = `${p.barkod}__${p.marka}__${p.varyant_id}`;
				if (seenProducts.has(productKey)) continue;
				seenProducts.add(productKey);

				const existing = selectProduct.get(p.barkod, p.marka, p.varyant_id);
				if (existing) {
					updateProduct.run(p.ad, p.marka, p.miktar, p.alisFiyati, p.satisFiyati, p.kategori, p.aciklama, p.varyant_id, existing.id);
				} else {
					insertProduct.run(`urun_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`, p.barkod, p.ad, p.marka, p.miktar, p.alisFiyati, p.satisFiyati, p.kategori, p.aciklama, p.varyant_id);
				}
				productCount++;
			}

			// Import sales
			for (const s of satisGecmisi) {
				const sale = normalizeSale(s);
				if (!sale.barkod || sale.miktar <= 0) continue;
				const saleKey = `${sale.barkod}__${sale.tarih}__${sale.miktar}__${sale.fiyat}`;
				if (seenSales.has(saleKey)) continue;
				seenSales.add(saleKey);

				const existing = selectSale.get(sale.barkod, sale.tarih, sale.miktar, sale.fiyat);
				if (!existing) {
					insertSale.run(sale.barkod, sale.urunAdi, sale.miktar, sale.fiyat, sale.alisFiyati, sale.toplam, sale.borc, sale.tarih, sale.musteriId, sale.musteriAdi);
					salesCount++;
				}
			}
		}
	})();

	console.log(`✅ Import done. Products processed: ${productCount}, Sales inserted: ${salesCount}`);
}

const files = listBackupFiles();
if (files.length === 0) {
	console.log('ℹ️ No sabancioglu_backup_*.json files found.');
	process.exit(0);
}
importData(files);