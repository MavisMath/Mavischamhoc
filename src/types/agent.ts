import { DynamicGeometrySpec } from './geometry';

export type AIExecutionMode = 'direct' | 'hybrid' | 'card';

export interface AgentMathResponse extends DynamicGeometrySpec {
  success?: boolean;
  error?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text?: string;
  htmlContent?: string;
  imageUrl?: string;
  timestamp: number;
}
