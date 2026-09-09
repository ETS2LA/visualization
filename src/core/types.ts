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
  node: Uid;          // Start
  forwardNode: Uid;   // End
  length: number;

  // Offsets go from left -> right, so the leftmost lane is at index 0 and 
  // the rightmost lane is at index (laneOffsets.length - 1)
  laneOffsetsStart: number[];
  laneOffsetsEnd: number[];
  leftLaneCount: number;
  rightLaneCount: number;
}

export interface PrefabSegment {
  startPosition: Coordinate;
  endPosition: Coordinate;
  startRotation: Quaternion;
  endRotation: Quaternion;

  length: number;
}

export interface Prefab {
  id: Uid;
  segments: PrefabSegment[];

  prefabStart: Coordinate;
  rootNodePosition: Coordinate;
  prefabRotation: Vector3;
}

export interface AxisAlignedBoundingBox {
  min: Vector3;
  max: Vector3;
}

export interface ModelPiece {
  boundingBox: AxisAlignedBoundingBox;
  boundingBoxCenter: Vector3;
}

export interface ModelPart {
  pieces: ModelPiece[];
}

export interface Model {
  look: string; // The name of the file: /def/world/*/model_name.sii
  name: string; // The name of the model as defined in the .sii file
  node: Uid;
  scale: Vector3;
  boundingBox: AxisAlignedBoundingBox;
  boundingBoxCenter: Vector3;
  parts: ModelPart[];
}

export interface Trailer
{
  id: Uid;
  position: Coordinate;
  rotation: Quaternion;
  size: Vector3;
}

export interface Vehicle 
{
  id: Uid;
  position: Coordinate;
  rotation: Quaternion;
  size: Vector3;
  trailers: Trailer[];
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
  prefabs: Prefab[];
}

export class DataFrameInterpolator 
{
  lastFrame: DataFrame | null = null;
  currentFrame: DataFrame | null = null;

  setCurrentFrame(frame: DataFrame) {
    this.lastFrame = this.getInterpolatedFrame(frame.timestamp) || this.currentFrame;
    this.currentFrame = frame;
  }

  getInterpolatedFrame(timestamp: number): DataFrame | null {
    if (!this.lastFrame || !this.currentFrame) {
      return null;
    }

    const lastTimestamp = this.lastFrame.timestamp;
    const currentTimestamp = this.currentFrame.timestamp;
    const timeDelta = currentTimestamp - lastTimestamp;
    
    // We don't know when the next frame will arrive, but we can estimate that the next frame will be here
    // in at least 200ms. Technically the higher this value is the "smoother" the output will be at the cost of latency.
    // 200 seems fine for most cases.
    const nextFrameEstimatedTimestamp = currentTimestamp + 200;
    const t = (timestamp - currentTimestamp) / (nextFrameEstimatedTimestamp - currentTimestamp);

    if (t < 0 || t > 1) {
      return null;
    }

    const interpolate = (start: number, end: number) => start + (end - start) * t;
    const interpolateVector3 = (start: Vector3, end: Vector3): Vector3 => ({
      X: interpolate(start.X, end.X),
      Y: interpolate(start.Y, end.Y),
      Z: interpolate(start.Z, end.Z),
    });

    const interpolateQuaternion = (start: Quaternion, end: Quaternion): Quaternion => ({
      X: interpolate(start.X, end.X),
      Y: interpolate(start.Y, end.Y),
      Z: interpolate(start.Z, end.Z),
      W: interpolate(start.W, end.W),
    });

    const interpolateTrailer = (start: Trailer, end: Trailer): Trailer => ({
      id: start.id,
      position: interpolateVector3(start.position, end.position),
      rotation: interpolateQuaternion(start.rotation, end.rotation),
      size: end.size, // We're assuming the size doesn't change between frames.
    });

    const interpolateVehicle = (start: Vehicle, end: Vehicle): Vehicle => ({
      id: start.id,
      position: interpolateVector3(start.position, end.position),
      rotation: interpolateQuaternion(start.rotation, end.rotation),
      trailers: end.trailers.map(endTrailer => {
        const startTrailer = start.trailers.find(t => t.id === endTrailer.id);
        if (startTrailer) {
          return interpolateTrailer(startTrailer, endTrailer);
        } else {
          return endTrailer;
        }
      }),
      size: end.size, // We're assuming the size doesn't change between frames.
    });

    const interpolatedFrame: DataFrame = {
      timestamp,
      telemetryData: {
        position: interpolateVector3(this.lastFrame.telemetryData.position, this.currentFrame.telemetryData.position),
        rotation: interpolateQuaternion(this.lastFrame.telemetryData.rotation, this.currentFrame.telemetryData.rotation),
      },
      nodes: this.currentFrame.nodes,
      roads: this.currentFrame.roads,
      prefabs: this.currentFrame.prefabs,
      vehicles: this.currentFrame.vehicles.map(currentVehicle => {
        const lastVehicle = this.lastFrame!.vehicles.find(v => v.id === currentVehicle.id);
        if (lastVehicle) {
          return interpolateVehicle(lastVehicle, currentVehicle);
        } else {
          return currentVehicle;
        }
      }),
    };

    return interpolatedFrame;
  }
}