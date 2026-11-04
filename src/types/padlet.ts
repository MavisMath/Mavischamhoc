import { MathCard } from './card';

export interface StrokePoint {
  x: number;
  y: number;
  p?: number;
}

export interface WhiteboardStroke {
  id: number | string;
  type: 'pen' | 'highlighter';
  points: StrokePoint[];
  color: string;
  width: number;
  alpha: number;
  selectable?: boolean;
}

export interface CanvasSettings {
  panX: number;
  panY: number;
  zoom: number;
}

export interface CanvasSnapshot {
  strokes: WhiteboardStroke[];
  padletTexts?: Array<{ id: string; text: string; x: number; y: number; color?: string }>;
  cards: MathCard[];
  geometryObjects?: any[];
  settings: CanvasSettings;
}

export interface PadletDocument {
  roomId: string;
  name: string;
  hostId: string;
  hostName?: string;
  createdAt: string;
  updatedAt: string;
  strokesCount?: number;
  cardsCount?: number;
  preview?: string;
  themeColor?: string;
  state?: CanvasSnapshot;
}
