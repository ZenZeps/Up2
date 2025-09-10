import { migrateEventAttendanceMetadata } from '@/lib/utils/databaseMigration';

/**
 * Test script to run the event attendance metadata migration
 * This can be run directly to test the migration function
 */
async function testMigration() {
    console.log('🔄 Starting Event Attendance Metadata Migration Test...');

    try {
        await migrateEventAttendanceMetadata();
        console.log('✅ Migration test completed successfully!');
    } catch (error) {
        console.error('❌ Migration test failed:', error);
    }
}

// Export for use in other contexts
export { testMigration };

// Run immediately if this file is executed directly
if (require.main === module) {
    testMigration();
}
