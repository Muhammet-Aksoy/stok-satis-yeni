const http = require('http');

// Test configuration
const HOST = 'localhost';
const PORT = 3000;
const BASE_URL = `http://${HOST}:${PORT}`;

// Test utilities
function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: res.headers['content-type']?.includes('application/json') ? JSON.parse(data) : data
                    };
                    resolve(response);
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function testEndpoint(name, options, postData = null, expectedStatus = 200) {
    try {
        console.log(`🧪 Testing ${name}...`);
        const response = await makeRequest(options, postData);
        
        if (response.statusCode === expectedStatus) {
            console.log(`✅ ${name}: PASSED (${response.statusCode})`);
            if (response.data && typeof response.data === 'object') {
                console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
            }
            return true;
        } else {
            console.log(`❌ ${name}: FAILED (Expected ${expectedStatus}, got ${response.statusCode})`);
            console.log(`   Response: ${JSON.stringify(response.data)}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ${name}: ERROR - ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting API Tests...\n');
    
    const tests = [];
    let passed = 0;
    let total = 0;

    // Test 1: Health Check
    total++;
    if (await testEndpoint('Health Check', {
        hostname: HOST,
        port: PORT,
        path: '/health',
        method: 'GET'
    })) passed++;

    // Test 2: API Test Endpoint
    total++;
    if (await testEndpoint('API Test', {
        hostname: HOST,
        port: PORT,
        path: '/api/test',
        method: 'GET'
    })) passed++;

    // Test 3: Database Status
    total++;
    if (await testEndpoint('Database Status', {
        hostname: HOST,
        port: PORT,
        path: '/api/database-status',
        method: 'GET'
    })) passed++;

    // Test 4: Get All Products (Legacy)
    total++;
    if (await testEndpoint('Get Products (Legacy)', {
        hostname: HOST,
        port: PORT,
        path: '/urunler',
        method: 'GET'
    })) passed++;

    // Test 5: Get All Data (New API)
    total++;
    if (await testEndpoint('Get All Data', {
        hostname: HOST,
        port: PORT,
        path: '/api/tum-veriler',
        method: 'GET'
    })) passed++;

    // Test 6: Add Product
    const testProduct = {
        barkod: '999999999',
        ad: 'Test Ürünü',
        miktar: 10,
        alisFiyati: 50,
        satisFiyati: 75,
        kategori: 'Test',
        aciklama: 'Test ürünü açıklaması'
    };

    total++;
    if (await testEndpoint('Add Product', {
        hostname: HOST,
        port: PORT,
        path: '/api/stok-ekle',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, testProduct, 201)) passed++;

    // Test 7: Update Product
    const updatedProduct = {
        ...testProduct,
        ad: 'Test Ürünü Güncellenmiş',
        miktar: 15
    };

    total++;
    if (await testEndpoint('Update Product', {
        hostname: HOST,
        port: PORT,
        path: '/api/stok-guncelle',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    }, updatedProduct)) passed++;

    // Test 8: Add Customer
    const testCustomer = {
        ad: 'Test Müşteri',
        telefon: '0555 123 4567',
        adres: 'Test Adres',
        bakiye: 0
    };

    total++;
    if (await testEndpoint('Add Customer', {
        hostname: HOST,
        port: PORT,
        path: '/api/musteri-ekle',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, testCustomer, 201)) passed++;

    // Test 9: Add Sale
    const testSale = {
        barkod: '999999999',
        miktar: 2,
        fiyat: 75,
        alisFiyati: 50,
        musteriId: null,
        borc: false,
        toplam: 150
    };

    total++;
    if (await testEndpoint('Add Sale', {
        hostname: HOST,
        port: PORT,
        path: '/api/satis-ekle',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, testSale, 201)) passed++;

    // Test 10: Delete Product
    total++;
    if (await testEndpoint('Delete Product', {
        hostname: HOST,
        port: PORT,
        path: '/api/stok-sil/999999999',
        method: 'DELETE'
    })) passed++;

    // Test Results
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    console.log(`📈 Success Rate: ${((passed/total) * 100).toFixed(1)}%`);

    if (passed === total) {
        console.log('\n🎉 All tests passed! API is working correctly.');
        process.exit(0);
    } else {
        console.log('\n⚠️ Some tests failed. Please check the server logs.');
        process.exit(1);
    }
}

// Check if server is running before starting tests
async function checkServer() {
    try {
        await makeRequest({
            hostname: HOST,
            port: PORT,
            path: '/health',
            method: 'GET'
        });
        return true;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log('🔍 Checking if server is running...');
    
    if (await checkServer()) {
        console.log('✅ Server is running, starting tests...\n');
        await runTests();
    } else {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   npm start');
        process.exit(1);
    }
}

main().catch(console.error);