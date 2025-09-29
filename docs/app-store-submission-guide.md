# Up2 - App Store Submission Guide

## Overview
Up2 is a social events platform built with React Native and Expo. This guide covers everything needed for successful app store submissions.

## ✅ Pre-Submission Checklist

### 1. Build the App
```bash
# Make the build script executable
chmod +x scripts/build-for-stores.sh

# Run compliance checks
./scripts/build-for-stores.sh

# Build for iOS
eas build --platform ios --profile production

# Build for Android  
eas build --platform android --profile production
```

### 2. Required Assets Created
- [x] App icon (1024x1024) - `assets/images/Up2-Logo.png`
- [x] Privacy Policy - `components/legal/PrivacyPolicy.tsx` (existing)
- [x] Terms of Service - `components/legal/TermsOfService.tsx` (existing)
- [x] App Store metadata - `docs/app-store-metadata.md`
- [x] Google Play metadata - `docs/google-play-metadata.md`

### 3. Compliance Features Implemented
- [x] Custom splash screen with data preloading
- [x] Proper permission descriptions
- [x] Privacy policy accessible in-app
- [x] Terms of service accessible in-app
- [x] Age-appropriate content (13+)
- [x] Network security configuration
- [x] Crash reporting and error handling

## 🍎 iOS App Store Submission

### Required Information
- **App Name**: Up2
- **Subtitle**: Social Events & Friends
- **Bundle ID**: com.nikolajszeps.up2
- **Category**: Social Networking
- **Age Rating**: 13+
- **Price**: Free

### Submission Steps
1. **Xcode/Simulator Testing**
   ```bash
   eas build --platform ios --profile preview
   # Test on iOS Simulator
   ```

2. **Production Build**
   ```bash
   eas build --platform ios --profile production
   ```

3. **Upload to App Store Connect**
   ```bash
   eas submit --platform ios
   ```

4. **Complete App Store Connect Listing**
   - Copy description from `docs/app-store-metadata.md`
   - Upload screenshots (create with simulator)
   - Set pricing and availability
   - Complete app review information

### iOS Specific Features
- Native splash screen with proper branding
- App Transport Security configured
- Background modes for notifications
- Proper Info.plist configuration

## 🤖 Google Play Store Submission

### Required Information
- **App Name**: Up2
- **Package**: com.nikolajszeps.up2
- **Category**: Social
- **Content Rating**: Teen
- **Price**: Free

### Submission Steps
1. **Testing**
   ```bash
   eas build --platform android --profile preview
   # Test on Android device/emulator
   ```

2. **Production Build**
   ```bash
   eas build --platform android --profile production
   ```

3. **Upload to Google Play Console**
   ```bash
   eas submit --platform android
   ```

4. **Complete Play Console Listing**
   - Copy description from `docs/google-play-metadata.md`
   - Upload graphics and screenshots
   - Complete content rating questionnaire
   - Fill data safety section

### Android Specific Features
- Network security configuration
- Proper permission declarations
- Target SDK 34 (latest)
- App bundle optimization

## 🔒 Privacy & Legal Compliance

### Data Collection
We collect minimal data required for functionality:
- Account information (name, email)
- Profile information (photos, bio)
- Location (approximate, for event discovery)
- Usage analytics (anonymized)

### User Rights
- Account deletion with full data removal
- Data export functionality
- Privacy settings control
- Opt-out mechanisms

### Legal Requirements
- Privacy policy accessible via Settings > Legal (components/legal/PrivacyPolicy.tsx)
- Terms of service accessible via Settings > Legal (components/legal/TermsOfService.tsx)
- Age verification (13+ requirement)
- Content moderation policies

## 🚀 Launch Strategy

### Pre-Launch (1-2 weeks before)
- [ ] Submit to both stores
- [ ] Prepare marketing materials
- [ ] Set up social media accounts
- [ ] Create support documentation
- [ ] Configure analytics and monitoring

### Launch Day
- [ ] Monitor app store approvals
- [ ] Announce on social media
- [ ] Send to friends and family
- [ ] Watch for crashes/issues
- [ ] Respond to user feedback

### Post-Launch (1-2 weeks after)
- [ ] Monitor reviews and ratings
- [ ] Track key metrics
- [ ] Gather user feedback
- [ ] Plan first update
- [ ] Marketing campaign optimization

## 📊 Success Metrics

### Key Performance Indicators
- **Downloads**: Target 1,000 in first month
- **User Retention**: 50% day-1, 25% day-7
- **Event Creation**: 10% of users create events
- **User Engagement**: 3+ sessions per week
- **App Store Rating**: 4.0+ stars

### Monitoring Tools
- **Expo Analytics**: Built-in usage tracking
- **App Store Connect**: iOS metrics
- **Google Play Console**: Android metrics
- **Crashlytics**: Error tracking (if added)

## 🔧 Technical Requirements Met

### Performance
- [x] App starts in <3 seconds
- [x] Smooth scrolling and animations
- [x] Efficient memory usage
- [x] Minimal battery drain
- [x] Offline functionality graceful degradation

### Security
- [x] HTTPS-only communication
- [x] Proper authentication flow
- [x] Input validation and sanitization
- [x] Secure data storage
- [x] No hardcoded secrets

### Accessibility
- [x] Screen reader compatibility
- [x] Proper color contrast
- [x] Touch target sizes (44pt minimum)
- [x] Alternative text for images
- [x] Keyboard navigation support

## 📱 Platform Requirements

### iOS Requirements Met
- [x] iOS 13.0+ compatibility
- [x] iPhone and iPad support
- [x] Dark mode support
- [x] Dynamic type support
- [x] VoiceOver compatibility

### Android Requirements Met
- [x] Android 6.0+ (API 23+) compatibility
- [x] Phone and tablet layouts
- [x] Material Design principles
- [x] TalkBack compatibility
- [x] Multiple screen densities

## 🆘 Support & Maintenance

### User Support
- **Email**: contact@up2.app
- **In-App**: Settings > Help & Support
- **Response Time**: 24-48 hours
- **Languages**: English (initially)

### Update Schedule
- **Major Updates**: Quarterly
- **Minor Updates**: Monthly
- **Hotfixes**: As needed
- **Security Updates**: Immediate

## 📋 Final Checklist Before Submission

- [ ] All features working correctly
- [ ] No crashes or major bugs
- [ ] Privacy policy and terms accessible
- [ ] Proper app store descriptions
- [ ] Screenshots and graphics ready
- [ ] Age rating appropriate
- [ ] All permissions explained
- [ ] Network connectivity tested
- [ ] Performance optimized
- [ ] Legal requirements met

## 🎉 You're Ready!

If all items above are checked, your app is ready for store submission. Good luck! 🚀

For questions or support, contact: dev@up2.app