import { DynamicGeometrySpec, GeometryStep } from './geometry';

export type CardType = '2d' | '3d' | 'note' | 'algebra' | 'custom';

export interface MathCard {
  id: string;
  type: CardType;
  title: string;
  content: string;
  shapeType?: string;
  x: number;
  y: number;
  width: number;
  color?: string;
  isPinned?: boolean;
  steps?: GeometryStep[];
  canvasSpec?: DynamicGeometrySpec | null;
  axis?: boolean;
  grid?: boolean;
  boundingbox?: [number, number, number, number] | null;
  s?: number;
  v_water?: number;
  total_time?: number;
}
