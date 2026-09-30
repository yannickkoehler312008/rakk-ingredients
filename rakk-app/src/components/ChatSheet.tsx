import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { ResolvedScan } from '../types/scan';
import { askAboutProduct, ChatResult, ChatTurn, isChatConfigured } from '../services/chat';
import { track } from '../services/analytics';

/**
 * The ingredient chat assistant — §4, build-order step 5.
 *
 * §4 puts this at the bottom of the Label screen, "once the full ingredient
 * list and flagged cards have rendered", as a bar the user expands into a
 * thread. It is scoped to the scanned product: the question goes to the backend
 * with that scan's matched records as its only source.
 *
 * Every outcome is a designed state (§9) — offline, rate-limited, not yet
 * configured, upstream failure. None of them is a generic toast.
 *
 * Copy discipline (§1/§9) is enforced server-side before a reply is ever
 * returned; see supabase/functions/ingredient-chat/guardrails.ts.
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Set when the backend withheld or refused rather than answered. */
  aside?: boolean;
}

const SUGGESTIONS = [
  'What does this preservative actually do?',
  'Why is this in the product at all?',
  'What is the difference between the US and EU status here?',
];

export function ChatSheet({ scan, onClose }: { scan: ResolvedScan; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<Exclude<ChatResult['kind'], 'reply'> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || pending) return;

      setDraft('');
      setState(null);
      setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text: question }]);
      setPending(true);
      // §14: that a question was asked, and about which product — never the
      // question itself.
      track({ event: 'chat_question', barcode: scan.product.barcode });

      // Only completed exchanges go back as history.
      const history: ChatTurn[] = messages.map((m) => ({ role: m.role, content: m.text }));
      const result = await askAboutProduct(scan, history, question);
      setPending(false);

      if (result.kind === 'reply') {
        setMessages((prev) => [
          ...prev,
          { id: `a${Date.now()}`, role: 'assistant', text: result.text },
        ]);
      } else {
        setState(result.kind);
      }
    },
    [messages, pending, scan],
  );

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={serif.cardTitle} numberOfLines={1}>
              {scan.product.name}
            </Text>
            <Text style={[sans.micro, { marginTop: 1 }]}>
              Answers come only from this label&apos;s entries
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button">
            <Feather name="x" size={22} color={color.text} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.thread}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && !state ? <Opening onPick={send} /> : null}

          {messages.map((m) => (
            <View
              key={m.id}
              style={[s.bubble, m.role === 'user' ? s.fromUser : s.fromAssistant]}
            >
              <Text style={[sans.body, m.role === 'user' ? { color: color.surface } : null]}>
                {m.text}
              </Text>
            </View>
          ))}

          {pending ? (
            <View style={[s.bubble, s.fromAssistant, s.thinking]}>
              <ActivityIndicator size="small" color={color.textMuted} />
              <Text style={[sans.meta, { marginLeft: space.sm }]}>Reading the entries…</Text>
            </View>
          ) : null}

          {state ? <ChatState kind={state} onRetry={() => setState(null)} /> : null}
        </ScrollView>

        <View style={s.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about this product"
            placeholderTextColor={color.textMuted}
            style={s.input}
            multiline
            maxLength={600}
            editable={!pending}
            onSubmitEditing={() => send(draft)}
            accessibilityLabel="Your question"
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={!draft.trim() || pending}
            style={[s.sendBtn, (!draft.trim() || pending) && { opacity: 0.35 }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Feather name="arrow-up" size={18} color={color.surface} />
          </Pressable>
        </View>

        <Text style={[sans.micro, s.footnote]}>
          Rakk is an informational reference tool, not health advice.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Opening({ onPick }: { onPick: (q: string) => void }) {
  return (
    <View style={{ paddingVertical: space.lg }}>
      <Text style={[sans.body, { color: color.textMuted }]}>
        Ask anything about what&apos;s on this label. Answers come from the same entries the
        cards above use — nothing else.
      </Text>
      <View style={{ marginTop: space.lg }}>
        {SUGGESTIONS.map((q) => (
          <Pressable key={q} onPress={() => onPick(q)} style={s.suggestion}>
            <Text style={[sans.metaStrong, { color: color.primary, flex: 1 }]}>{q}</Text>
            <Feather name="arrow-up-right" size={14} color={color.primary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** §9: each failure is its own designed state, never a generic error toast. */
function ChatState({
  kind,
  onRetry,
}: {
  kind: Exclude<ChatResult['kind'], 'reply'>;
  onRetry: () => void;
}) {
  const copy: Record<typeof kind, { icon: React.ComponentProps<typeof Feather>['name']; title: string; body: string }> = {
    offline: {
      icon: 'cloud-off',
      title: 'No connection.',
      body: 'The assistant needs one to answer — it works from live lookups rather than anything stored on your phone. Everything above still works offline.',
    },
    not_configured: {
      icon: 'settings',
      title: 'The assistant isn’t switched on yet.',
      body: 'This build has no backend connected, so there is nothing to ask. The ingredient cards above are unaffected.',
    },
    rate_limited: {
      icon: 'clock',
      title: 'That’s a lot of questions.',
      body: 'You have reached the hourly limit. It resets on the hour, and the cards above keep working in the meantime.',
    },
    unauthenticated: {
      icon: 'user-x',
      title: 'Couldn’t start a session.',
      body: 'The assistant needs a session to keep track of usage. Try again in a moment.',
    },
    error: {
      icon: 'alert-circle',
      title: 'That didn’t go through.',
      body: 'The assistant could not be reached. It is worth another try in a moment.',
    },
  };
  const c = copy[kind];

  return (
    <View style={s.state}>
      <View style={s.stateIcon}>
        <Feather name={c.icon} size={16} color={color.primary} />
      </View>
      <Text style={[sans.bodyStrong, { marginTop: space.md }]}>{c.title}</Text>
      <Text style={[sans.meta, { marginTop: 4 }]}>{c.body}</Text>
      {kind !== 'not_configured' ? (
        <Pressable onPress={onRetry} style={{ marginTop: space.md }} accessibilityRole="button">
          <Text style={[sans.metaStrong, { color: color.primary }]}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export { isChatConfigured };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  thread: { paddingHorizontal: gutter, paddingBottom: space.lg },
  bubble: {
    borderRadius: radius.md,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    marginTop: space.md,
    maxWidth: '92%',
  },
  fromUser: { backgroundColor: color.primary, alignSelf: 'flex-end' },
  fromAssistant: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    alignSelf: 'flex-start',
  },
  thinking: { flexDirection: 'row', alignItems: 'center' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  state: {
    marginTop: space.lg,
    padding: space.base,
    backgroundColor: color.surface2,
    borderRadius: radius.md,
  },
  stateIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: gutter,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    ...sans.body,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
  footnote: { textAlign: 'center', paddingVertical: space.sm },
});
