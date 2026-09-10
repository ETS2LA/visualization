import * as THREE from "three";
import type { Quaternion } from "./types";

export function convertQuaternion(q: Quaternion): THREE.Quaternion 
{
    const quat = new THREE.Quaternion(
        -q.X,
        q.Y,
        q.Z,
        q.W
    );

    // The camera ends up being upside down, so we need to
    // flip it right side up...
    const correction = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.PI
    );
    quat.multiply(correction);

    return quat;
}