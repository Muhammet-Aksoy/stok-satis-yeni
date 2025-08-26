#!/usr/bin/env node

const http = require('http');
const os = require('os');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';
const TIMEOUT = 5000;

// Color codes for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bright: '\x1b[1m'
};

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    total: 0
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SmokeTest/1.0'
            },
            timeout: TIMEOUT
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: parsed
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Test functions
async function testHealthCheck() {
    console.log('🏥 Testing health check...');
    try {
        const response = await makeRequest('GET', '/api/health');
        if (response.statusCode === 200 && response.body.success) {
            console.log(`${colors.green}✓ Health check passed${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}✗ Health check failed: ${response.statusCode}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}✗ Health check error: ${error.message}${colors.reset}`);
        return false;
    }
}

async function testDatabaseConnection() {
    console.log('💾 Testing database connection...');
    try {
        const response = await makeRequest('GET', '/api/test');
        if (response.statusCode === 200 && response.body.success) {
            console.log(`${colors.green}✓ Database connection passed${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}✗ Database connection failed: ${response.statusCode}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}✗ Database connection error: ${error.message}${colors.reset}`);
        return false;
    }
}

async function testPaginatedEndpoints() {
    console.log('📄 Testing paginated endpoints...');
    const endpoints = [
        '/api/stok?page=1&limit=5',
        '/api/satis?page=1&limit=5', 
        '/api/musteriler?page=1&limit=5'
    ];
    
    let allPassed = true;
    
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest('GET', endpoint);
            if (response.statusCode === 200 && response.body.success && response.body.meta) {
                console.log(`${colors.green}✓ ${endpoint} passed${colors.reset}`);
            } else {
                console.log(`${colors.red}✗ ${endpoint} failed: ${response.statusCode}${colors.reset}`);
                allPassed = false;
            }
        } catch (error) {
            console.log(`${colors.red}✗ ${endpoint} error: ${error.message}${colors.reset}`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

async function testInputValidation() {
    console.log('🔍 Testing input validation...');
    try {
        // Test with invalid data
        const response = await makeRequest('POST', '/api/stok-ekle', {
            barkod: '', // Empty required field
            ad: ''      // Empty required field
        });
        
        if (response.statusCode === 400) {
            console.log(`${colors.green}✓ Input validation passed (correctly rejected invalid data)${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}✗ Input validation failed: Expected 400, got ${response.statusCode}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}✗ Input validation error: ${error.message}${colors.reset}`);
        return false;
    }
}

async function testStaticFiles() {
    console.log('📁 Testing static file serving...');
    try {
        const response = await makeRequest('GET', '/public/style.css');
        if (response.statusCode === 200) {
            console.log(`${colors.green}✓ Static files served correctly${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}✗ Static files failed: ${response.statusCode}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}✗ Static files error: ${error.message}${colors.reset}`);
        return false;
    }
}

async function testMainPage() {
    console.log('🏠 Testing main page redirect...');
    try {
        const response = await makeRequest('GET', '/');
        if (response.statusCode === 302) {
            console.log(`${colors.green}✓ Main page redirect working${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}✗ Main page redirect failed: ${response.statusCode}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}✗ Main page error: ${error.message}${colors.reset}`);
        return false;
    }
}

// Get network information
function getNetworkInfo() {
    const networkInterfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name of Object.keys(networkInterfaces)) {
        for (const iface of networkInterfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(`${name}: ${iface.address}`);
            }
        }
    }
    
    return ips;
}

// Run test and track results
async function runTest(testName, testFunction) {
    results.total++;
    console.log(`\n${colors.blue}${colors.bright}Running: ${testName}${colors.reset}`);
    
    const passed = await testFunction();
    if (passed) {
        results.passed++;
    } else {
        results.failed++;
    }
}

// Main test runner
async function runSmokeTests() {
    console.log(`${colors.bright}${colors.blue}🔥 Starting Smoke Tests${colors.reset}`);
    console.log(`${colors.yellow}Target: http://${HOST}:${PORT}${colors.reset}\n`);
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run all tests
    await runTest('Health Check', testHealthCheck);
    await runTest('Database Connection', testDatabaseConnection);
    await runTest('Paginated Endpoints', testPaginatedEndpoints);
    await runTest('Input Validation', testInputValidation);
    await runTest('Static Files', testStaticFiles);
    await runTest('Main Page Redirect', testMainPage);
    
    // Print results
    console.log(`\n${colors.bright}${colors.blue}📊 Test Results${colors.reset}`);
    console.log(`${colors.green}✓ Passed: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}✗ Failed: ${results.failed}${colors.reset}`);
    console.log(`📈 Total: ${results.total}`);
    
    if (results.failed === 0) {
        console.log(`\n${colors.green}${colors.bright}🎉 All tests passed! Server is healthy.${colors.reset}`);
        
        // Show network access info
        console.log(`\n${colors.blue}🌐 Network Access:${colors.reset}`);
        console.log(`Local: http://localhost:${PORT}`);
        
        const networkIps = getNetworkInfo();
        if (networkIps.length > 0) {
            console.log('Network interfaces:');
            networkIps.forEach(ip => console.log(`  ${ip}`));
            console.log(`\n${colors.bright}📱 For mobile access, use: http://[YOUR_LAN_IP]:${PORT}${colors.reset}`);
        }
        
        process.exit(0);
    } else {
        console.log(`\n${colors.red}${colors.bright}❌ ${results.failed} test(s) failed. Please check the server.${colors.reset}`);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}⚠️ Tests interrupted by user${colors.reset}`);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.log(`\n${colors.red}💥 Uncaught exception: ${error.message}${colors.reset}`);
    process.exit(1);
});

// Run the tests
if (require.main === module) {
    runSmokeTests().catch((error) => {
        console.log(`\n${colors.red}💥 Test runner error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}

module.exports = { runSmokeTests };