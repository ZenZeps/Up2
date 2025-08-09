# Email Verification Troubleshooting Guide

## 🚨 Issue: Not Receiving Verification Emails

If you're not receiving verification emails from your Up2 app, follow these steps to diagnose and fix the issue.

## 📋 Quick Checklist

- [ ] Check spam/junk folder
- [ ] Verify SMTP is enabled in Appwrite Console
- [ ] Confirm SMTP settings are correct
- [ ] Check email templates are configured
- [ ] Verify sender email is set
- [ ] Test with different email providers
- [ ] Check Appwrite logs

## 🔧 Appwrite Console Configuration

### Step 1: Enable SMTP Service
1. Go to **Appwrite Console** → Your Project
2. Navigate to **Settings** → **SMTP**
3. **Enable** the SMTP service
4. Click **Save**

### Step 2: Configure SMTP Settings

#### For Gmail (Development):
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP Security: TLS
SMTP Username: your-email@gmail.com
SMTP Password: your-app-password (not regular password!)
```

#### For SendGrid (Production):
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP Security: TLS
SMTP Username: apikey
SMTP Password: your-sendgrid-api-key
```

#### For AWS SES:
```
SMTP Host: email-smtp.region.amazonaws.com
SMTP Port: 587
SMTP Security: TLS
SMTP Username: your-ses-username
SMTP Password: your-ses-password
```

### Step 3: Configure Email Templates
1. Go to **Settings** → **Templates**
2. Select **Email Verification**
3. Configure the template:
   ```html
   Subject: Verify your Up2 account
   
   Body:
   Hi {{name}},
   
   Welcome to Up2! Please verify your email address by clicking the link below:
   
   {{url}}
   
   This link will expire in 24 hours.
   
   Thanks,
   The Up2 Team
   ```

### Step 4: Set Sender Information
1. Go to **Settings** → **General**
2. Set **Sender Name**: "Up2 Team"
3. Set **Sender Email**: "noreply@yourdomain.com"
4. **Save** changes

## 🧪 Testing with Debug Tools

### Use the Email Debug Center
1. Open your Up2 app
2. Navigate to **Debug** page
3. Tap **"Email Debug Center"**
4. Run the following tests:
   - **Test Email Verification**: Checks if emails can be sent
   - **Check Configuration**: Verifies user authentication
   - **Test Alternative URL**: Tests with different verification URLs

### Debug Console Commands
Check the app console for errors:
```javascript
// Check if user is authenticated
const user = await account.get();
console.log('User:', user);

// Test email verification
try {
  await account.createVerification('up2://verify');
  console.log('✅ Email sent successfully');
} catch (error) {
  console.error('❌ Email failed:', error);
}
```

## 🔍 Common Issues & Solutions

### Issue 1: "SMTP not configured"
**Solution**: Enable and configure SMTP in Appwrite Console

### Issue 2: "Authentication failed"
**Solutions**:
- Use app passwords for Gmail (not regular password)
- Check username/password are correct
- Verify 2FA settings if using Gmail

### Issue 3: "Template not found"
**Solution**: Configure email verification template in Console

### Issue 4: "Custom URL scheme not working"
**Solutions**:
- Try web URL instead: `https://yourdomain.com/verify`
- Ensure URL scheme is registered in app.json
- Test with mailto: or http: schemes

### Issue 5: "Rate limited"
**Solutions**:
- Check Appwrite plan limits
- Wait before retrying
- Consider upgrading plan for higher limits

## 🔧 Advanced Configuration

### Custom Verification URL
Update your verification URL in the code:
```typescript
// Instead of custom scheme
await account.createVerification('up2://verify');

// Try web URL
await account.createVerification('https://yourdomain.com/verify');

// Or simple redirect
await account.createVerification('https://up2app.com/email-verified');
```

### Environment Variables
Ensure these are set in your `.env.local`:
```env
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
```

### Check Appwrite Logs
1. Go to **Appwrite Console** → **Logs**
2. Filter by **Email** events
3. Look for error messages
4. Check timestamps match your test attempts

## 📧 Testing with Different Email Providers

### Gmail
- Check **Promotions** tab
- Look in **Spam** folder
- Enable "less secure apps" if needed

### Outlook/Hotmail
- Check **Junk** folder
- Add sender to safe list

### Yahoo
- Check **Bulk** folder
- Add to contacts

### Corporate Email
- Contact IT about email filtering
- Whitelist sending domain

## 🚀 Production Recommendations

### 1. Use Professional SMTP Service
- SendGrid (recommended)
- Amazon SES
- Mailgun
- Postmark

### 2. Configure SPF/DKIM Records
Add to your DNS:
```
TXT record: v=spf1 include:sendgrid.net ~all
```

### 3. Use Branded Domain
- Set up custom sender domain
- Configure DKIM authentication
- Add SPF records

### 4. Monitor Delivery
- Set up delivery webhooks
- Monitor bounce rates
- Track open rates

## 🆘 Still Having Issues?

If you're still not receiving emails:

1. **Test with Email Debug Center** in the app
2. **Check Appwrite Console logs** for errors
3. **Try different email providers** (Gmail, Yahoo, etc.)
4. **Verify SMTP credentials** are correct
5. **Check firewall/proxy settings**
6. **Contact Appwrite support** with specific error messages

## 📞 Support Resources

- **Appwrite Documentation**: https://appwrite.io/docs/client/account#accountCreateVerification
- **Appwrite Discord**: https://discord.gg/appwrite
- **GitHub Issues**: https://github.com/appwrite/appwrite/issues

Remember: Email delivery can take a few minutes, so wait at least 5-10 minutes before concluding emails aren't being sent.
