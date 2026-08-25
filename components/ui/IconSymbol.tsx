// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'safari.fill': 'explore',
  'safari': 'explore',
  'flame.fill': 'local-fire-department',
  'flame': 'local-fire-department',
  'message.fill': 'chat',
  'message': 'chat-bubble-outline',
  'person.fill': 'person',
  'person': 'person-outline',
  'magnifyingglass': 'search',
  'checkmark.circle.fill': 'check-circle',
  'music.note': 'music-note',
  'mappin': 'location-on',
  'dollarsign.circle': 'attach-money',
  'star.fill': 'star',
  'photo': 'photo',
  'heart': 'favorite-border',
  'bubble.left': 'chat-bubble-outline',
  'paperplane': 'send',
  'chevron.left': 'chevron-left',
  'person.2.fill': 'people',
  'mappin.circle': 'location-on',
  'rectangle.portrait.and.arrow.right': 'exit-to-app',
  'xmark.circle.fill': 'cancel',
  'heart.fill': 'favorite',
  'video': 'videocam',
  'plus.circle.fill': 'add-circle',
  'camera': 'camera-alt',
} as const;

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
