import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export const TermsOfService = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="description" size={24} color="#007AFF" />
        <Text style={styles.headerTitle}>Terms of Service</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: August 4, 2025</Text>
        
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By creating an account and using Up2, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this service.
        </Text>
        
        <Text style={styles.sectionTitle}>2. Age Requirements</Text>
        <Text style={styles.paragraph}>
          You must be at least 13 years old to use Up2. If you are under 18, you must have your parent or guardian's permission to use this service. By providing your birth year, you confirm that you meet these age requirements.
        </Text>
        
        <Text style={styles.sectionTitle}>3. Account Responsibilities</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
        </Text>
        
        <Text style={styles.sectionTitle}>4. User Content and Conduct</Text>
        <Text style={styles.paragraph}>
          You are solely responsible for any content you post, share, or transmit through Up2. You agree not to use the service for any unlawful, harmful, or inappropriate purposes, including but not limited to harassment, spam, or violation of others' privacy.
        </Text>
        
        <Text style={styles.sectionTitle}>5. Events and Activities</Text>
        <Text style={styles.paragraph}>
          Up2 facilitates connections between users for events and activities. We are not responsible for the actual events, meetups, or interactions between users. Users participate in events at their own risk and discretion.
        </Text>
        
        <Text style={styles.sectionTitle}>6. Privacy and Data Protection</Text>
        <Text style={styles.paragraph}>
          Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your personal information.
        </Text>
        
        <Text style={styles.sectionTitle}>7. Payments and Refunds</Text>
        <Text style={styles.paragraph}>
          Some features or events may require payment. All payments are processed securely through third-party payment processors. Refund policies vary by event and are subject to the terms set by event organizers.
        </Text>
        
        <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          Up2 is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the service.
        </Text>
        
        <Text style={styles.sectionTitle}>9. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these terms at any time. Users will be notified of significant changes, and continued use of the service constitutes acceptance of the modified terms.
        </Text>
        
        <Text style={styles.sectionTitle}>10. Contact Information</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms of Service, please contact us at support@up2app.com.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 10,
    color: '#333',
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
    marginBottom: 15,
  },
});
