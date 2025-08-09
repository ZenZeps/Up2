import { account } from '@/lib/appwrite/appwrite';
import { Alert } from 'react-native';

export class EmailDebugger {
  static async testEmailVerification() {
    try {
      console.log('🧪 Testing email verification system...');

      // Check if user is authenticated
      const user = await account.get();
      console.log('👤 Current user:', {
        id: user.$id,
        email: user.email,
        emailVerification: user.emailVerification,
        name: user.name
      });

      if (user.emailVerification) {
        Alert.alert('✅ Email Already Verified', 'Your email is already verified!');
        return;
      }

      // Attempt to send verification email
      const verification = await account.createVerification('up2://verify');
      console.log('📧 Verification email sent:', verification);

      Alert.alert(
        '📧 Verification Email Sent',
        `Email sent to: ${user.email}\n\nCheck your inbox and spam folder.`
      );

    } catch (error: any) {
      console.error('❌ Email verification test failed:', error);

      let errorMessage = 'Unknown error occurred';
      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(
        '❌ Email Test Failed',
        `Error: ${errorMessage}\n\nThis might indicate SMTP configuration issues in Appwrite.`
      );
    }
  }

  static async checkEmailConfiguration() {
    try {
      console.log('🔍 Checking email configuration...');

      // Test basic account access
      const user = await account.get();
      console.log('✅ Account access: OK');
      console.log('📧 User email:', user.email);
      console.log('✉️ Email verified:', user.emailVerification);

      return {
        accountAccess: true,
        userEmail: user.email,
        emailVerified: user.emailVerification,
        userId: user.$id
      };

    } catch (error: any) {
      console.error('❌ Configuration check failed:', error);
      throw error;
    }
  }

  static async testDifferentVerificationURL() {
    try {
      const user = await account.get();

      // Try with a web URL instead of custom scheme
      const webUrl = 'https://up2app.com/verify';
      const verification = await account.createVerification(webUrl);

      console.log('🌐 Web URL verification sent:', verification);
      Alert.alert(
        '🌐 Alternative Email Sent',
        `Tried sending with web URL: ${webUrl}\n\nCheck your email again.`
      );

    } catch (error: any) {
      console.error('❌ Alternative URL test failed:', error);
      Alert.alert('❌ Alternative Test Failed', error.message);
    }
  }
}

// Quick test function for debugging
export const quickEmailTest = async () => {
  console.log('🚀 Running quick email test...');
  await EmailDebugger.testEmailVerification();
};
