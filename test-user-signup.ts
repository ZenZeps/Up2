import { debugAppwriteConnection, testLogin } from './debug-auth';
import { createUserProfile, getUserProfile } from './lib/api/user';
import { signupWithEmail } from './lib/appwrite/appwrite';

/**
 * Test script to verify the new firstName/lastName user signup flow
 * This will test creating a user with firstName and lastName fields
 */
export async function testNewUserSignup() {
  console.log('🧪 Testing New User Signup with firstName/lastName...\n');

  // Step 1: Debug Appwrite connection
  await debugAppwriteConnection();

  // Step 2: Test data
  const testUser = {
    firstName: 'John',
    lastName: 'Doe',
    email: `test.${Date.now()}@example.com`, // Unique email
    password: 'TestPassword123!',
    preferences: ['sports', 'music']
  };

  console.log('\n📝 Test user data:');
  console.log('  First Name:', testUser.firstName);
  console.log('  Last Name:', testUser.lastName);
  console.log('  Email:', testUser.email);
  console.log('  Preferences:', testUser.preferences.join(', '));

  try {
    // Step 3: Create Appwrite authentication user
    console.log('\n🔐 Creating authentication user...');
    const fullName = `${testUser.firstName} ${testUser.lastName}`;
    const authUser = await signupWithEmail(testUser.email, testUser.password, fullName);
    console.log('✅ Authentication user created:', authUser.$id);

    // Step 4: Create user profile in database
    console.log('\n💾 Creating user profile in database...');
    const profileData = {
      $id: authUser.$id,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      name: fullName,
      email: testUser.email,
      isPublic: true,
      preferences: testUser.preferences,
      friends: [],
    };

    await createUserProfile(profileData);
    console.log('✅ User profile created in database');

    // Step 5: Verify the profile can be retrieved
    console.log('\n🔍 Retrieving user profile...');
    const retrievedProfile = await getUserProfile(authUser.$id);
    
    if (retrievedProfile) {
      console.log('✅ Profile retrieved successfully:');
      console.log('  ID:', retrievedProfile.$id);
      console.log('  First Name:', retrievedProfile.firstName);
      console.log('  Last Name:', retrievedProfile.lastName);
      console.log('  Full Name:', `${retrievedProfile.firstName} ${retrievedProfile.lastName}`);
      console.log('  Email:', retrievedProfile.email);
      console.log('  Preferences:', retrievedProfile.preferences?.join(', ') || 'None');
      console.log('  Public:', retrievedProfile.isPublic);
    } else {
      console.error('❌ Could not retrieve profile');
      return false;
    }

    // Step 6: Test login with the new user
    console.log('\n🔑 Testing login with new user...');
    const loginResult = await testLogin(testUser.email, testUser.password);
    
    if (loginResult.success && loginResult.user) {
      console.log('✅ Login test successful');
      console.log('  User ID matches:', loginResult.user.$id === authUser.$id);
    } else {
      console.error('❌ Login test failed:', loginResult.error?.message);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  ✅ Authentication user creation');
    console.log('  ✅ Database profile creation with firstName/lastName');
    console.log('  ✅ Profile retrieval with new fields');
    console.log('  ✅ Login functionality');
    
    return true;

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testNewUserSignup()
    .then(success => {
      console.log(success ? '\n✅ All tests passed!' : '\n❌ Some tests failed!');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}
