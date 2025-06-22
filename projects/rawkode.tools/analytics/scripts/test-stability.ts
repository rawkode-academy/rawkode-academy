#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
  test: string;
  runs: number;
  passed: number;
  failed: number;
  errors: string[];
}

const TEST_FILES = [
  'tests/integration/iceberg-r2-catalog.test.ts',
  'tests/integration/iceberg-timeout-retry.test.ts',
  'tests/integration/iceberg-compaction-maintenance.test.ts',
];

const RUNS_PER_TEST = 3;

async function runTest(testFile: string): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(`npm test -- ${testFile} --run --reporter=verbose`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 60000, // 60 second timeout
    });
    
    return {
      success: true,
      output: stdout,
      error: stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
    };
  }
}

async function testStability() {
  console.log('🧪 Running test stability check...\n');
  console.log(`Running each test ${RUNS_PER_TEST} times to ensure stability.\n`);
  
  const results: TestResult[] = [];
  
  for (const testFile of TEST_FILES) {
    console.log(`\n📋 Testing: ${testFile}`);
    console.log('─'.repeat(60));
    
    const result: TestResult = {
      test: testFile,
      runs: RUNS_PER_TEST,
      passed: 0,
      failed: 0,
      errors: [],
    };
    
    for (let i = 1; i <= RUNS_PER_TEST; i++) {
      process.stdout.write(`  Run ${i}/${RUNS_PER_TEST}: `);
      
      const runResult = await runTest(testFile);
      
      if (runResult.success) {
        result.passed++;
        console.log('✅ PASSED');
      } else {
        result.failed++;
        console.log('❌ FAILED');
        
        // Extract error message
        const errorMatch = runResult.error?.match(/Test Files.*failed/);
        if (errorMatch) {
          result.errors.push(`Run ${i}: ${errorMatch[0]}`);
        } else if (runResult.error) {
          result.errors.push(`Run ${i}: ${runResult.error.split('\n')[0]}`);
        }
      }
    }
    
    results.push(result);
  }
  
  // Print summary
  console.log('\n\n📊 TEST STABILITY SUMMARY');
  console.log('═'.repeat(80));
  
  let allStable = true;
  
  for (const result of results) {
    const stability = (result.passed / result.runs) * 100;
    const status = stability === 100 ? '✅' : '❌';
    
    console.log(`\n${status} ${result.test}`);
    console.log(`   Stability: ${stability.toFixed(0)}% (${result.passed}/${result.runs} passed)`);
    
    if (result.failed > 0) {
      allStable = false;
      console.log('   Errors:');
      result.errors.forEach(error => {
        console.log(`     - ${error}`);
      });
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  
  if (allStable) {
    console.log('\n🎉 All tests are stable! They passed consistently across all runs.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests are flaky and need attention.');
    console.log('   Review the errors above and fix the unstable tests.');
    process.exit(1);
  }
}

// Run the stability check
testStability().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});