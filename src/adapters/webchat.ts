// @ts-nocheck
import type { ChannelAdapter } from '../core/types.js';

export class WebChatAdapter implements ChannelAdapter {
  channelName = 'webchat';

  async sendMessage(_sessionId: number, _text: string): Promise<void> {
    // Für dieses minimal Beispiel wird die Antwort direkt im HTTP/WebSocket-Flow geliefert.
  }
}
