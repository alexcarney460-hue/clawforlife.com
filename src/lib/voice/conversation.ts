/**
 * AI conversation engine for voice calls.
 *
 * Maintains per-call conversation history and uses Anthropic Claude
 * to generate contextual responses. Each call gets its own ConversationState
 * object stored in a short-lived in-memory map (calls rarely exceed 10 min).
 *
 * For persistence across serverless cold starts, the full history is also
 * round-tripped through a Twilio session cookie so no data is lost.
 */

import type { VoiceConfig } from './config';
import { CONVERSATION_LIMITS } from './config';
import { buildSystemPrompt, buildAppointmentPrompt, buildMessagePrompt } from './prompts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: string;
}

export interface ConversationState {
  readonly callSid: string;
  readonly callerNumber: string;
  readonly callerName: string | null;
  readonly callerHistory: string | null;
  readonly config: VoiceConfig;
  readonly messages: readonly ConversationMessage[];
  readonly isWithinHours: boolean;
  readonly turnCount: number;
}

export interface ConversationResult {
  readonly text: string;
  readonly action: ConversationAction | null;
  readonly updatedState: ConversationState;
}

export type ConversationAction =
  | 'BOOK_APPOINTMENT'
  | 'TAKE_MESSAGE'
  | 'TRANSFER'
  | 'END_CALL';

interface AppointmentData {
  readonly name: string;
  readonly phone: string;
  readonly service: string;
  readonly datetime: string;
}

interface MessageData {
  readonly name: string;
  readonly phone: string;
  readonly message: string;
}

export interface ActionPayload {
  readonly action: ConversationAction;
  readonly appointment?: AppointmentData;
  readonly messageData?: MessageData;
}

// ---------------------------------------------------------------------------
// In-memory call store (keyed by Twilio CallSid)
// ---------------------------------------------------------------------------

const activeConversations = new Map<string, ConversationState>();

// Auto-cleanup after 15 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_CONVERSATION_AGE_MS = 15 * 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupRunning(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - MAX_CONVERSATION_AGE_MS;
    for (const [sid, state] of activeConversations) {
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg && new Date(lastMsg.timestamp).getTime() < cutoff) {
        activeConversations.delete(sid);
      }
    }
    if (activeConversations.size === 0 && cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a new conversation for an incoming call.
 */
export function startConversation(params: {
  callSid: string;
  callerNumber: string;
  callerName: string | null;
  callerHistory: string | null;
  config: VoiceConfig;
  isWithinHours: boolean;
}): ConversationState {
  const state: ConversationState = {
    callSid: params.callSid,
    callerNumber: params.callerNumber,
    callerName: params.callerName,
    callerHistory: params.callerHistory,
    config: params.config,
    messages: [],
    isWithinHours: params.isWithinHours,
    turnCount: 0,
  };

  activeConversations.set(params.callSid, state);
  ensureCleanupRunning();
  return state;
}

/**
 * Retrieve an active conversation by CallSid.
 */
export function getConversation(callSid: string): ConversationState | null {
  return activeConversations.get(callSid) ?? null;
}

/**
 * Restore a conversation from serialised state (Twilio cookie round-trip).
 */
export function restoreConversation(state: ConversationState): void {
  activeConversations.set(state.callSid, state);
  ensureCleanupRunning();
}

/**
 * End and remove a conversation from the active store.
 * Returns the final state for transcript storage.
 */
export function endConversation(callSid: string): ConversationState | null {
  const state = activeConversations.get(callSid) ?? null;
  activeConversations.delete(callSid);
  return state;
}

/**
 * Process a caller's speech input and generate the AI response.
 */
export async function processUserInput(
  callSid: string,
  userText: string,
): Promise<ConversationResult> {
  const state = activeConversations.get(callSid);
  if (!state) {
    throw new Error(`No active conversation for CallSid: ${callSid}`);
  }

  // Check turn limit
  if (state.turnCount >= CONVERSATION_LIMITS.maxTurns) {
    const farewell =
      `I appreciate the conversation! We have been chatting for a while. ` +
      `Let me take a message so someone can follow up with you. What is your name and number?`;
    const updated = appendMessages(state, userText, farewell);
    return { text: farewell, action: null, updatedState: updated };
  }

  // Build message array for Claude
  const systemPrompt = buildSystemPrompt(
    state.config,
    state.callerName,
    state.callerHistory,
    state.isWithinHours,
  );

  const claudeMessages = buildClaudeMessages(state, userText);

  // Call Anthropic API
  const aiResponse = await callAnthropic(systemPrompt, claudeMessages);

  // Extract any action tags
  const { cleanText, action } = extractAction(aiResponse);

  // Update state immutably
  const updated = appendMessages(state, userText, cleanText);

  return { text: cleanText, action, updatedState: updated };
}

// ---------------------------------------------------------------------------
// Anthropic API call
// ---------------------------------------------------------------------------

async function callAnthropic(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    CONVERSATION_LIMITS.responseTimeoutMs,
  );

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: CONVERSATION_LIMITS.maxTokensPerResponse,
        system: systemPrompt,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find(
      (block: { type: string }) => block.type === 'text',
    );

    return textBlock?.text ?? 'I apologize, I could not process that. Could you repeat?';
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildClaudeMessages(
  state: ConversationState,
  currentInput: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Take only the most recent messages to stay within context limits
  const recentMessages = state.messages.slice(
    -CONVERSATION_LIMITS.maxHistoryMessages,
  );

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of recentMessages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: 'user', content: currentInput });

  return messages;
}

function appendMessages(
  state: ConversationState,
  userText: string,
  assistantText: string,
): ConversationState {
  const now = new Date().toISOString();

  const newMessages: readonly ConversationMessage[] = [
    ...state.messages,
    { role: 'user' as const, content: userText, timestamp: now },
    { role: 'assistant' as const, content: assistantText, timestamp: now },
  ];

  const updated: ConversationState = {
    ...state,
    messages: newMessages,
    turnCount: state.turnCount + 1,
  };

  activeConversations.set(state.callSid, updated);
  return updated;
}

function extractAction(
  text: string,
): { cleanText: string; action: ConversationAction | null } {
  const actionPattern = /\[ACTION:(BOOK_APPOINTMENT|TAKE_MESSAGE|TRANSFER|END_CALL)\]/;
  const match = text.match(actionPattern);

  if (!match) {
    return { cleanText: text.trim(), action: null };
  }

  const action = match[1] as ConversationAction;
  const cleanText = text.replace(actionPattern, '').trim();

  return { cleanText, action };
}

/**
 * Serialise conversation state for round-tripping through Twilio cookies.
 * Keeps payload small by limiting message history.
 */
export function serialiseState(state: ConversationState): string {
  const slim = {
    ...state,
    messages: state.messages.slice(-CONVERSATION_LIMITS.maxHistoryMessages),
  };
  return Buffer.from(JSON.stringify(slim)).toString('base64');
}

/**
 * Deserialise conversation state from a Twilio cookie.
 */
export function deserialiseState(encoded: string): ConversationState | null {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(json) as ConversationState;
  } catch {
    return null;
  }
}
