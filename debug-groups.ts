import { Query } from 'react-native-appwrite';
import { config, databases } from './lib/appwrite/appwrite';

async function debugGroups() {
    try {
        console.log('🔍 Debugging group loading...');
        console.log('Database ID:', config.databaseID);
        console.log('Groups Collection ID:', config.groupsCollectionID);

        // Test basic database connection
        const response = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            []
        );

        console.log('\n📊 Total groups in database:', response.documents.length);

        if (response.documents.length === 0) {
            console.log('❌ No groups found in database');
            return;
        }

        // Show first group structure
        const firstGroup = response.documents[0];
        console.log('\n🔍 First group structure:');
        console.log('- ID:', firstGroup.$id);
        console.log('- Title:', firstGroup.title);
        console.log('- Has isPublic field:', 'isPublic' in firstGroup);
        console.log('- isPublic value:', firstGroup.isPublic);
        console.log('- Has isPrivate field:', 'isPrivate' in firstGroup);
        console.log('- All fields:', Object.keys(firstGroup));

        // Test public groups query
        const publicGroupsResponse = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [Query.equal('isPublic', true)]
        );

        console.log('\n✅ Public groups found:', publicGroupsResponse.documents.length);

        publicGroupsResponse.documents.forEach((group, index) => {
            console.log(`📋 Group ${index + 1}:`);
            console.log('  - Title:', group.title);
            console.log('  - isPublic:', group.isPublic);
            console.log('  - memberCount:', group.memberCount);
        });

    } catch (error) {
        console.error('❌ Error debugging groups:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
    }
}

debugGroups();
