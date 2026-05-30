/**
 * Manual Test Runner
 * Simple script to run tests without full npm install
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process');

console.log('🧪 Manual Test Runner');
console.log('=====================\n');

// Check if we have the necessary dependencies
function checkDependencies() {
  const dependencies = [
    'jest',
    'ts-jest',
    'jest-environment-jsdom',
    '@types/jest'
  ];

  const missing = [];

  dependencies.forEach(dep => {
    try {
      require.resolve(dep);
      console.log(`✅ ${dep} is available`);
    } catch (_e) {
      console.log(`❌ ${dep} is missing`);
      missing.push(dep);
    }
  });

  return missing;
}

// Try to run tests if dependencies are available
function tryRunTests() {
  const missing = checkDependencies();

  if (missing.length === 0) {
    console.log('\n🚀 All dependencies available, running tests...\n');

    try {
      // Run jest
      execSync('npx jest --passWithNoTests --verbose', {
        stdio: 'inherit',
        encoding: 'utf-8'
      });

      console.log('\n✅ Tests completed successfully!');
      return true;
    } catch (error) {
      console.log('\n❌ Tests failed:', error.message);
      return false;
    }
  } else {
    console.log('\n📋 Missing dependencies:');
    missing.forEach(dep => console.log(`  - ${dep}`));

    console.log('\n🔧 Alternative approaches:');
    console.log('1. Try: npm install --legacy-peer-deps');
    console.log('2. Try: yarn install');
    console.log('3. Try installing specific packages:');
    missing.forEach(dep => console.log(`   npm install ${dep} --save-dev`));

    return false;
  }
}

// Check test files
function checkTestFiles() {
  console.log('\n📁 Available test files:');

  const testFiles = [];

  // Look for test files
  const testDirs = [
    'src/__tests__',
    '__tests__',
    'test',
    'tests'
  ];

  testDirs.forEach(dir => {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        if (file.endsWith('.test.ts') || file.endsWith('.test.js') ||
            file.endsWith('.spec.ts') || file.endsWith('.spec.js')) {
          testFiles.push(path.join(dir, file));
          console.log(`  ✅ ${path.join(dir, file)}`);
        }
      });
    } catch (_e) {
      // Directory doesn't exist
    }
  });

  if (testFiles.length === 0) {
    console.log('  ❌ No test files found');
  }

  return testFiles;
}

// Analyze test content
function analyzeTests() {
  console.log('\n🔍 Test Analysis:');

  const testFiles = checkTestFiles();

  if (testFiles.length > 0) {
    testFiles.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Count test cases
        const describeMatches = content.match(/describe\s*\(/g) || [];
        const itMatches = content.match(/it\s*\(/g) || [];

        console.log(`\n📄 ${filePath}:`);
        console.log(`  📋 Describe blocks: ${describeMatches.length}`);
        console.log(`  📋 Test cases: ${itMatches.length}`);

        // Extract test descriptions
        const testDescriptions = [];
        const itRegex = /it\s*\(\s*['"]([^'"]+)['"]/g;
        let match;

        while ((match = itRegex.exec(content)) !== null) {
          testDescriptions.push(match[1]);
        }

        if (testDescriptions.length > 0) {
          console.log('  📝 Test cases:');
          testDescriptions.slice(0, 5).forEach((desc, i) => {
            console.log(`    ${i + 1}. ${desc}`);
          });
          if (testDescriptions.length > 5) {
            console.log(`    ... and ${testDescriptions.length - 5} more`);
          }
        }

      } catch (e) {
        console.log(`  ❌ Could not read ${filePath}: ${e.message}`);
      }
    });
  }
}

// Main execution
function main() {
  console.log('Starting test analysis...\n');

  // Analyze existing tests
  analyzeTests();

  // Try to run tests
  console.log('\n🚀 Attempting to run tests...\n');
  const success = tryRunTests();

  // Summary
  console.log('\n📋 Summary:');
  if (success) {
    console.log('✅ Tests ran successfully!');
  } else {
    console.log('❌ Could not run tests automatically');
    console.log('🔧 Manual testing recommended - see TESTING_SETUP.md');
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Fix dependency issues: npm install --legacy-peer-deps');
  console.log('2. Run tests manually: npm run test');
  console.log('3. Follow manual testing guide: TESTING_SETUP.md');
  console.log('4. Set up error monitoring: ERROR_MONITORING.md');
}

// Run the analysis
main();
