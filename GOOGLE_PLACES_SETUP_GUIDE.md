# Google Places API Setup Guide for Up2 App

This guide will help you configure Google Places API for location autocomplete functionality in the Up2 app.

## Prerequisites

1. Google Cloud Platform account
2. Google Places API enabled
3. API key with Places API permissions

## Step 1: Enable Google Places API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" → "Library"
4. Search for "Places API" 
5. Click on "Places API" and enable it

## Step 2: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the generated API key
4. Click "Restrict Key" for security

## Step 3: Configure API Key Restrictions

### Application Restrictions
- **Android apps**: Add your package name `com.nikolajszeps.up2`
- **iOS apps**: Add your bundle identifier `com.nikolajszeps.up2`

### API Restrictions
Restrict the key to these APIs only:
- Places API
- Places API (New)
- Geocoding API (optional, for reverse geocoding)

## Step 4: Set Environment Variable

Create a `.env` file in your project root:

```bash
# .env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=YOUR_API_KEY_HERE
```

Or set it in your development environment:

```bash
export EXPO_PUBLIC_GOOGLE_PLACES_API_KEY="YOUR_API_KEY_HERE"
```

## Step 5: Configure for Production

### For EAS Build
Add to your `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY": "YOUR_PRODUCTION_API_KEY"
      }
    }
  }
}
```

### For app.json/app.config.js
```json
{
  "expo": {
    "extra": {
      "googlePlacesApiKey": process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
    }
  }
}
```

## Features Enabled

With Google Places API configured, users get:

✅ **Real-time location suggestions** as they type
✅ **Business and establishment search** (restaurants, venues, etc.)
✅ **Address validation** with GPS coordinates
✅ **Global coverage** with country restrictions
✅ **Visual location indicators** (restaurant, hotel, park icons)
✅ **Verified location badges** for GPS-enabled locations

## Troubleshooting

### API Key Issues
- Ensure the API key is not restricted to wrong domains/apps
- Check that Places API is enabled in Google Cloud Console
- Verify the API key has sufficient quotas

### No Suggestions Appearing
- Check browser/app console for API errors
- Ensure internet connectivity
- Verify the API key is correctly set in environment variables

### Rate Limiting
- Google Places API has usage limits
- Consider implementing request caching for frequently searched locations
- Monitor usage in Google Cloud Console

## Cost Optimization

- Session tokens are used to reduce costs
- Requests are debounced to minimize API calls
- Results are limited to 5 suggestions per query
- Geographic restrictions reduce irrelevant results

## Testing

In development mode, you can:
1. Open the event form
2. Start typing in the location field
3. Check browser console for API responses
4. Use the "Debug API" button (if API key is missing)

## Security Notes

- Never commit API keys to version control
- Use different API keys for development/production
- Regularly rotate API keys
- Monitor API usage for anomalies

## Support

If you encounter issues:
1. Check the Google Cloud Console for API errors
2. Review the browser console for detailed error messages
3. Verify API key permissions and restrictions
4. Test with a simple location query like "Starbucks"
