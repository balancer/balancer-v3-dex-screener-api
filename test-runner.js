#!/usr/bin/env node

// Simple test runner to run tests in isolation
const { spawn } = require('child_process');
const path = require('path');

const testFiles = [
    'src/utils/chain-config.test.ts',
    'src/utils/pair-util.test.ts', 
    'src/utils/swap-util.test.ts',
    'src/graphql/client.test.ts',
    'src/adapters/balancer-v3-amm-adapter.test.ts'
];

async function runTest(testFile) {
    return new Promise((resolve, reject) => {
        const child = spawn('bun', ['test', testFile], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(`✅ ${testFile} passed`);
            } else {
                reject(`❌ ${testFile} failed with code ${code}`);
            }
        });
    });
}

async function runAllTests() {
    console.log('Running tests in isolation...\n');
    
    const results = [];
    
    for (const testFile of testFiles) {
        try {
            const result = await runTest(testFile);
            results.push(result);
            console.log(result);
        } catch (error) {
            results.push(error);
            console.log(error);
        }
        console.log(''); // Empty line for readability
    }
    
    console.log('\n📊 Test Summary:');
    results.forEach(result => console.log(result));
    
    const failures = results.filter(r => r.includes('❌'));
    if (failures.length > 0) {
        console.log(`\n❌ ${failures.length} test suite(s) failed`);
        process.exit(1);
    } else {
        console.log(`\n✅ All ${results.length} test suites passed!`);
    }
}

runAllTests().catch(console.error);