const fs = require('fs');

console.log('🔧 Fixing issues in try.html...');

// Read the HTML file
let htmlContent = fs.readFileSync('try.html', 'utf8');

// Fix 1: Fix notification timeout (5 minutes -> 3 seconds)
console.log('🔧 Fixing notification timeout...');
htmlContent = htmlContent.replace(
    'setTimeout(() => {\n                notification.classList.remove(\'show\');\n            }, 300000);',
    'setTimeout(() => {\n                notification.classList.remove(\'show\');\n            }, 3000);'
);

// Fix 2: Add missing products menu item
console.log('🔧 Adding missing products menu...');
const menuItemToAdd = `        
        <div class="menu-item" onclick="openMissingProductsModal()">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Eksik Ürünler</span>
        </div>
        `;

// Find the position to insert the menu item (after bulk sale)
htmlContent = htmlContent.replace(
    `        <div class="menu-item" onclick="openBulkSaleModal()">
            <i class="fas fa-shopping-cart"></i>
            <span>Toplu Satış</span>
        </div>
        
        <div class="menu-item" onclick="openQRConnection()">`,
    `        <div class="menu-item" onclick="openBulkSaleModal()">
            <i class="fas fa-shopping-cart"></i>
            <span>Toplu Satış</span>
        </div>
        ${menuItemToAdd}
        <div class="menu-item" onclick="openQRConnection()">`
);

// Fix 3: Add missing products modal HTML
console.log('🔧 Adding missing products modal HTML...');
const missingProductsModal = `
    <!-- Eksik Ürünler Modal -->
    <div id="missingProductsModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-exclamation-triangle"></i> Eksik Ürünler Yönetimi</h2>
                <span class="close" onclick="closeMissingProductsModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="missing-products-info">
                    <p>Bu bölümde eksik_urunler.json dosyasındaki ürünleri veritabanına ekleyebilirsiniz.</p>
                    <div class="missing-products-stats">
                        <div class="stat-card">
                            <h3 id="missingProductsCount">-</h3>
                            <p>Eksik Ürün</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="processedCount">-</h3>
                            <p>İşlenen</p>
                        </div>
                    </div>
                </div>
                <div class="missing-products-actions">
                    <button class="btn btn-primary" onclick="importMissingProducts()">
                        <i class="fas fa-download"></i> Eksik Ürünleri İçe Aktar
                    </button>
                    <button class="btn btn-info" onclick="checkMissingProducts()">
                        <i class="fas fa-search"></i> Eksik Ürünleri Kontrol Et
                    </button>
                </div>
                <div id="missingProductsResults" class="missing-products-results" style="display: none;">
                    <h3>İşlem Sonuçları:</h3>
                    <div id="missingProductsLog"></div>
                </div>
            </div>
        </div>
    </div>
`;

// Insert the modal before the closing body tag
htmlContent = htmlContent.replace('</body>', missingProductsModal + '\n</body>');

// Fix 4: Add missing products JavaScript functions
console.log('🔧 Adding missing products JavaScript functions...');
const missingProductsJS = `
        // Missing Products Functions
        function openMissingProductsModal() {
            document.getElementById('missingProductsModal').style.display = 'block';
            checkMissingProducts();
        }
        
        function closeMissingProductsModal() {
            document.getElementById('missingProductsModal').style.display = 'none';
        }
        
        async function checkMissingProducts() {
            try {
                const response = await fetch('/eksik_urunler.json');
                if (response.ok) {
                    const data = await response.json();
                    const count = data.products ? data.products.length : 0;
                    document.getElementById('missingProductsCount').textContent = count;
                    showNotification(\`\${count} eksik ürün bulundu\`, 'info');
                } else {
                    document.getElementById('missingProductsCount').textContent = '0';
                    showNotification('Eksik ürünler dosyası bulunamadı', 'warning');
                }
            } catch (error) {
                console.error('Eksik ürünler kontrol hatası:', error);
                showNotification('Eksik ürünler kontrol edilemedi', 'error');
            }
        }
        
        async function importMissingProducts() {
            try {
                showNotification('Eksik ürünler içe aktarılıyor...', 'info');
                
                const response = await fetch(\`\${API_BASE}/api/import-missing-products\`, {
                    method: 'POST'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('processedCount').textContent = result.data.total;
                    document.getElementById('missingProductsResults').style.display = 'block';
                    document.getElementById('missingProductsLog').innerHTML = \`
                        <div class="import-result success">
                            <h4>✅ İçe Aktarma Başarılı</h4>
                            <p>Eklenen: \${result.data.added}</p>
                            <p>Güncellenen: \${result.data.updated}</p>
                            <p>Atlanan: \${result.data.skipped}</p>
                        </div>
                    \`;
                    showNotification(\`\${result.data.added} ürün eklendi, \${result.data.updated} ürün güncellendi\`, 'success');
                } else {
                    showNotification('İçe aktarma başarısız: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('İçe aktarma hatası:', error);
                showNotification('İçe aktarma hatası: ' + error.message, 'error');
            }
        }
`;

// Insert the JavaScript functions before the closing script tag
const lastScriptIndex = htmlContent.lastIndexOf('</script>');
if (lastScriptIndex !== -1) {
    htmlContent = htmlContent.slice(0, lastScriptIndex) + missingProductsJS + '\n    ' + htmlContent.slice(lastScriptIndex);
}

// Write the fixed file
fs.writeFileSync('try.html', htmlContent);
console.log('✅ All fixes applied to try.html');

console.log('🔧 Creating server endpoint for missing products import...');
