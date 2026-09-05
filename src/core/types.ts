export interface Vector3 { X: number; Y: number; Z: number; }
export interface Coordinate extends Vector3 { }
export interface LocalCoordinate extends Coordinate { cx: number; cz: number; }
export interface Quaternion extends Vector3 { W: number; }

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
  leftLaneCount: number;
  rightLaneCount: number;
}

export interface Vehicle 
{
  id: Uid;
  position: Coordinate;
  rotation: Quaternion;
  size: Vector3;
}

export interface DataFrame {
  timestamp: number;

  telemetryData: {
    position: Coordinate; 
    rotation: Quaternion;
  };

  nodes: Record<Uid, Node>;
  roads: RoadSegment[];
  vehicles: Vehicle[];
}