import type { Vector3, Quaternion, Node } from './types';

// This file is largely copied from TruckLib.HermiteSpline in C#.
// I've attached the C# code as comments for reference.

// public static Vector3 InterpolatePolyline(INode start, INode end, float t, float? cachedLength = null)
// {
//     var (tanStart, tanEnd) = CalculateTangents(start, end, cachedLength);
//     return Interpolate(start.Position, end.Position, tanStart, tanEnd, t);
// }
export function interpolatePolyline(start: Node, end: Node, t: number, cachedLength?: number): Vector3 {
    const { tanStart, tanEnd } = calculateTangents(start, end, cachedLength);
    return interpolateHermite(start.position, end.position, tanStart, tanEnd, t);
}

// public static Vector3 Interpolate(Vector3 p0, Vector3 p1, Vector3 m0, Vector3 m1, float t)
// {
//     var t2 = t * t;
//     var t3 = t * t * t;
//     return (2 * t3 - 3 * t2 + 1) * p0 +
//         (t3 - 2 * t2 + t) * m0 +
//         (-2 * t3 + 3 * t2) * p1 +
//         (t3 - t2) * m1;
// }
export function interpolateHermite(p0: Vector3, p1: Vector3, m0: Vector3, m1: Vector3, t: number): Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;

    const firstTerm = (2 * t3 - 3 * t2 + 1);
    const secondTerm = (t3 - 2 * t2 + t);
    const thirdTerm = (-2 * t3 + 3 * t2);
    const fourthTerm = (t3 - t2);

    return {
        X: firstTerm * p0.X + secondTerm * m0.X + thirdTerm * p1.X + fourthTerm * m1.X,
        Y: firstTerm * p0.Y + secondTerm * m0.Y + thirdTerm * p1.Y + fourthTerm * m1.Y,
        Z: firstTerm * p0.Z + secondTerm * m0.Z + thirdTerm * p1.Z + fourthTerm * m1.Z,
    };
}


// internal static (Vector3 tanStart, Vector3 tanEnd) CalculateTangents(INode start, INode end, float? cachedLength = null)
// {
//     var length = cachedLength ?? (end.Position - start.Position).Length();
//     var initialVector = new Vector3(0, 0, -length);
//     var tanStart = Vector3.Transform(initialVector, start.Rotation);
//     var tanEnd = Vector3.Transform(initialVector, end.Rotation);
//     return (tanStart, tanEnd);
// }
export function calculateTangents(start: Node, end: Node, cachedLength?: number): { tanStart: Vector3; tanEnd: Vector3 } {
    const length = cachedLength ?? Math.sqrt(
        Math.pow(end.position.X - start.position.X, 2) +
        Math.pow(end.position.Y - start.position.Y, 2) +
        Math.pow(end.position.Z - start.position.Z, 2)
    );

    const initialVector: Vector3 = { X: 0, Y: 0, Z: -length };

    const tanStart: Vector3 = {
        X: initialVector.X * (1 - 2 * start.rotation.X * start.rotation.X - 2 * start.rotation.Y * start.rotation.Y) + 
           initialVector.Y * (2 * start.rotation.X * start.rotation.Y - 2 * start.rotation.W * start.rotation.Z) + 
           initialVector.Z * (2 * start.rotation.X * start.rotation.Z + 2 * start.rotation.W * start.rotation.Y),
        Y: initialVector.X * (2 * start.rotation.X * start.rotation.Y + 2 * start.rotation.W * start.rotation.Z) + 
           initialVector.Y * (1 - 2 * start.rotation.X * start.rotation.X - 2 * start.rotation.Z * start.rotation.Z) + 
           initialVector.Z * (2 * start.rotation.Y * start.rotation.Z - 2 * start.rotation.W * start.rotation.X),
        Z: initialVector.X * (2 * start.rotation.X * start.rotation.Z - 2 * start.rotation.W * start.rotation.Y) + 
           initialVector.Y * (2 * start.rotation.Y * start.rotation.Z + 2 * start.rotation.W * start.rotation.X) + 
           initialVector.Z * (1 - 2 * start.rotation.X * start.rotation.X - 2 * start.rotation.Y * start.rotation.Y)
    };

    const tanEnd: Vector3 = {
        X: initialVector.X * (1 - 2 * end.rotation.X * end.rotation.X - 2 * end.rotation.Y * end.rotation.Y) + 
           initialVector.Y * (2 * end.rotation.X * end.rotation.Y - 2 * end.rotation.W * end.rotation.Z) + 
           initialVector.Z * (2 * end.rotation.X * end.rotation.Z + 2 * end.rotation.W * end.rotation.Y),
        Y: initialVector.X * (2 * end.rotation.X * end.rotation.Y + 2 * end.rotation.W * end.rotation.Z) + 
           initialVector.Y * (1 - 2 * end.rotation.X * end.rotation.X - 2 * end.rotation.Z * end.rotation.Z) + 
           initialVector.Z * (2 * end.rotation.Y * end.rotation.Z - 2 * end.rotation.W * end.rotation.X),
        Z: initialVector.X * (2 * end.rotation.X * end.rotation.Z - 2 * end.rotation.W * end.rotation.Y) + 
           initialVector.Y * (2 * end.rotation.Y * end.rotation.Z + 2 * end.rotation.W * end.rotation.X) + 
           initialVector.Z * (1 - 2 * end.rotation.X * end.rotation.X - 2 * end.rotation.Y * end.rotation.Y)
    };

    return { tanStart, tanEnd };
}