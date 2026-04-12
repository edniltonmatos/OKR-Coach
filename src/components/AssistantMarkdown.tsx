import React, { useMemo } from 'react';
import { Linking } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { colors } from '../theme';

type Props = {
  content: string;
};

const markdownStyles = {
  body: {
    color: colors.onSurface,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  text: {
    color: colors.onSurface,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 6,
    marginBottom: 6,
    flexWrap: 'wrap' as const,
    flexDirection: 'row' as const,
    width: '100%' as const,
  },
  heading1: {
    color: colors.accent,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    marginBottom: 8,
    marginTop: 4,
  },
  heading2: {
    color: colors.accent,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    marginBottom: 6,
    marginTop: 4,
  },
  heading3: {
    color: colors.accent,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 15,
    marginBottom: 4,
    marginTop: 4,
  },
  strong: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontWeight: '700' as const,
    color: colors.white,
  },
  em: { fontStyle: 'italic' as const, color: colors.onSurface },
  bullet_list: { marginBottom: 4 },
  ordered_list: { marginBottom: 4 },
  list_item: { marginBottom: 2 },
  bullet_list_icon: { color: colors.accent, marginLeft: 4, marginRight: 8 },
  ordered_list_icon: { color: colors.accent, marginLeft: 4, marginRight: 8 },
  bullet_list_content: { flex: 1 },
  ordered_list_content: { flex: 1 },
  code_inline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  code_block: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.onSurface,
  },
  fence: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.onSurface,
  },
  blockquote: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 6,
  },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
  link: { color: colors.accent, textDecorationLine: 'underline' as const },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 8,
  },
  thead: { borderBottomWidth: 1, borderBottomColor: colors.border },
  th: {
    flex: 1,
    padding: 6,
    color: colors.accent,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row' as const,
  },
  td: {
    flex: 1,
    padding: 6,
    color: colors.onSurface,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
  },
};

export function AssistantMarkdown({ content }: Props) {
  const markdownit = useMemo(
    () =>
      MarkdownIt({
        typographer: true,
        linkify: true,
      }),
    []
  );

  return (
    <Markdown
      markdownit={markdownit}
      style={markdownStyles}
      onLinkPress={(url) => {
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {content}
    </Markdown>
  );
}
