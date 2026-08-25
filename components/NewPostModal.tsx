import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ActionSheetIOS,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { postApi } from '@/utils/api';
import { useMediaUpload } from '@/hooks/useMediaUpload';

interface NewPostModalProps {
  visible: boolean;
  onClose: () => void;
  barId: string | null;
  onPostCreated: () => Promise<void>;
  replyTo?: {
    id: string;
    userName: string;
    content: string;
  } | null;
}

export function NewPostModal({ visible, onClose, barId, onPostCreated, replyTo }: NewPostModalProps) {
  const colors = Colors['dark'];
  const [content, setContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; mimeType: string; type: 'image' | 'video' } | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { pickImage, takePhoto, uploadMedia, uploading, progress } = useMediaUpload();

  const handleSelectImage = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const result = await takePhoto();
            if (result) setSelectedMedia(result);
          } else if (buttonIndex === 2) {
            const result = await pickImage();
            if (result) setSelectedMedia(result);
          }
        }
      );
    } else {
      Alert.alert(
        'Add Photo',
        'Choose how to add a photo',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              const result = await takePhoto();
              if (result) setSelectedMedia(result);
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              const result = await pickImage();
              if (result) setSelectedMedia(result);
            },
          },
        ]
      );
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      let imageUrl: string | undefined;

      if (selectedMedia) {
        try {
          const result = await uploadMedia(selectedMedia.uri, selectedMedia.mimeType);
          imageUrl = result.publicUrl;
        } catch (uploadError) {
          Alert.alert('Upload Failed', 'Could not upload the media. Try again or post without an image.');
          setLoading(false);
          return;
        }
      }

      await postApi.createPost({
        content: content.trim(),
        barId,
        imageUrl,
        replyToId: replyTo?.id,
      });
      
      setContent('');
      setSelectedMedia(null);
      
      try {
        await onPostCreated();
        onClose();
      } catch (refreshError) {
        console.error('Failed to refresh feed after post:', refreshError);
        Alert.alert(
          'Post Created', 
          'Your post was created successfully, but the feed could not be refreshed. Pull down to refresh manually.',
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error: any) {
      console.error('Failed to create post:', error);
      const errorMsg = error?.message || 'Failed to create post. Please try again.';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent('');
    setSelectedMedia(null);
    onClose();
  };

  const removeMedia = () => {
    setSelectedMedia(null);
  };

  const isSubmitting = loading || uploading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
                <Text style={[styles.cancelButton, { color: colors.gray }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{replyTo ? 'Reply' : 'New Post'}</Text>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!content.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.scarlet} />
                ) : (
                  <Text
                    style={[
                      styles.postButton,
                      {
                        color: content.trim() ? colors.scarlet : colors.gray,
                      },
                    ]}
                  >
                    {replyTo ? 'Reply' : 'Post'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {replyTo && (
              <View style={styles.replyToContainer}>
                <View style={styles.replyToIndicator} />
                <View style={styles.replyToContent}>
                  <Text style={styles.replyToLabel}>Replying to {replyTo.userName}</Text>
                  <Text style={styles.replyToText} numberOfLines={2}>{replyTo.content}</Text>
                </View>
              </View>
            )}

            <TextInput
              style={[styles.textInput, { color: '#FFF' }]}
              placeholder="What's happening at the bar?"
              placeholderTextColor={colors.gray}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={500}
              autoFocus
              editable={!isSubmitting}
            />

            {selectedMedia && (
              <View style={styles.imagePreviewContainer}>
                {selectedMedia.type === 'video' ? (
                  <View style={[styles.imagePreview, styles.videoPreview]}>
                    <IconSymbol name="video" size={48} color="#FFF" />
                    <Text style={styles.videoLabel}>Video Selected</Text>
                  </View>
                ) : (
                  <Image source={{ uri: selectedMedia.uri }} style={styles.imagePreview} />
                )}
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={removeMedia}
                  disabled={isSubmitting}
                >
                  <IconSymbol name="xmark.circle.fill" size={28} color="#FFF" />
                </TouchableOpacity>
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#FFF" size="large" />
                    <Text style={styles.uploadingText}>Uploading {progress}%</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalFooter}>
              <View style={styles.footerLeft}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleSelectImage}
                  disabled={isSubmitting}
                >
                  <IconSymbol
                    name="plus.circle.fill"
                    size={24}
                    color={selectedMedia ? colors.scarlet : colors.gray}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={async () => {
                    const result = await pickImage();
                    if (result) setSelectedMedia(result);
                  }}
                  disabled={isSubmitting}
                >
                  <IconSymbol
                    name="photo"
                    size={24}
                    color={selectedMedia ? colors.scarlet : colors.gray}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.charCount, { color: colors.gray }]}>
                {content.length}/500
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    fontSize: 16,
  },
  postButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  videoPreview: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLabel: {
    color: '#FFF',
    marginTop: 8,
    fontSize: 14,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 14,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#FFF',
    marginTop: 8,
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  charCount: {
    fontSize: 12,
  },
  replyToContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyToIndicator: {
    width: 3,
    backgroundColor: '#DC143C',
    borderRadius: 2,
    marginRight: 12,
  },
  replyToContent: {
    flex: 1,
  },
  replyToLabel: {
    fontSize: 12,
    color: '#DC143C',
    fontWeight: '600',
    marginBottom: 4,
  },
  replyToText: {
    fontSize: 14,
    color: '#888',
  },
});
