import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';

export default function TermsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Terms of Service', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Bored in a Line</Text>
        <Text style={styles.effectiveDate}>Effective Date: January 22, 2026</Text>

        <Text style={styles.paragraph}>
          Please read these Terms of Service ("Terms") carefully before using the Bored in a Line mobile application operated by Bored in a Line ("we," "us," or "our").
        </Text>

        <Text style={styles.sectionTitle}>1. Age Requirement</Text>
        <Text style={styles.paragraph}>
          Bored in a Line is intended exclusively for users who are 18 years of age or older. By creating an account or using this app, you confirm that you are at least 18 years old. If we learn that a user is under 18, we will immediately terminate their account.
        </Text>

        <Text style={styles.sectionTitle}>2. User-Generated Content</Text>
        <Text style={styles.paragraph}>
          Our app allows users to post content including text, photos, and messages. You are solely responsible for any content you submit. By posting content, you represent that the content does not violate these Terms or any applicable law.
        </Text>

        <Text style={styles.sectionTitle}>3. Zero Tolerance for Objectionable Content</Text>
        <Text style={styles.paragraph}>
          We have a strict zero-tolerance policy for objectionable content and abusive behavior. The following are strictly prohibited:
        </Text>
        <Text style={styles.listItem}>• Hate speech, discrimination, or content targeting individuals based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics</Text>
        <Text style={styles.listItem}>• Harassment, threats, intimidation, or bullying of any person</Text>
        <Text style={styles.listItem}>• Sexually explicit or pornographic content</Text>
        <Text style={styles.listItem}>• Content depicting or promoting violence or illegal activity</Text>
        <Text style={styles.listItem}>• Spam, scams, or deceptive content</Text>
        <Text style={styles.listItem}>• Content that violates the privacy of others</Text>
        <Text style={styles.paragraph}>
          Violation of this policy may result in immediate content removal and permanent account termination without notice.
        </Text>

        <Text style={styles.sectionTitle}>4. Content Moderation and Reporting</Text>
        <Text style={styles.paragraph}>
          We provide in-app tools to help maintain a safe community:
        </Text>
        <Text style={styles.listItem}>• <Text style={styles.bold}>Report Content:</Text> You can report any post, chat message, or user profile by tapping the "..." menu and selecting "Report." We review all reports and take action within 24 hours.</Text>
        <Text style={styles.listItem}>• <Text style={styles.bold}>Block Users:</Text> You can block any user to prevent them from appearing in your feed or interacting with you.</Text>
        <Text style={styles.listItem}>• <Text style={styles.bold}>Delete Your Posts:</Text> You can delete your own posts at any time by tapping the "..." menu on your post and selecting "Delete Post."</Text>
        <Text style={styles.paragraph}>
          We are committed to acting on all reported objectionable content within 24 hours by removing the content and, where appropriate, permanently banning the user who posted it.
        </Text>

        <Text style={styles.sectionTitle}>5. Content Filtering</Text>
        <Text style={styles.paragraph}>
          We use automated content filtering to detect and block prohibited content before it is posted. This filtering is applied to all posts and chat messages. Users who attempt to circumvent the filter are subject to account termination.
        </Text>

        <Text style={styles.sectionTitle}>6. Account Termination</Text>
        <Text style={styles.paragraph}>
          We reserve the right to suspend or permanently terminate any account at any time for violation of these Terms, without prior notice. Users who are banned will be notified of the reason when they attempt to log in.
        </Text>

        <Text style={styles.sectionTitle}>7. Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          The app is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. We do not warrant that the app will be uninterrupted, error-free, or free of viruses or other harmful components.
        </Text>

        <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          To the fullest extent permitted by law, Bored in a Line shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the app or content posted by other users.
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to These Terms</Text>
        <Text style={styles.paragraph}>
          We may update these Terms at any time. Continued use of the app after changes constitutes acceptance of the new Terms.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions about these Terms, encounter objectionable content, or need to report inappropriate activity, please contact us:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@boredinaline.com')}>
          <Text style={styles.contactEmail}>support@boredinaline.com</Text>
        </TouchableOpacity>
        <Text style={[styles.paragraph, { marginTop: 8 }]}>
          Reports of objectionable content or abusive users sent to this address will be reviewed and acted upon within 24 hours.
        </Text>

        <View style={styles.footer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#DC143C',
    marginBottom: 4,
  },
  effectiveDate: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 28,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 22,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 24,
    marginLeft: 8,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '600',
    color: '#CCC',
  },
  contactEmail: {
    fontSize: 16,
    color: '#DC143C',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 12,
  },
  footer: {
    height: 40,
  },
});
