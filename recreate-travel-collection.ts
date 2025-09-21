// Script to recreate the travel collection in Appwrite
import { config, databases, ID, Permission, Role } from '@/lib/appwrite/appwrite';

export const recreateTravelCollection = async () => {
    console.log('🔨 Recreating travel collection...');

    try {
        // Create a new travel collection
        const newCollectionId = ID.unique();
        console.log('📝 Creating new collection with ID:', newCollectionId);

        const collection = await databases.createCollection(
            config.databaseID!,
            newCollectionId,
            'travel_announcements',
            [
                Permission.read(Role.any()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        );

        console.log('✅ Collection created:', collection.$id);

        // Create attributes for the travel collection
        const attributes = [
            { key: 'userId', type: 'string', size: 255, required: true },
            { key: 'destination', type: 'string', size: 255, required: true },
            { key: 'description', type: 'string', size: 1000, required: false },
            { key: 'startDate', type: 'datetime', required: true },
            { key: 'endDate', type: 'datetime', required: true },
            { key: 'isPublic', type: 'boolean', required: true, default: true },
            { key: 'destinationLat', type: 'double', required: false },
            { key: 'destinationLng', type: 'double', required: false },
            { key: 'locationName', type: 'string', size: 255, required: false },
            { key: 'friendsNotified', type: 'string', size: 2000, required: false, array: true },
        ];

        for (const attr of attributes) {
            console.log(`📋 Creating attribute: ${attr.key}`);

            if (attr.type === 'string') {
                await databases.createStringAttribute(
                    config.databaseID!,
                    newCollectionId,
                    attr.key,
                    attr.size,
                    attr.required,
                    attr.default,
                    attr.array || false
                );
            } else if (attr.type === 'boolean') {
                await databases.createBooleanAttribute(
                    config.databaseID!,
                    newCollectionId,
                    attr.key,
                    attr.required,
                    attr.default
                );
            } else if (attr.type === 'datetime') {
                await databases.createDatetimeAttribute(
                    config.databaseID!,
                    newCollectionId,
                    attr.key,
                    attr.required,
                    attr.default
                );
            } else if (attr.type === 'double') {
                await databases.createFloatAttribute(
                    config.databaseID!,
                    newCollectionId,
                    attr.key,
                    attr.required,
                    undefined,
                    undefined,
                    attr.default
                );
            }

            // Wait a bit between attribute creations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('✅ All attributes created successfully');

        // Create indexes
        console.log('📋 Creating indexes...');

        const indexes = [
            { key: 'userId_index', type: 'key', attributes: ['userId'] },
            { key: 'dates_index', type: 'key', attributes: ['startDate', 'endDate'] },
            { key: 'public_index', type: 'key', attributes: ['isPublic'] },
            { key: 'created_index', type: 'key', attributes: ['$createdAt'] },
        ];

        for (const index of indexes) {
            console.log(`📋 Creating index: ${index.key}`);
            await databases.createIndex(
                config.databaseID!,
                newCollectionId,
                index.key,
                index.type,
                index.attributes
            );

            // Wait between index creations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('✅ Travel collection recreated successfully!');
        console.log('🔄 NEW COLLECTION ID:', newCollectionId);
        console.log('📝 Update your .env.local file with:');
        console.log(`EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID=${newCollectionId}`);

        return newCollectionId;

    } catch (error) {
        console.error('❌ Error recreating travel collection:', error);
        throw error;
    }
};

export { };

