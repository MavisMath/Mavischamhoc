import { CanvasSnapshot, WhiteboardStroke } from './padlet';
import { MathCard } from './card';

export type UserRole = 'host' | 'editor' | 'viewer';

export interface CollabUser {
  userId: string;
  userName: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  color: string;
}

export type CanvasDeltaAction =
  | { action: 'stroke:add'; stroke: WhiteboardStroke }
  | { action: 'stroke:delete'; strokeId: number | string }
  | { action: 'stroke:clear' }
  | { action: 'card:add'; card: MathCard }
  | { action: 'card:delete'; cardId: string }
  | { action: 'card:move'; cardId: string; x: number; y: number }
  | { action: 'jsxgraph:add'; id: string; spec: any }
  | { action: 'jsxgraph:delete'; id: string };

export interface CollabMessage {
  type: string;
  roomId?: string;
  userId?: string;
  userName?: string;
  role?: UserRole;
  isLocked?: boolean;
  state?: CanvasSnapshot;
  delta?: CanvasDeltaAction;
  users?: CollabUser[];
  timestamp?: string;
}
