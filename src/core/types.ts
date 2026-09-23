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

  id: number;
  length: number;
  nextSegments: number[];
  previousSegments: number[];
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
  id: Uid;
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
  speed: number;
  position: Coordinate;
  rotation: Quaternion;
  size: Vector3;
  trailers: Trailer[];
}

export interface TelemetryTrailer 
{
  position: Coordinate;
  rotationEuler: Vector3;
  hookPosition: Coordinate;

  wheels: Vector3[];
}

export interface DataFrame {
  timestamp: number;

  telemetryData: {
    position: Coordinate;
    rotation: Quaternion;
    trailers: TelemetryTrailer[];
    speed: number;
    speedLimit: number;
    throttle: number;
    brake: number;
    clutch: number;
    steering: number;
  };

  selfDrivingData: {
    pathPoints: Coordinate[];
    targetVehicles: number[];
    targetSemaphores: number[];

    targetSpeed: number;
    isControllingSteering: boolean;
    isControllingAcceleration: boolean;
  }

  nodes: Record<Uid, Node>;
  roads: RoadSegment[];
  vehicles: Vehicle[];
  prefabs: Prefab[];
  models: Model[];
}

export class DataFrameInterpolator 
{
  lastFrame: DataFrame | null = null;
  currentFrame: DataFrame | null = null;
  
  // This determines when we drop interpolation and just
  // immediately snap to the new position. This can happen
  // when the user teleports for example, so we just prevent
  // the 10 or so seconds it would take to get there normally.
  // NOTE: This is not the actual distance as we don't do a sqrt.
  //       In reality this is ~50-70m.
  readonly SNAP_DISTANCE = 5000;

  setCurrentFrame(frame: DataFrame) {
    this.lastFrame = this.getInterpolatedFrame(frame.timestamp) || this.currentFrame;
    this.currentFrame = frame;
  }

  getInterpolatedFrame(timestamp: number): DataFrame | null {
    if (!this.lastFrame || !this.currentFrame) {
      return null;
    }

    // We don't know when the next frame will arrive, but we can estimate that the next frame will be here
    // in at least 200ms (twice the datarate). Technically the higher this value is the "smoother" the output 
    // will be at the cost of latency, 200 seems fine for most cases.
    const currentTimestamp = this.currentFrame.timestamp;
    const nextFrameEstimatedTimestamp = currentTimestamp + 200;
    const t = (timestamp - currentTimestamp) / (nextFrameEstimatedTimestamp - currentTimestamp);

    if (t < 0 || t > 1) {
      return null;
    }

    const interpolate = (start: number, end: number) => start + (end - start) * t;
    const interpolateVector3 = (start: Vector3, end: Vector3): Vector3 => {
      const dist = distance3(start, end);
      if (dist > this.SNAP_DISTANCE)
        return end;

      return ({
        X: interpolate(start.X, end.X),
        Y: interpolate(start.Y, end.Y),
        Z: interpolate(start.Z, end.Z),
      });
    }
      

    // Euler values can change signs from negative to positive. i.e. 1.0 -> -1.0.
    // We need to handle this case as well.
    const interpolateEulerVector3 = (start: Vector3, end: Vector3): Vector3 => {
      const interp = (s: number, e: number) => {
        let d = e - s;
        while (d > 0.5) d -= 1;
        while (d < -0.5) d += 1;
        let v = s + d * t;
        v = v - Math.floor(v);
        return v;
      };

      return { 
        X: interp(start.X, end.X), 
        Y: interp(start.Y, end.Y), 
        Z: interp(start.Z, end.Z) 
      };
    };

    const distance3 = (a: Vector3, b: Vector3) => {
      const dx = a.X - b.X;
      const dy = a.Y - b.Y;
      const dz = a.Z - b.Z;
      return dx + dy + dz;
    };

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
      size: end.size,
    });

    const interpolateVehicle = (start: Vehicle, end: Vehicle): Vehicle => ({
      id: start.id,
      speed: interpolate(start.speed, end.speed),
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
      size: end.size,
    });

    const interpolatePathPoints = (
      start: Coordinate[],
      end: Coordinate[]
    ): Coordinate[] => {
      const sharedPointCount = Math.min(start.length, end.length);
      const points = end.map((point, index) => {
        const startPoint = start[index];
        return startPoint
          ? interpolateVector3(startPoint, point)
          : point;
      });

      // We have to add points ot the end of the path
      // if the new path has more than the last one. This makes
      // sure that those get past the slice.
      if (end.length > sharedPointCount)
        return points;

      return points.slice(0, sharedPointCount);
    };

    const interpolateTelemetryTrailer = (start: TelemetryTrailer, end: TelemetryTrailer): TelemetryTrailer => {
      return {
        position: interpolateVector3(start.position, end.position),
        rotationEuler: interpolateEulerVector3(start.rotationEuler, end.rotationEuler),
        hookPosition: interpolateVector3(start.hookPosition, end.hookPosition),
        wheels: start.wheels.map((wheel, index) => {
          const endWheel = end.wheels[index];
          return endWheel ? interpolateVector3(wheel, endWheel) : wheel;
        }),
      };
    };

    const interpolatedFrame: DataFrame = {
      timestamp,
      telemetryData: {
        position: interpolateVector3(this.lastFrame.telemetryData.position, this.currentFrame.telemetryData.position),
        rotation: interpolateQuaternion(this.lastFrame.telemetryData.rotation, this.currentFrame.telemetryData.rotation),
        trailers: this.currentFrame.telemetryData.trailers.map((trailer, index) => {
          const lastTrailer = this.lastFrame!.telemetryData.trailers[index];
          if (lastTrailer) {
            return interpolateTelemetryTrailer(lastTrailer, trailer);
          } else {
            return trailer;
          }
        }),
        speed: interpolate(this.lastFrame.telemetryData.speed, this.currentFrame.telemetryData.speed),
        speedLimit: interpolate(this.lastFrame.telemetryData.speedLimit, this.currentFrame.telemetryData.speedLimit),
        throttle: interpolate(this.lastFrame.telemetryData.throttle, this.currentFrame.telemetryData.throttle),
        brake: interpolate(this.lastFrame.telemetryData.brake, this.currentFrame.telemetryData.brake),
        clutch: interpolate(this.lastFrame.telemetryData.clutch, this.currentFrame.telemetryData.clutch),
        steering: interpolate(this.lastFrame.telemetryData.steering, this.currentFrame.telemetryData.steering),
      },
      selfDrivingData: {
        pathPoints: interpolatePathPoints(
          this.lastFrame.selfDrivingData.pathPoints,
          this.currentFrame.selfDrivingData.pathPoints
        ),
        targetVehicles: this.currentFrame.selfDrivingData.targetVehicles,
        targetSemaphores: this.currentFrame.selfDrivingData.targetSemaphores,
        targetSpeed: this.currentFrame.selfDrivingData.targetSpeed,
        isControllingSteering: this.currentFrame.selfDrivingData.isControllingSteering,
        isControllingAcceleration: this.currentFrame.selfDrivingData.isControllingAcceleration,
      },
      nodes: this.currentFrame.nodes,
      roads: this.currentFrame.roads,
      prefabs: this.currentFrame.prefabs,
      models: this.currentFrame.models,
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