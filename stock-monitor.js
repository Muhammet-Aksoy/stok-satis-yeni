const fs = require('fs');
const path = require('path');

class StockMonitor {
    constructor() {
        this.backupPath = path.join(__dirname, 'veriler', 'YEDEKVER?LER.json');
        this.currentPath = path.join(__dirname, 'veriler', 'tumVeriler.json');
        this.logPath = path.join(__dirname, 'veriler', 'stock-monitor.log');
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(message);
        fs.appendFileSync(this.logPath, logMessage);
    }

    loadData() {
        try {
            const backupData = JSON.parse(fs.readFileSync(this.backupPath, 'utf8'));
            const currentData = JSON.parse(fs.readFileSync(this.currentPath, 'utf8'));
            return { backupData, currentData };
        } catch (error) {
            this.log(`❌ Error loading data: ${error.message}`);
            return null;
        }
    }

    checkDataIntegrity() {
        this.log('🔍 Checking data integrity...');
        
        const data = this.loadData();
        if (!data) return false;

        const { backupData, currentData } = data;
        const backupKeys = new Set(Object.keys(backupData.stokListesi));
        const currentKeys = new Set(Object.keys(currentData.stokListesi));

        const missingProducts = [];
        const extraProducts = [];

        for (const key of backupKeys) {
            if (!currentKeys.has(key)) {
                missingProducts.push({
                    key,
                    product: backupData.stokListesi[key]
                });
            }
        }

        for (const key of currentKeys) {
            if (!backupKeys.has(key)) {
                extraProducts.push({
                    key,
                    product: currentData.stokListesi[key]
                });
            }
        }

        this.log(`📊 Analysis Results:`);
        this.log(`  - Backup products: ${backupKeys.size}`);
        this.log(`  - Current products: ${currentKeys.size}`);
        this.log(`  - Missing products: ${missingProducts.length}`);
        this.log(`  - Extra products: ${extraProducts.length}`);

        if (missingProducts.length > 0) {
            this.log('⚠️  DATA LOSS DETECTED!');
            this.log('Missing products:');
            missingProducts.forEach(({key, product}) => {
                this.log(`  - ${key}: ${product.ad} (${product.barkod})`);
            });
            return false;
        }

        if (extraProducts.length > 0) {
            this.log('ℹ️  Extra products detected (not critical):');
            extraProducts.forEach(({key, product}) => {
                this.log(`  - ${key}: ${product.ad} (${product.barkod})`);
            });
        }

        this.log('✅ Data integrity check passed');
        return true;
    }

    autoFix() {
        this.log('🔧 Attempting auto-fix...');
        
        const data = this.loadData();
        if (!data) return false;

        const { backupData, currentData } = data;
        const backupKeys = new Set(Object.keys(backupData.stokListesi));
        const currentKeys = new Set(Object.keys(currentData.stokListesi));

        const missingProducts = [];
        for (const key of backupKeys) {
            if (!currentKeys.has(key)) {
                missingProducts.push({
                    key,
                    product: backupData.stokListesi[key]
                });
            }
        }

        if (missingProducts.length === 0) {
            this.log('✅ No fix needed - data is consistent');
            return true;
        }

        this.log(`📝 Restoring ${missingProducts.length} missing products...`);
        
        missingProducts.forEach(({key, product}) => {
            currentData.stokListesi[key] = product;
            this.log(`  ✅ Restored: ${product.ad} (${product.barkod})`);
        });

        currentData.timestamp = new Date().toISOString();
        
        try {
            fs.writeFileSync(this.currentPath, JSON.stringify(currentData, null, 2));
            this.log('💾 Fixed data saved successfully');
            
            // Verify fix
            const verificationData = JSON.parse(fs.readFileSync(this.currentPath, 'utf8'));
            const verificationKeys = new Set(Object.keys(verificationData.stokListesi));
            
            const stillMissing = [];
            for (const key of backupKeys) {
                if (!verificationKeys.has(key)) {
                    stillMissing.push(key);
                }
            }
            
            if (stillMissing.length === 0) {
                this.log('🎉 SUCCESS: Auto-fix completed successfully!');
                return true;
            } else {
                this.log(`⚠️  WARNING: ${stillMissing.length} products still missing after fix`);
                return false;
            }
        } catch (error) {
            this.log(`❌ Error saving fixed data: ${error.message}`);
            return false;
        }
    }

    run() {
        this.log('🚀 Stock Monitor Started');
        
        const isHealthy = this.checkDataIntegrity();
        
        if (!isHealthy) {
            this.log('🔧 Initiating auto-fix...');
            const fixSuccess = this.autoFix();
            
            if (fixSuccess) {
                this.log('✅ Stock monitor completed successfully');
            } else {
                this.log('❌ Stock monitor failed to fix issues');
            }
        } else {
            this.log('✅ Stock monitor completed - no issues found');
        }
        
        this.log('🏁 Stock Monitor Finished\n');
    }
}

// Run the monitor
const monitor = new StockMonitor();
monitor.run();