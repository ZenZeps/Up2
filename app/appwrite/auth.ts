import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { account } from './client';

// Use a scheme like myapp://auth-callback (update to your app scheme)
const REDIRECT_URI = Linking.createURL('auth-callback');
const PROVIDER = 'google';

export const loginWithGoogle = async () => {
  try {
    const authUrl = account.createOAuth2Session(PROVIDER, REDIRECT_URI, REDIRECT_URI);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

    if (result.type === 'success' && result.url) {
      const user = await account.get();
      return user;
    } else {
      throw new Error('Google login was cancelled or failed.');
    }
  } catch (error: any) {
    console.error('Google login error:', error);
    throw new Error(error.message || 'OAuth login failed.');
  }
};

export const logoutUser = async () => {
  try {
    await account.deleteSession('current');
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
};

export const getUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    return null;
  }
};
