#!/usr/bin/env node

/**
 * Test script to verify travel database connection and permissions
 */

const { Client, Databases, ID, Permission, Role } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1')
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '685944b1003ba9c421ea')
    .setKey(process.env.EXPO_PUBLIC_API_KEY || process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || '68594f14003e54ada2a4';
const TRAVEL_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID || '68594f4d0034f9a3bb1b';

async function testTravelDatabase() {
    console.log('🧪 Testing Travel Database Connection...\n');

    try {
        // 1. Test basic database connection
        console.log('1️⃣ Testing database connection...');
        const database = await databases.get(DATABASE_ID);
        console.log('✅ Database connected:', database.name);

        // 2. Test collection access
        console.log('\n2️⃣ Testing travel collection access...');
        const collection = await databases.getCollection(DATABASE_ID, TRAVEL_COLLECTION_ID);
        console.log('✅ Collection found:', collection.name);
        console.log('📋 Collection attributes:');
        collection.attributes.forEach(attr => {
            console.log(`   - ${attr.key}: ${attr.type} (required: ${attr.required})`);
        });

        // 3. Test document creation with minimal data  
        console.log('\n3️⃣ Testing document creation...');
        const testData = {
            userId: 'test_user_123',
            destination: 'Test City',
            startDate: new Date('2025-10-01'),
            endDate: new Date('2025-10-05'),
            description: 'Test travel announcement',
            isPublic: true,
            destinationLat: 40.7128,
            destinationLng: -74.0060,
            friendsNotified: ['friend1', 'friend2']
        };

        console.log('📤 Attempting to create test document with data:', JSON.stringify(testData, null, 2));

        const response = await databases.createDocument(
            DATABASE_ID,
            TRAVEL_COLLECTION_ID,
            ID.unique(),
            testData,
            [
                Permission.read(Role.any()),
                Permission.update(Role.user('test_user_123')),
                Permission.delete(Role.user('test_user_123')),
            ]
        );

        console.log('✅ Test document created successfully!');
        console.log('📄 Document ID:', response.$id);

        // 4. Clean up - delete the test document
        console.log('\n4️⃣ Cleaning up test document...');
        await databases.deleteDocument(DATABASE_ID, TRAVEL_COLLECTION_ID, response.$id);
        console.log('✅ Test document deleted');

        console.log('\n🎉 All tests passed! Travel database is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);

        if (error.code === 401) {
            console.error('🔑 Authentication issue - check APPWRITE_API_KEY in .env file');
        } else if (error.code === 404) {
            console.error('🔍 Not found - check DATABASE_ID and COLLECTION_ID values');
        } else if (error.code === 400) {
            console.error('📝 Validation error - check data format and collection schema');
        }

        console.error('Full error details:', error);
    }
}

console.log('🔧 Configuration:');
console.log('- Endpoint:', process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT);
console.log('- Project ID:', process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID);
console.log('- Database ID:', DATABASE_ID);
console.log('- Collection ID:', TRAVEL_COLLECTION_ID);
console.log('- API Key set:', !!(process.env.EXPO_PUBLIC_API_KEY || process.env.APPWRITE_API_KEY));
console.log('');

testTravelDatabase();