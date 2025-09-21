// Script to create the missing event_attendances collection
import { config, databases, ID, Permission, Role } from '@/lib/appwrite/appwrite';

export const createEventAttendancesCollection = async () => {
    console.log('🔨 Creating event attendances collection...');

    try {
        // Create a new event attendances collection
        const newCollectionId = ID.unique();
        console.log('📝 Creating new collection with ID:', newCollectionId);

        const collection = await databases.createCollection(
            config.databaseID!,
            newCollectionId,
            'event_attendances',
            [
                Permission.read(Role.any()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        );

        console.log('✅ Collection created:', collection.$id);

        // Create attributes for the event attendances collection
        const attributes = [
            { key: 'eventId', type: 'string', size: 255, required: true },
            { key: 'userId', type: 'string', size: 255, required: true },
            { key: 'status', type: 'string', size: 50, required: true, default: 'attending' },
            { key: 'joinedAt', type: 'datetime', required: true },
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
            }

            // Wait a bit between attribute creations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('✅ All attributes created successfully');

        // Create indexes
        console.log('📋 Creating indexes...');

        const indexes = [
            { key: 'eventId_index', type: 'key', attributes: ['eventId'] },
            { key: 'userId_index', type: 'key', attributes: ['userId'] },
            { key: 'event_user_index', type: 'key', attributes: ['eventId', 'userId'] },
            { key: 'status_index', type: 'key', attributes: ['status'] },
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

        console.log('✅ Event attendances collection created successfully!');
        console.log('🔄 NEW COLLECTION ID:', newCollectionId);
        console.log('📝 Update your .env.local file with:');
        console.log(`EXPO_PUBLIC_APPWRITE_EVENTATTENDANCES_COLLECTION_ID=${newCollectionId}`);

        return newCollectionId;

    } catch (error) {
        console.error('❌ Error creating event attendances collection:', error);
        throw error;
    }
};

export { };
