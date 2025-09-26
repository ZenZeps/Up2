#!/usr/bin/env node

/**
 * CRITICAL TEST: Direct server-side collection access to isolate permission issues
 */

const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.EXPO_PUBLIC_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
const TRAVEL_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID;

async function diagnoseCollectionIssue() {
    console.log('🔬 CRITICAL DIAGNOSIS: Collection Access Issue Analysis\n');

    try {
        // 1. Check collection configuration and permissions
        console.log('1️⃣ Checking collection configuration...');
        const collection = await databases.getCollection(DATABASE_ID, TRAVEL_COLLECTION_ID);
        console.log('✅ Collection Details:');
        console.log('   - Name:', collection.name);
        console.log('   - Enabled:', collection.enabled);
        console.log('   - Document Security:', collection.documentSecurity);
        console.log('   - Attributes:', collection.attributes.length);
        console.log('   - Indexes:', collection.indexes.length);

        // Log collection permissions
        console.log('   - Collection Permissions:');
        collection.permissions.forEach(perm => console.log(`     ${perm}`));

        // 2. Test basic listDocuments with minimal query
        console.log('\n2️⃣ Testing basic listDocuments...');
        const basicList = await databases.listDocuments(DATABASE_ID, TRAVEL_COLLECTION_ID);
        console.log(`📊 Basic listDocuments result: ${basicList.total} total, ${basicList.documents.length} returned`);

        // 3. Test with maximum limit to see if it's a limit issue
        console.log('\n3️⃣ Testing with maximum limit...');
        const maxList = await databases.listDocuments(
            DATABASE_ID,
            TRAVEL_COLLECTION_ID,
            [Query.limit(4999)] // Appwrite max limit
        );
        console.log(`📊 Max limit result: ${maxList.total} total, ${maxList.documents.length} returned`);

        // 4. Test with no queries at all
        console.log('\n4️⃣ Testing with empty query array...');
        const emptyQuery = await databases.listDocuments(DATABASE_ID, TRAVEL_COLLECTION_ID, []);
        console.log(`📊 Empty query result: ${emptyQuery.total} total, ${emptyQuery.documents.length} returned`);

        // 5. Check if it's an ordering issue
        console.log('\n5️⃣ Testing different ordering...');
        const orderedQuery = await databases.listDocuments(
            DATABASE_ID,
            TRAVEL_COLLECTION_ID,
            [Query.orderAsc('$createdAt'), Query.limit(100)]
        );
        console.log(`📊 Ordered query result: ${orderedQuery.total} total, ${orderedQuery.documents.length} returned`);

        // 6. Check collection-level read permissions
        console.log('\n6️⃣ Collection permissions analysis:');
        const hasReadPermission = collection.permissions.some(perm =>
            perm.includes('read') || perm.includes('any')
        );
        console.log('   - Has read permission:', hasReadPermission);
        console.log('   - Document security enabled:', collection.documentSecurity);

        if (collection.documentSecurity) {
            console.log('   ⚠️  POTENTIAL ISSUE: Document security is enabled!');
            console.log('   This means collection-level permissions are ignored and only document-level permissions apply.');
            console.log('   For listing operations, this might cause visibility issues.');
        }

    } catch (error) {
        console.error('❌ Diagnosis failed:', error.message);
        console.error('Full error:', error);
    }
}

console.log('🔧 Using configuration:');
console.log('- Database ID:', DATABASE_ID);
console.log('- Collection ID:', TRAVEL_COLLECTION_ID);
console.log('');

diagnoseCollectionIssue();