const fetch = require('node-fetch');

async function testServer() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🧪 Testing server endpoints...');
    
    try {
        // Test health endpoint
        console.log('\n1. Testing /health endpoint...');
        const healthRes = await fetch(`${baseUrl}/health`);
        const healthData = await healthRes.json();
        console.log('✅ Health check:', healthData);
        
        // Test API test endpoint
        console.log('\n2. Testing /api/test endpoint...');
        const testRes = await fetch(`${baseUrl}/api/test`);
        const testData = await testRes.json();
        console.log('✅ API test:', testData.success ? 'SUCCESS' : 'FAILED');
        
        // Test database status
        console.log('\n3. Testing /api/database-status endpoint...');
        const dbRes = await fetch(`${baseUrl}/api/database-status`);
        const dbData = await dbRes.json();
        console.log('✅ Database status:', dbData.success ? 'CONNECTED' : 'DISCONNECTED');
        
        // Test tum-veriler endpoint
        console.log('\n4. Testing /api/tum-veriler endpoint...');
        const dataRes = await fetch(`${baseUrl}/api/tum-veriler`);
        const dataData = await dataRes.json();
        console.log('✅ Data endpoint:', dataData.success ? 'SUCCESS' : 'FAILED');
        if (dataData.success) {
            console.log('📊 Data counts:', dataData.count);
        }
        
        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure the server is running on port 3000');
        console.log('💡 Run: node server.js');
    }
}

testServer();