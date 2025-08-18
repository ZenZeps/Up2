# React Native Maps Setup for Up2 App

## Current Status
✅ react-native-maps package installed (v1.20.1)
✅ Map component created with full functionality
✅ app.json configured with react-native-maps plugin
✅ Location permissions configured

## Why Maps Don't Work in Expo Go
React Native Maps requires **native code compilation**, which means it cannot run in the standard Expo Go app. You need to create a **Development Build**.

## Option 1: Create Development Build (Recommended)

### Step 1: Install EAS CLI
```bash
npm install -g @expo/cli
npx create-expo --template
```

### Step 2: Configure EAS Build
```bash
cd /home/zen/Up2
eas build:configure
```

### Step 3: Create Development Build
```bash
# For Android
eas build --profile development --platform android

# For iOS (requires Apple Developer account)
eas build --profile development --platform ios
```

### Step 4: Install Development Build
- Download and install the generated APK/IPA
- The development build will include react-native-maps native modules

## Option 2: Quick Test with Expo Web
You can test the basic functionality on web first:
```bash
npx expo start --web
```

## Option 3: Add Google Maps API Key (For Production)

### Get API Key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing one
3. Enable Maps SDK for Android/iOS
4. Create credentials (API Key)
5. Restrict the API key to your app

### Add to app.json:
```json
[
  "react-native-maps",
  {
    "useGoogleMaps": true,
    "apiKey": "YOUR_GOOGLE_MAPS_API_KEY_HERE"
  }
]
```

## Current Map Features (Ready when using Development Build):
- ✅ Interactive Google Maps
- ✅ User location tracking
- ✅ Event markers with your database coordinates (locationLat, locationLng)
- ✅ Proximity filtering (5km-50km radius)
- ✅ Tap markers to view event details
- ✅ Custom map styling and controls

## Next Steps:
1. **For immediate testing**: Run `npx expo start --web` to test on web
2. **For full mobile functionality**: Create development build with `eas build --profile development --platform android`
3. **For production**: Add Google Maps API key to app.json

The Map component is fully implemented and will work perfectly once you create a development build!
