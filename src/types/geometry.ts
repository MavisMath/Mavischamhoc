/**
 * MathBoard AI - Dynamic Geometry Type Definitions
 * Definitions for JSXGraph declarative geometric steps and primitives.
 */

export type GeometryElementType =
  | 'point'
  | 'glider'
  | 'segment'
  | 'line'
  | 'ray'
  | 'midpoint'
  | 'perpendicular'
  | 'parallel'
  | 'bisector'
  | 'perpendicularbisector'
  | 'circle'
  | 'circumcircle'
  | 'incircle'
  | 'intersection'
  | 'polygon'
  | 'angle'
  | 'text'
  | 'functiongraph';

export interface BaseGeometryStep {
  id?: string;
  name?: string;
  type: GeometryElementType;
  color?: string;
  visible?: boolean;
}

export interface GeometryPointStep extends BaseGeometryStep {
  type: 'point';
  coords: [number, number];
  size?: number;
  fixed?: boolean;
  isFree?: boolean;
  strokeColor?: string;
  labelColor?: string;
}

export interface GeometrySegmentStep extends BaseGeometryStep {
  type: 'segment';
  points: [string, string];
  width?: number;
  dash?: number; // 0: solid, 1: dotted, 2: dashed
  opacity?: number;
}

export interface GeometryLineStep extends BaseGeometryStep {
  type: 'line';
  points: [string, string];
  width?: number;
  dash?: number;
}

export interface GeometryRayStep extends BaseGeometryStep {
  type: 'ray';
  points: [string, string];
  width?: number;
}

export interface GeometryCircleStep extends BaseGeometryStep {
  type: 'circle';
  center: string;
  radius?: number;
  point?: string;
  width?: number;
  dash?: number;
  fillColor?: string;
  fillOpacity?: number;
}

export interface GeometryAngleStep extends BaseGeometryStep {
  type: 'angle';
  points: [string, string, string]; // [p1, vertex, p2]
  rightAngle?: boolean;
  radius?: number;
  label?: string;
}

export interface GeometryPolygonStep extends BaseGeometryStep {
  type: 'polygon';
  points: string[];
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface GeometryIntersectionStep extends BaseGeometryStep {
  type: 'intersection';
  objects: [string, string];
  index?: number;
}

export interface GeometryPerpendicularStep extends BaseGeometryStep {
  type: 'perpendicular';
  base: string;
  point: string;
  width?: number;
  dash?: number;
}

export interface GeometryParallelStep extends BaseGeometryStep {
  type: 'parallel';
  base: string;
  point: string;
  width?: number;
  dash?: number;
}

export interface GeometryFunctionGraphStep extends BaseGeometryStep {
  type: 'functiongraph';
  fn: string;
  range?: [number, number];
}

export type GeometryStep =
  | GeometryPointStep
  | GeometrySegmentStep
  | GeometryLineStep
  | GeometryRayStep
  | GeometryCircleStep
  | GeometryAngleStep
  | GeometryPolygonStep
  | GeometryIntersectionStep
  | GeometryPerpendicularStep
  | GeometryParallelStep
  | GeometryFunctionGraphStep
  | BaseGeometryStep;

export interface DynamicGeometrySpec {
  title: string;
  shapeType?: string;
  cardType?: '2d' | '3d' | 'algebra';
  explanation?: string;
  mathSummary?: string;
  boundingbox: [number, number, number, number];
  axis?: boolean;
  grid?: boolean;
  steps: GeometryStep[];
}
