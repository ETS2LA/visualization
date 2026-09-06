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
    // in at least (timeDelta * 1.1) milliseconds. This is not an issue, since when lastFrame is updated, it will
    // take the latest interpolated frame meaning there's no hitching.
    const nextFrameEstimatedTimestamp = currentTimestamp + 200; // TODO: Use timeDelta, why did it not work well? Investigate
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
          return endTrailer; // If the trailer doesn't exist in the last frame, keep the current frame's trailer.
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
      vehicles: this.currentFrame.vehicles.map(currentVehicle => {
        const lastVehicle = this.lastFrame!.vehicles.find(v => v.id === currentVehicle.id);
        if (lastVehicle) {
          return interpolateVehicle(lastVehicle, currentVehicle);
        } else {
          return currentVehicle; // If the vehicle doesn't exist in the last frame, keep the current frame's vehicle.
        }
      }),
    };

    return interpolatedFrame;
  }
}