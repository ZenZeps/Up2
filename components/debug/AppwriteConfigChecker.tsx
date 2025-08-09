import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { account } from '@/lib/appwrite/appwrite';

export const AppwriteConfigChecker = () => {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<any>(null);

  const checkAppwriteConfig = async () => {
    setChecking(true);
    const checkResults = {
      userAuthenticated: false,
      userEmail: '',
      emailVerified: false,
      canSendVerification: false,
      errors: [] as string[]
    };

    try {
      // Check if user is authenticated
      const user = await account.get();
      checkResults.userAuthenticated = true;
      checkResults.userEmail = user.email;
      checkResults.emailVerified = user.emailVerification;

      // Try to send verification email
      try {
        await account.createVerification('https://up2app.com/verify');
        checkResults.canSendVerification = true;
      } catch (verifyError: any) {
        checkResults.canSendVerification = false;
        if (verifyError.message.includes('SMTP')) {
          checkResults.errors.push('SMTP not configured in Appwrite Console');
        } else if (verifyError.message.includes('template')) {
          checkResults.errors.push('Email template not configured');
        } else if (verifyError.message.includes('sender')) {
          checkResults.errors.push('Sender email not configured');
        } else {
          checkResults.errors.push(`Verification error: ${verifyError.message}`);
        }
      }

    } catch (authError: any) {
      checkResults.userAuthenticated = false;
      checkResults.errors.push('User not authenticated - please sign in first');
    }

    setResults(checkResults);
    setChecking(false);
  };

  const getStatusIcon = (status: boolean) => {
    return status ? '✅' : '❌';
  };

  const getStatusColor = (status: boolean) => {
    return status ? '#28a745' : '#dc3545';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="settings" size={24} color="#007AFF" />
        <Text style={styles.title}>Appwrite Configuration Checker</Text>
      </View>

      <TouchableOpacity
        style={styles.checkButton}
        onPress={checkAppwriteConfig}
        disabled={checking}
      >
        <MaterialIcons 
          name={checking ? "hourglass-empty" : "play-arrow"} 
          size={20} 
          color="white" 
        />
        <Text style={styles.checkButtonText}>
          {checking ? 'Checking...' : 'Check Configuration'}
        </Text>
      </TouchableOpacity>

      {results && (
        <ScrollView style={styles.results}>
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>📊 Configuration Status</Text>
            
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>User Authenticated:</Text>
              <Text style={[styles.resultValue, { color: getStatusColor(results.userAuthenticated) }]}>
                {getStatusIcon(results.userAuthenticated)} {results.userAuthenticated ? 'Yes' : 'No'}
              </Text>
            </View>

            {results.userAuthenticated && (
              <>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>User Email:</Text>
                  <Text style={styles.resultValue}>{results.userEmail}</Text>
                </View>

                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Email Verified:</Text>
                  <Text style={[styles.resultValue, { color: getStatusColor(results.emailVerified) }]}>
                    {getStatusIcon(results.emailVerified)} {results.emailVerified ? 'Yes' : 'No'}
                  </Text>
                </View>

                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Can Send Verification:</Text>
                  <Text style={[styles.resultValue, { color: getStatusColor(results.canSendVerification) }]}>
                    {getStatusIcon(results.canSendVerification)} {results.canSendVerification ? 'Yes' : 'No'}
                  </Text>
                </View>
              </>
            )}
          </View>

          {results.errors.length > 0 && (
            <View style={styles.errorSection}>
              <Text style={styles.sectionTitle}>❌ Issues Found</Text>
              {results.errors.map((error: string, index: number) => (
                <View key={index} style={styles.errorItem}>
                  <MaterialIcons name="error" size={16} color="#dc3545" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.recommendationsSection}>
            <Text style={styles.sectionTitle}>💡 Next Steps</Text>
            
            {!results.userAuthenticated && (
              <Text style={styles.recommendation}>
                1. Sign in to your account first before testing email verification
              </Text>
            )}
            
            {results.userAuthenticated && !results.canSendVerification && (
              <>
                <Text style={styles.recommendation}>
                  1. Go to Appwrite Console → Settings → SMTP and enable email service
                </Text>
                <Text style={styles.recommendation}>
                  2. Configure SMTP settings with your email provider
                </Text>
                <Text style={styles.recommendation}>
                  3. Set up email templates in Settings → Templates
                </Text>
                <Text style={styles.recommendation}>
                  4. Configure sender email in Settings → General
                </Text>
              </>
            )}
            
            {results.userAuthenticated && results.canSendVerification && !results.emailVerified && (
              <Text style={styles.recommendation}>
                ✅ Configuration looks good! Check your email inbox for verification message.
              </Text>
            )}
            
            {results.userAuthenticated && results.emailVerified && (
              <Text style={styles.recommendation}>
                🎉 Everything is working perfectly! Your email is already verified.
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  checkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  results: {
    maxHeight: 400,
  },
  resultSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  errorSection: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc3545',
    marginLeft: 8,
    flex: 1,
  },
  recommendationsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  recommendation: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
});
