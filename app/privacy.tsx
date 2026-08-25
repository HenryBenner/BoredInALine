import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Bored in a Line</Text>
        <Text style={styles.effectiveDate}>Effective Date: January 22, 2026</Text>

        <Text style={styles.paragraph}>
          Bored in a Line ("we," "our," or "us") operates the Bored in a Line mobile application (the "App"). This Privacy Policy explains how we collect, use, and protect information when you use the App.
        </Text>

        <Text style={styles.paragraph}>
          By using the App, you agree to the collection and use of information in accordance with this Privacy Policy.
        </Text>

        <Text style={styles.sectionTitle}>Information We Collect</Text>
        <Text style={styles.paragraph}>
          We collect information necessary to provide the App's core features, including social interaction, check-ins, messaging, and discovering bars and restaurants.
        </Text>

        <Text style={styles.subSectionTitle}>Personal Information</Text>
        <Text style={styles.paragraph}>We may collect personal information such as:</Text>
        <Text style={styles.listItem}>• Phone number (used for account creation, authentication, and social features)</Text>
        <Text style={styles.listItem}>• Username and profile information</Text>
        <Text style={styles.listItem}>• Communications sent to us for support</Text>
        <Text style={styles.paragraph}>This information is linked to your user account.</Text>

        <Text style={styles.subSectionTitle}>Location Information</Text>
        <Text style={styles.paragraph}>We may collect location data to:</Text>
        <Text style={styles.listItem}>• Show nearby bars and restaurants</Text>
        <Text style={styles.listItem}>• Enable check-ins at specific locations</Text>
        <Text style={styles.listItem}>• Display which friends are at a venue</Text>
        <Text style={styles.listItem}>• Provide relevant events and deals</Text>
        <Text style={styles.paragraph}>
          Location data is used only for app functionality and is not used for advertising or cross-app tracking.
        </Text>

        <Text style={styles.subSectionTitle}>Device Permissions</Text>
        <Text style={styles.paragraph}>
          The App requests access to certain device features only when you actively use a related feature. We do not access these in the background.
        </Text>
        <Text style={styles.listItem}>• <Text style={styles.bold}>Camera:</Text> Used to take a check-in photo or record a video at a bar to share in the bar's live feed (for example, snapping a photo of the crowd on a Friday night). Only accessed when you tap the camera button.</Text>
        <Text style={styles.listItem}>• <Text style={styles.bold}>Photo Library (read):</Text> Used to let you choose an existing photo or video from your device to post in the bar feed or attach to a check-in. Only accessed when you tap "Choose from Gallery."</Text>
        <Text style={styles.listItem}>• <Text style={styles.bold}>Photo Library (save):</Text> Used to save photos captured inside the App to your device's camera roll. Only triggered if you explicitly choose to save a photo.</Text>
        <Text style={styles.listItem}>• <Text style={styles.bold}>Microphone:</Text> Used to capture audio when you record a video to share in the bar feed. Only active while you are recording a video clip.</Text>
        <Text style={styles.paragraph}>
          Media captured or selected through these permissions is uploaded to our servers only if you choose to post or share it. You can revoke any permission at any time in your device's Settings app.
        </Text>

        <Text style={styles.subSectionTitle}>User-Generated Content</Text>
        <Text style={styles.paragraph}>We collect content you choose to share, including:</Text>
        <Text style={styles.listItem}>• Photos and videos posted to the bar feed or attached to check-ins</Text>
        <Text style={styles.listItem}>• Text posts</Text>
        <Text style={styles.listItem}>• Messages and group chats</Text>
        <Text style={styles.paragraph}>
          This content may be visible to other users depending on app features and your activity.
        </Text>

        <Text style={styles.subSectionTitle}>Usage and Technical Data</Text>
        <Text style={styles.paragraph}>
          We may collect limited technical information such as app usage data, crash logs, and performance metrics to improve the App.
        </Text>

        <Text style={styles.sectionTitle}>How We Use Information</Text>
        <Text style={styles.paragraph}>We use collected information to:</Text>
        <Text style={styles.listItem}>• Create and manage user accounts</Text>
        <Text style={styles.listItem}>• Enable social features, messaging, and check-ins</Text>
        <Text style={styles.listItem}>• Display nearby locations, events, and deals</Text>
        <Text style={styles.listItem}>• Improve app performance and reliability</Text>
        <Text style={styles.listItem}>• Provide customer support</Text>
        <Text style={styles.listItem}>• Maintain app security and integrity</Text>
        <Text style={styles.paragraph}>We do not sell personal information.</Text>

        <Text style={styles.sectionTitle}>Data Sharing</Text>
        <Text style={styles.paragraph}>
          We do not share personal data with third-party advertisers or data brokers.
        </Text>
        <Text style={styles.paragraph}>Information may be shared only:</Text>
        <Text style={styles.listItem}>• With service providers who help operate the App, under confidentiality agreements</Text>
        <Text style={styles.listItem}>• When required by law or legal process</Text>
        <Text style={styles.listItem}>• To protect the safety, rights, or security of users and the App</Text>

        <Text style={styles.sectionTitle}>Tracking and Advertising</Text>
        <Text style={styles.paragraph}>
          Bored in a Line does not track users across other apps or websites and does not use personal data for targeted advertising.
        </Text>

        <Text style={styles.sectionTitle}>Data Retention</Text>
        <Text style={styles.paragraph}>
          We retain personal information only as long as necessary to provide the App and comply with legal obligations. Users may request deletion of their account and associated data.
        </Text>

        <Text style={styles.sectionTitle}>User Choices</Text>
        <Text style={styles.paragraph}>Users can:</Text>
        <Text style={styles.listItem}>• Update profile information</Text>
        <Text style={styles.listItem}>• Control app permissions through device settings</Text>
        <Text style={styles.listItem}>• Choose what content they share</Text>
        <Text style={styles.listItem}>• Request account deletion</Text>

        <Text style={styles.sectionTitle}>Data Security</Text>
        <Text style={styles.paragraph}>
          We use reasonable technical and organizational measures to protect user data. However, no system can guarantee complete security.
        </Text>

        <Text style={styles.sectionTitle}>Children's Privacy</Text>
        <Text style={styles.paragraph}>
          The App is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.
        </Text>

        <Text style={styles.sectionTitle}>International Users</Text>
        <Text style={styles.paragraph}>
          Information may be processed and stored in the United States or other jurisdictions where our services operate.
        </Text>

        <Text style={styles.sectionTitle}>Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. Updates will be posted on this page with a revised effective date.
        </Text>

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions about this Privacy Policy or your data, contact us at:
        </Text>
        <Text style={styles.contactEmail}>support@boredinaline.com</Text>

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
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
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
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCCCCC',
    marginTop: 16,
    marginBottom: 8,
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
  },
  bold: {
    fontWeight: '600',
    color: '#CCC',
  },
  contactEmail: {
    fontSize: 16,
    color: '#DC143C',
    fontWeight: '600',
    marginTop: 8,
  },
  footer: {
    height: 40,
  },
});
