import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function SupportScreen() {
  const handleEmailPress = () => {
    Linking.openURL('mailto:support@boredinaline.com');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Support', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <MaterialIcons name="support-agent" size={64} color="#DC143C" />
          <Text style={styles.title}>How Can We Help?</Text>
          <Text style={styles.subtitle}>We're here to assist you with any questions or issues</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <TouchableOpacity style={styles.contactCard} onPress={handleEmailPress}>
            <MaterialIcons name="email" size={24} color="#DC143C" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>support@boredinaline.com</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I check in to a bar?</Text>
            <Text style={styles.faqAnswer}>
              Navigate to the Discover tab, find your bar, and tap the "Tap In" button. You must be within half a mile of the location to check in.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I see where my friends are?</Text>
            <Text style={styles.faqAnswer}>
              Once you've added friends, you can see their check-ins on bar profiles and in the Feed tab. Only friends can see your location.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I use the chat feature?</Text>
            <Text style={styles.faqAnswer}>
              You must be checked in to a bar to access its chat room. Once checked in, go to the Chat tab to message others at the same location.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I delete my account?</Text>
            <Text style={styles.faqAnswer}>
              Go to your Profile, tap the Settings icon, then scroll down and tap "Delete Account." You'll be asked to confirm with your password. This permanently removes your account and all associated data.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Why can't I check in?</Text>
            <Text style={styles.faqAnswer}>
              Make sure location services are enabled for the app. You must be within half a mile of the bar to check in.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Response Time</Text>
          <Text style={styles.bodyText}>
            We aim to respond to all support inquiries within 24-48 hours. For urgent matters, please include "URGENT" in your email subject line.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Bored in a Line</Text>
          <Text style={styles.footerSubtext}>Version 1.0.0</Text>
        </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    padding: 16,
    borderRadius: 12,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactValue: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  faqItem: {
    backgroundColor: '#1C1C1C',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 20,
  },
  bodyText: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#444',
    marginTop: 4,
  },
});
