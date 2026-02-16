// @ts-nocheck
export type Role = 'user' | 'assistant' | 'system';

export interface OrgConfig {
  orgId: string;
  orgSalt: string;
}

export interface Session {
  id: number;
  orgId: string;
  userId: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  sessionId: number;
  role: Role;
  text: string;
  createdAt: string;
}

export interface ChannelAdapter {
  channelName: string;
  sendMessage(sessionId: number, text: string): Promise<void>;
}
