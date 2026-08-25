import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Colors } from '@/constants/Colors';

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  position?: { x: number; y: number };
}

export function EmojiPicker({ visible, onClose, onSelect, position }: EmojiPickerProps) {
  const colors = Colors['dark'];

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View 
          style={[
            styles.container, 
            { backgroundColor: colors.card },
            position && { position: 'absolute', top: position.y, left: position.x }
          ]}
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiButton}
              onPress={() => handleSelect(emoji)}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

interface ReactionDisplayProps {
  reactions: Array<{ emoji: string; count: number; userReacted: boolean }>;
  onReactionPress: (emoji: string, userReacted: boolean) => void;
  onAddPress: () => void;
}

export function ReactionDisplay({ reactions, onReactionPress, onAddPress }: ReactionDisplayProps) {
  const colors = Colors['dark'];

  if (reactions.length === 0) {
    return (
      <TouchableOpacity style={styles.addReactionButton} onPress={onAddPress}>
        <Text style={styles.addReactionText}>+</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.reactionsContainer}>
      {reactions.map((reaction) => (
        <TouchableOpacity
          key={reaction.emoji}
          style={[
            styles.reactionBubble,
            { 
              backgroundColor: reaction.userReacted ? 'rgba(220, 20, 60, 0.2)' : colors.background,
              borderColor: reaction.userReacted ? colors.scarlet : colors.border,
            }
          ]}
          onPress={() => onReactionPress(reaction.emoji, reaction.userReacted)}
        >
          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
          <Text style={[styles.reactionCount, { color: reaction.userReacted ? colors.scarlet : colors.lightGray }]}>
            {reaction.count}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.addReactionButton} onPress={onAddPress}>
        <Text style={styles.addReactionText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 24,
    gap: 4,
  },
  emojiButton: {
    padding: 8,
  },
  emoji: {
    fontSize: 24,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  addReactionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReactionText: {
    fontSize: 16,
    color: '#888',
  },
});
