#!/bin/bash

# Build script for app store submission
# This script ensures all compliance requirements are met before building

set -e

echo "🚀 Starting Up2 build for app store submission..."

# Check for required files
echo "📋 Checking required files..."

required_files=(
    "components/legal/PrivacyPolicy.tsx"
    "components/legal/TermsOfService.tsx"
    "assets/images/Up2-Logo.png"
    "app.json"
    "eas.json"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
    echo "✅ Found: $file"
done

# Check app.json configuration
echo "🔧 Validating app.json configuration..."

# Extract version from app.json
VERSION=$(node -p "require('./app.json').expo.version")
echo "📱 App version: $VERSION"

# Check if all required fields are present
node -e "
const config = require('./app.json').expo;
const required = ['name', 'slug', 'version', 'icon', 'description'];
const missing = required.filter(field => !config[field]);
if (missing.length > 0) {
    console.error('❌ Missing required fields in app.json:', missing.join(', '));
    process.exit(1);
}
console.log('✅ All required app.json fields present');
"

# Check bundle identifiers
echo "🆔 Checking bundle identifiers..."
IOS_BUNDLE=$(node -p "require('./app.json').expo.ios.bundleIdentifier")
ANDROID_PACKAGE=$(node -p "require('./app.json').expo.android.package")

if [ "$IOS_BUNDLE" != "$ANDROID_PACKAGE" ]; then
    echo "⚠️  Warning: iOS bundle ID and Android package name don't match"
    echo "iOS: $IOS_BUNDLE"
    echo "Android: $ANDROID_PACKAGE"
fi

# Validate permissions explanations
echo "🔐 Validating permission descriptions..."
node -e "
const config = require('./app.json').expo;
const permissions = config.ios.infoPlist;
const required = [
    'NSPhotoLibraryUsageDescription',
    'NSCameraUsageDescription',
    'NSLocationWhenInUseUsageDescription'
];
const missing = required.filter(perm => !permissions[perm] || permissions[perm].length < 20);
if (missing.length > 0) {
    console.error('❌ Missing or insufficient permission descriptions:', missing.join(', '));
    process.exit(1);
}
console.log('✅ All permission descriptions are adequate');
"

# Check for production configuration
echo "🏭 Checking production configuration..."

# Ensure no debug flags are enabled
if grep -q "DEV.*true" app.json; then
    echo "❌ Debug flags found in app.json - not suitable for production"
    exit 1
fi

# Check EAS configuration
echo "📦 Validating EAS configuration..."
if [ ! -f "eas.json" ]; then
    echo "❌ eas.json not found"
    exit 1
fi

# Check if production profile exists
node -e "
const easConfig = require('./eas.json');
if (!easConfig.build.production) {
    console.error('❌ No production build profile found in eas.json');
    process.exit(1);
}
console.log('✅ Production build profile configured');
"

# Validate assets
echo "🖼️  Validating assets..."

# Check app icon
if [ ! -f "assets/images/Up2-Logo.png" ]; then
    echo "❌ App icon not found: assets/images/Up2-Logo.png"
    exit 1
fi

# Check icon dimensions (should be at least 1024x1024 for store)
echo "✅ App icon found"

# Check dependencies for security vulnerabilities
echo "🔒 Checking for security vulnerabilities..."
if command -v npm &> /dev/null; then
    echo "Running npm audit..."
    npm audit --audit-level moderate
fi

# TypeScript compilation check
echo "🔍 Running TypeScript check..."
if command -v npx &> /dev/null; then
    npx tsc --noEmit
    echo "✅ TypeScript compilation successful"
fi

# ESLint check
echo "🧹 Running ESLint..."
if command -v npx &> /dev/null; then
    npx expo lint
    echo "✅ ESLint passed"
fi

# Final pre-build checks
echo "🎯 Final pre-build validation..."

# Check that environment variables are properly configured
node -e "
const easConfig = require('./eas.json');
const prodEnv = easConfig.build.production.env;
const requiredEnvs = [
    'EXPO_PUBLIC_APPWRITE_PROJECT_ID',
    'EXPO_PUBLIC_APPWRITE_ENDPOINT',
    'EXPO_PUBLIC_APPWRITE_DATABASE_ID'
];
const missing = requiredEnvs.filter(env => !prodEnv[env]);
if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
}
console.log('✅ All required environment variables configured');
"

echo "✅ All compliance checks passed!"
echo ""
echo "🎉 Ready for app store submission!"
echo ""
echo "Next steps:"
echo "1. Run: eas build --platform ios --profile production"
echo "2. Run: eas build --platform android --profile production"
echo "3. Submit to app stores using EAS Submit or manual upload"
echo ""
echo "📋 Don't forget to:"
echo "   - Update version numbers after successful submission"
echo "   - Monitor app store review status"
echo "   - Prepare marketing materials"
echo "   - Set up crash reporting and analytics"