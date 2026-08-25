import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';

export default function EulaScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'End User License Agreement', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>End User License Agreement</Text>
        <Text style={styles.subtitle}>Bored in a Line</Text>
        <Text style={styles.effectiveDate}>Effective Date: March 4, 2026</Text>

        <Text style={styles.paragraph}>
          Please read this End User License Agreement ("EULA") carefully before downloading or using the Bored in a Line mobile application ("App"). This EULA is a legal agreement between you ("User") and Bored in a Line ("Licensor," "we," "us," or "our").
        </Text>
        <Text style={styles.paragraph}>
          By downloading, installing, or using the App, you agree to be bound by the terms of this EULA. If you do not agree, do not download or use the App.
        </Text>

        <Text style={styles.sectionTitle}>1. License Grant</Text>
        <Text style={styles.paragraph}>
          Subject to your compliance with this EULA, we grant you a limited, non-exclusive, non-transferable, revocable license to download and use the App on any Apple-branded device that you own or control, solely for your personal, non-commercial purposes, as permitted by the App Store Terms of Service.
        </Text>

        <Text style={styles.sectionTitle}>2. License Restrictions</Text>
        <Text style={styles.paragraph}>You may not:</Text>
        <Text style={styles.listItem}>• Copy, modify, or distribute the App or any portion of it</Text>
        <Text style={styles.listItem}>• Reverse engineer, disassemble, or decompile the App</Text>
        <Text style={styles.listItem}>• Rent, lease, lend, sell, or sublicense the App</Text>
        <Text style={styles.listItem}>• Use the App for any commercial purpose or for any public display</Text>
        <Text style={styles.listItem}>• Remove or alter any proprietary notices or labels on the App</Text>
        <Text style={styles.listItem}>• Use the App in any way that violates applicable local, state, national, or international law</Text>

        <Text style={styles.sectionTitle}>3. Age Requirement</Text>
        <Text style={styles.paragraph}>
          The App is intended exclusively for users who are 18 years of age or older. By using the App, you confirm that you are at least 18 years old. If we learn that a user is under 18, we will immediately terminate their account and access to the App.
        </Text>

        <Text style={styles.sectionTitle}>4. User-Generated Content</Text>
        <Text style={styles.paragraph}>
          The App allows users to post content including text, photos, and chat messages. You are solely responsible for all content you submit. By posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute that content within the App.
        </Text>
        <Text style={styles.paragraph}>
          We have a strict zero-tolerance policy for objectionable content. The following are prohibited: hate speech, harassment, sexually explicit material, content depicting violence, spam, and any content that violates the rights of others. Violations may result in immediate content removal and permanent account termination.
        </Text>

        <Text style={styles.sectionTitle}>5. Maintenance and Support</Text>
        <Text style={styles.paragraph}>
          We are solely responsible for providing maintenance and support services for the App, as required under applicable law. Apple has no obligation whatsoever to provide any maintenance or support services with respect to the App.
        </Text>
        <Text style={styles.paragraph}>
          For support, contact us at:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@boredinaline.com')}>
          <Text style={styles.contactEmail}>support@boredinaline.com</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>6. Warranty Disclaimer</Text>
        <Text style={styles.paragraph}>
          To the maximum extent permitted by applicable law, the App is provided "as is" and "as available," without warranty of any kind. We expressly disclaim all warranties, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
        </Text>
        <Text style={styles.paragraph}>
          In the event of any failure of the App to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price for the App to you (if applicable). To the maximum extent permitted by applicable law, Apple will have no other warranty obligation whatsoever with respect to the App.
        </Text>

        <Text style={styles.sectionTitle}>7. Product Claims</Text>
        <Text style={styles.paragraph}>
          We, not Apple, are responsible for addressing any claims by you or any third party relating to the App or your possession and/or use of the App, including but not limited to: (i) product liability claims; (ii) any claim that the App fails to conform to any applicable legal or regulatory requirement; and (iii) claims arising under consumer protection, privacy, or similar legislation.
        </Text>

        <Text style={styles.sectionTitle}>8. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          In the event of any third-party claim that the App or your possession and use of the App infringes that third party's intellectual property rights, we, not Apple, will be solely responsible for the investigation, defense, settlement, and discharge of any such intellectual property infringement claim.
        </Text>

        <Text style={styles.sectionTitle}>9. Legal Compliance</Text>
        <Text style={styles.paragraph}>
          You represent and warrant that: (i) you are not located in a country that is subject to a U.S. Government embargo, or that has been designated by the U.S. Government as a "terrorist supporting" country; and (ii) you are not listed on any U.S. Government list of prohibited or restricted parties.
        </Text>

        <Text style={styles.sectionTitle}>10. Termination</Text>
        <Text style={styles.paragraph}>
          This EULA is effective until terminated. Your rights under this EULA will terminate automatically without notice if you fail to comply with any of its terms. Upon termination, you must cease all use of the App and delete all copies from your devices.
        </Text>
        <Text style={styles.paragraph}>
          We also reserve the right to suspend or terminate your account at any time for violations of this EULA or our Terms of Service, without prior notice.
        </Text>

        <Text style={styles.sectionTitle}>11. Apple as Third-Party Beneficiary</Text>
        <Text style={styles.paragraph}>
          You acknowledge and agree that Apple, and Apple's subsidiaries, are third-party beneficiaries of this EULA, and that, upon your acceptance of the terms and conditions of this EULA, Apple will have the right (and will be deemed to have accepted the right) to enforce this EULA against you as a third-party beneficiary thereof.
        </Text>

        <Text style={styles.sectionTitle}>12. Governing Law</Text>
        <Text style={styles.paragraph}>
          This EULA shall be governed by and construed in accordance with the laws of the State of Ohio, United States, without regard to its conflict of law provisions.
        </Text>

        <Text style={styles.sectionTitle}>13. Contact Information</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this EULA, please contact us:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@boredinaline.com')}>
          <Text style={styles.contactEmail}>support@boredinaline.com</Text>
        </TouchableOpacity>

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
    paddingBottom: 60,
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
