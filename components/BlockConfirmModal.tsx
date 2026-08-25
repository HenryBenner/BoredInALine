import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { moderationApi } from '@/utils/api';

interface BlockConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onBlocked: () => void;
}

export function BlockConfirmModal({ visible, onClose, userId, userName, onBlocked }: BlockConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    setLoading(true);
    try {
      await moderationApi.blockUser(userId);
      onBlocked();
      Alert.alert('Blocked', `${userName} has been blocked`);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to block user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Block {userName}?</Text>
          <Text style={styles.description}>
            They won't be able to see your posts or message you. You won't see their content either.
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.blockButton}
              onPress={handleBlock}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.blockText}>Block</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    backgroundColor: '#1C1C1C',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  cancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  blockButton: {
    flex: 1,
    backgroundColor: '#DC143C',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  blockText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
