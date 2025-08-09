import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export const PrivacyPolicy = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="privacy-tip" size={24} color="#007AFF" />
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: August 4, 2025</Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with us. This includes:
        </Text>
        <Text style={styles.bulletPoint}>• Name and email address</Text>
        <Text style={styles.bulletPoint}>• Birth year (for age verification)</Text>
        <Text style={styles.bulletPoint}>• Profile photos and preferences</Text>
        <Text style={styles.bulletPoint}>• Messages and communications</Text>
        <Text style={styles.bulletPoint}>• Event and group participation data</Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to:
        </Text>
        <Text style={styles.bulletPoint}>• Provide and maintain our services</Text>
        <Text style={styles.bulletPoint}>• Verify your age and account eligibility</Text>
        <Text style={styles.bulletPoint}>• Connect you with relevant events and users</Text>
        <Text style={styles.bulletPoint}>• Send important notifications about your account</Text>
        <Text style={styles.bulletPoint}>• Improve our services and user experience</Text>
        <Text style={styles.bulletPoint}>• Ensure platform safety and security</Text>

        <Text style={styles.sectionTitle}>3. Information Sharing</Text>
        <Text style={styles.paragraph}>
          We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
        </Text>
        <Text style={styles.bulletPoint}>• With other users as part of the platform functionality (profile information, event participation)</Text>
        <Text style={styles.bulletPoint}>• With service providers who assist in operating our platform</Text>
        <Text style={styles.bulletPoint}>• When required by law or to protect our rights and safety</Text>
        <Text style={styles.bulletPoint}>• In connection with a business transfer or acquisition</Text>

        <Text style={styles.sectionTitle}>4. Age and Data Protection</Text>
        <Text style={styles.paragraph}>
          We collect birth year information to verify that users meet our minimum age requirements (13 years old). We take special care to protect the privacy of younger users and comply with applicable child privacy laws.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Security</Text>
        <Text style={styles.paragraph}>
          We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission is completely secure.
        </Text>

        <Text style={styles.sectionTitle}>6. Your Rights and Choices</Text>
        <Text style={styles.paragraph}>
          You have the right to:
        </Text>
        <Text style={styles.bulletPoint}>• Access and update your personal information</Text>
        <Text style={styles.bulletPoint}>• Delete your account and associated data</Text>
        <Text style={styles.bulletPoint}>• Control who can see your profile information</Text>
        <Text style={styles.bulletPoint}>• Opt out of certain communications</Text>
        <Text style={styles.bulletPoint}>• Request a copy of your data</Text>

        <Text style={styles.sectionTitle}>7. Data Retention</Text>
        <Text style={styles.paragraph}>
          We retain your personal information for as long as your account is active or as needed to provide services. When you delete your account, we will delete your personal information, except where we are required to retain it by law.
        </Text>

        <Text style={styles.sectionTitle}>8. International Data Transfers</Text>
        <Text style={styles.paragraph}>
          Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information during such transfers.
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on our platform and updating the "last updated" date.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this Privacy Policy or our data practices, please contact us at privacy@up2app.com.
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
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
    marginBottom: 5,
    marginLeft: 15,
  },
});
