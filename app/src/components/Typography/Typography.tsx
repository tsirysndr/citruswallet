import { Platform, Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps } from 'react-native';

export function Text({ className = '', style, ...props }: TextProps & { className?: string }) {
  const fontFamily = /\bfont-mono\b/.test(className) ? (Platform.OS === 'ios' ? 'Menlo' : 'monospace')
    : /\bfont-(bold|semibold)\b/.test(className) ? 'RockfordBold'
    : /\bfont-medium\b/.test(className) ? 'RockfordMedium' : 'Rockford';
  return <NativeText {...props} className={className.replace(/\bfont-(bold|semibold|medium|mono)\b/g, '')} style={[{ fontFamily, ...(/\bfont-mono\b/.test(className) ? { fontWeight: /\bfont-bold\b/.test(className) ? '700' as const : /\bfont-semibold\b/.test(className) ? '600' as const : '400' as const } : {}) }, style]} />;
}
export function TextInput({ style, ...props }: TextInputProps & { className?: string }) {
  return <NativeTextInput {...props} style={[{ fontFamily: 'Rockford' }, style]} />;
}
