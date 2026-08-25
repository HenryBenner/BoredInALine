import { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { moderationApi } from '@/utils/api';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onReported?: () => void;
  contentType: 'post' | 'chat_message' | 'user_profile';
  contentId?: string;
  reportedUserId?: string;
  reportedUserName?: string;
}

const REPORT_REASONS = [
  { label: 'Spam', value: 'spam' },
  { label: 'Harassment', value: 'harassment' },
  { label: 'Hate Speech', value: 'hate_speech' },
  { label: 'Inappropriate Content', value: 'inappropriate' },
  { label: 'Violence or Threats', value: 'violence' },
  { label: 'Other', value: 'other' },
];

export function ReportModal({ visible, onClose, onReported, contentType, contentId, reportedUserId, reportedUserName }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const getTitle = () => {
    switch (contentType) {
      case 'post': return 'Report Post';
      case 'chat_message': return 'Report Message';
      case 'user_profile': return `Report ${reportedUserName || 'User'}`;
      default: return 'Report';
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await moderationApi.reportContent({
        reportedUserId,
        contentId,
        contentType,
        reason: selectedReason,
        message: message.trim() || undefined,
      });
      handleClose();
      onReported?.();
      if (Platform.OS === 'web') {
        window.alert('Report submitted. Our team will review this shortly.');
      } else {
        Alert.alert('Report Submitted', 'Report submitted. Our team will review this shortly.');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(error?.message || 'Failed to submit report. Please try again.');
      } else {
        Alert.alert('Error', error?.message || 'Failed to submit report. Please try again.');
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setMessage('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{getTitle()}</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Select a reason</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={[
                  styles.reasonButton,
                  selectedReason === reason.value && styles.reasonButtonSelected,
                ]}
                onPress={() => setSelectedReason(reason.value)}
                disabled={loading}
              >
                <View style={[
                  styles.radioOuter,
                  selectedReason === reason.value && styles.radioOuterSelected,
                ]}>
                  {selectedReason === reason.value && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.reasonText,
                  selectedReason === reason.value && styles.reasonTextSelected,
                ]}>
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TextInput
              style={styles.textInput}
              placeholder="Add details (optional)..."
              placeholderTextColor="#888"
              multiline
              value={message}
              onChangeText={setMessage}
              maxLength={500}
              editable={!loading}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                !selectedReason && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1C1C1C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelText: {
    fontSize: 16,
    color: '#888',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  content: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#252525',
    marginBottom: 8,
    gap: 12,
  },
  reasonButtonSelected: {
    backgroundColor: 'rgba(220, 20, 60, 0.15)',
    borderWidth: 1,
    borderColor: '#DC143C',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#DC143C',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC143C',
  },
  reasonText: {
    fontSize: 16,
    color: '#FFF',
  },
  reasonTextSelected: {
    color: '#FFF',
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#FFF',
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 12,
  },
  footer: {
    padding: 16,
    paddingBottom: 40,
  },
  submitButton: {
    backgroundColor: '#DC143C',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#444',
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
