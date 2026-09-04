export interface Vector3 { x: number; y: number; z: number; }
export interface Coordinate extends Vector3 { }
export interface LocalCoordinate extends Coordinate { cx: number; cz: number; }
export interface Quaternion extends Vector3 { w: number; }

export type Uid = number;

export interface Node {
    id: Uid;
    position: Coordinate;
    rotation: Quaternion;
}

export interface RoadSegment {
  id: Uid;
  node: string;          // Start
  forwardNode: string;   // End
  laneOffsets: number[];
}

export interface BaseVehicle {
    position: Coordinate;
    rotation: Quaternion;
    size: Vector3;
}

export interface DataFrame {
  timestamp: number;

  telemetry: {
    position: Coordinate; 
    rotation: Quaternion;
  };

  nodes: Record<Uid, Node>;
  roads: RoadSegment[];
  vehicles: BaseVehicle[];
}