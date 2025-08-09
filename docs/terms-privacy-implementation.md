# Terms of Service and Privacy Policy Implementation

## Overview
This implementation adds comprehensive legal agreement functionality to the Up2 app signup process, including:
- Terms of Service agreement
- Privacy Policy agreement  
- Birth year collection for age verification
- Minimum age requirement (13 years old)

## Components Added

### 1. Legal Documents (`/components/legal/`)
- **TermsOfService.tsx** - Complete terms of service content with sections covering:
  - Account responsibilities
  - Age requirements
  - User conduct and content policies
  - Event participation terms
  - Payment and refund policies
  - Liability limitations

- **PrivacyPolicy.tsx** - Comprehensive privacy policy including:
  - Data collection practices
  - Age verification and data protection
  - Information sharing policies
  - User rights and choices
  - Data retention policies
  - International data transfer information

- **LegalDocumentModal.tsx** - Full-screen modal component for displaying legal documents

### 2. Enhanced Signup Flow
The signup process now includes:

#### Step 1: Account Details + Legal Agreements
- First name, last name, email, password fields
- **NEW**: Birth year field with validation
- **NEW**: Terms of Service checkbox with link to full document
- **NEW**: Privacy Policy checkbox with link to full document

#### Validation Updates
- Birth year validation (must be valid year between 1900 and current year)
- Minimum age requirement (13 years old)
- Required legal agreement checkboxes
- Age calculation and storage in user profile

## Database Changes
- User profiles now include `age` field calculated from birth year
- Age is automatically calculated: `currentYear - birthYear`

## Key Features

### Age Verification
```typescript
// Validate birth year
const currentYear = new Date().getFullYear();
const birthYearNum = parseInt(birthYear);
const age = currentYear - birthYearNum;

if (age < 13) {
    Alert.alert("Age Requirement", "You must be at least 13 years old to use Up2.");
    return false;
}
```

### Legal Document Display
- Tappable links in checkboxes open full legal documents in modal
- Professional styling with Material Design icons
- Scrollable content for full document review

### Data Storage
```typescript
await createUserProfile({
    // ... other fields
    age: currentYear - parseInt(signUpData.birthYear),
});
```

## Legal Compliance Features

### COPPA Compliance
- Minimum age verification (13 years)
- Clear age collection and usage explanation
- Special privacy protections for younger users

### GDPR/Privacy Features
- Clear data collection disclosure
- User rights and choices explained
- Data retention and deletion policies
- International data transfer notifications

### Terms Coverage
- Platform usage rules
- User responsibility guidelines
- Event participation terms
- Payment and refund policies
- Liability limitations

## User Experience
1. **Seamless Integration**: Legal agreements are part of the natural signup flow
2. **Easy Access**: Users can read full documents without leaving the signup process
3. **Clear Requirements**: Visual checkboxes and validation messages guide users
4. **Age-Appropriate**: Different considerations for users under 18

## Technical Implementation
- TypeScript interfaces updated for new data fields
- React Native components with Material Design styling
- Modal-based document viewing with smooth animations
- Form validation with helpful error messages
- Database integration with automatic age calculation

## Testing
To test the implementation:
1. Navigate to signup page
2. Attempt to proceed without filling birth year - should show validation error
3. Enter birth year under 13 - should show age requirement error
4. Try to proceed without checking legal agreements - should show validation errors
5. Tap on "Terms of Service" or "Privacy Policy" links - should open full documents
6. Complete valid signup with all requirements - should proceed successfully

The implementation ensures legal compliance while maintaining a smooth user experience.
