using System;
using System.Collections.Generic;
using Unity.Mathematics;
using UnityEngine;

public class PrefabBuilder : MonoBehaviour
{
    private Dictionary<string, GameObject> instantiated_prefabs = new Dictionary<string, GameObject>();
    private int last_prefab_count = 0;
    private Queue<Prefab> prefabs_to_instantiate = new Queue<Prefab>();
    private Queue<string> prefabs_to_destroy = new Queue<string>();
    [SerializeField] private int maxPrefabsPerFrame = 2;
    
    public BackendWebrequests backend;
    public Material base_material;
    public Material solid_marking_material;
    public Material dashed_marking_material;


    public float close_threshold = 4.75f;
    public float same_threshold = 0.25f;
    public float parallel_threshold = 0.25f;

    PrefabMarking[] GetMarkingsForLane(Prefab prefab, int route_index)
    {
        if(prefab.token.Contains("dirt"))
        {
            return new PrefabMarking[] { new PrefabMarking(), new PrefabMarking() };
        }

        NavRoute route = prefab.nav_routes[route_index];
        if (route == null)
        {
            return new PrefabMarking[] { new PrefabMarking(), new PrefabMarking() };
        }
        if (route.points == null || route.points.Length == 0)
        {
            return new PrefabMarking[] { new PrefabMarking(), new PrefabMarking() };
        }
        
        PrefabMarking solid_marking = new PrefabMarking();
        solid_marking.type = RoadMarkingType.SOLID;
        PrefabMarking left_marking = solid_marking;
        PrefabMarking right_marking = solid_marking;

        float closest_right_distance = float.MaxValue;
        float closest_left_distance = float.MaxValue;
        NavRoute closest_right = null;
        NavRoute closest_left = null;

        foreach (NavRoute other_route in prefab.nav_routes)
        {
            if (other_route == route)
            {
                continue;
            }

            float start_distance = Vector3.Distance(route.points[0].ToVector3(), other_route.points[0].ToVector3());
            float end_distance = Vector3.Distance(route.points[route.points.Length - 1].ToVector3(), other_route.points[other_route.points.Length - 1].ToVector3());

            if (start_distance < close_threshold && start_distance > same_threshold && end_distance > same_threshold)
            {
                Vector2 A = new Vector2(route.points[0].x, route.points[0].z);
                Vector2 B = new Vector2(route.points[route.points.Length - 1].x, route.points[route.points.Length - 1].z);
                Vector2 C = new Vector2(other_route.points[0].x, other_route.points[0].z);

                // Triangle ABC, angle is either 90 or 270 degrees depending on the side (right, left)
                float angle = math.atan2((B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y), (B.x - A.x) * (C.x - A.x) + (B.y - A.y) * (C.y - A.y));

                if (angle < 0)
                {
                    float distance = Vector3.Distance(route.points[0].ToVector3(), other_route.points[0].ToVector3());
                    if (distance < closest_right_distance)
                    {
                        closest_right_distance = distance;
                        closest_right = other_route;
                    }
                }
                else if (angle > 0)
                {
                    float distance = Vector3.Distance(route.points[0].ToVector3(), other_route.points[0].ToVector3());
                    if (distance < closest_left_distance)
                    {
                        closest_left_distance = distance;
                        closest_left = other_route;
                    }
                }
            }
            else if (start_distance < close_threshold && end_distance > same_threshold) // Start from same point
            {
                Vector2 A = new Vector2(route.points[route.points.Length - 1].x, route.points[route.points.Length - 1].z);
                Vector2 B = new Vector2(route.points[0].x, route.points[0].z);
                Vector2 C = new Vector2(other_route.points[other_route.points.Length - 1].x, other_route.points[other_route.points.Length - 1].z);
            
                float angle = math.atan2((B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y), (B.x - A.x) * (C.x - A.x) + (B.y - A.y) * (C.y - A.y));

                if (angle > 0)
                {
                    closest_right_distance = 0;
                    closest_right = null;
                    right_marking = new PrefabMarking();
                }
                else if (angle < 0)
                {
                    closest_left_distance = 0;
                    closest_left = null;
                    left_marking = new PrefabMarking();
                }
            }
            else
            {
                if (end_distance < same_threshold) 
                {
                    // Two lanes that merge into one.
                    Vector2 A = new Vector2(route.points[0].x, route.points[0].z);
                    Vector2 B = new Vector2(route.points[route.points.Length - 1].x, route.points[route.points.Length - 1].z);
                    Vector2 C = new Vector2(other_route.points[0].x, other_route.points[0].z);

                    float angle = math.atan2((B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y), (B.x - A.x) * (C.x - A.x) + (B.y - A.y) * (C.y - A.y));

                    if (angle < 0)
                    {
                        closest_right_distance = 0;
                        closest_right = null;
                        right_marking = new PrefabMarking();
                    }
                    else if (angle > 0)
                    {
                        closest_left_distance = 0;
                        closest_left = null;
                        left_marking = new PrefabMarking();
                    } 
                }
            }
        }

        if (closest_right != null)
        {
            float closest_right_end_distance = Vector3.Distance(route.points[route.points.Length - 1].ToVector3(), closest_right.points[closest_right.points.Length - 1].ToVector3());
            float change = closest_right_distance - closest_right_end_distance;
            if (math.abs(change) < parallel_threshold)
            {
                float route_distance = GetRouteLength(route.points);
                float other_distance = GetRouteLength(closest_right.points);
                float avg_distance = (route_distance + other_distance) / 2;
                PrefabMarking marking = new PrefabMarking();
                marking.type = RoadMarkingType.DASHED;
                marking.distance = avg_distance;
                right_marking = marking;
            }
            else
            {
                right_marking = new PrefabMarking();
                right_marking.type = RoadMarkingType.SOLID;
            }
        }

        if (closest_left != null)
        {
            float closest_left_end_distance = Vector3.Distance(route.points[route.points.Length - 1].ToVector3(), closest_left.points[closest_left.points.Length - 1].ToVector3());
            float change = closest_left_distance - closest_left_end_distance;
            if (math.abs(change) < parallel_threshold)
            {
                float route_distance = GetRouteLength(route.points);
                float other_distance = GetRouteLength(closest_left.points);
                float avg_distance = (route_distance + other_distance) / 2;
                PrefabMarking marking = new PrefabMarking();
                marking.type = RoadMarkingType.DASHED;
                marking.distance = avg_distance;
                left_marking = marking;
            }
            else
            {
                right_marking = new PrefabMarking();
                right_marking.type = RoadMarkingType.SOLID;
            }
        }

        return new PrefabMarking[] { left_marking, right_marking };
    }

    float GetRouteLength(Point[] points)
    {
        float length = 0;
        for (int i = 0; i < points.Length - 1; i++)
        {
            length += Vector3.Distance(points[i].ToVector3(), points[i + 1].ToVector3());
        }
        return length;
    }

    void Update()
    {
        if (backend == null || backend.map == null || backend.map.prefabs == null)
        {
            return;
        }

        if (backend.prefabs_count > 0)
        {
            if (prefabs_to_instantiate.Count == 0 && prefabs_to_destroy.Count == 0 && backend.prefabs_count != last_prefab_count)
            {
                last_prefab_count = backend.prefabs_count;
                UpdatePrefabQueues();
            }

            for (int i = 0; i < maxPrefabsPerFrame && prefabs_to_instantiate.Count > 0; i++)
            {
                InstantiatePrefab(prefabs_to_instantiate.Dequeue());
            }

            for (int i = 0; i < maxPrefabsPerFrame && prefabs_to_destroy.Count > 0; i++)
            {
                string prefabId = prefabs_to_destroy.Dequeue();
                DestroyPrefab(prefabId);
            }
        }
        else
        {
            // If no prefabs are available, queue all prefabs for destruction
            if (instantiated_prefabs.Count > 0 && prefabs_to_destroy.Count == 0)
            {
                foreach (string prefabId in instantiated_prefabs.Keys)
                {
                    prefabs_to_destroy.Enqueue(prefabId);
                }
            }

            for (int i = 0; i < maxPrefabsPerFrame && prefabs_to_destroy.Count > 0; i++)
            {
                string prefabId = prefabs_to_destroy.Dequeue();
                DestroyPrefab(prefabId);
            }
        }
    }

    private void UpdatePrefabQueues()
    {
        HashSet<string> prefabs_to_not_remove = new HashSet<string>();
        
        foreach (Prefab prefab in backend.map.prefabs)
        {
            prefabs_to_not_remove.Add(prefab.uid);
            
            if (!instantiated_prefabs.ContainsKey(prefab.uid))
            {
                prefabs_to_instantiate.Enqueue(prefab);
            }
        }

        foreach (string prefabId in instantiated_prefabs.Keys)
        {
            if (!prefabs_to_not_remove.Contains(prefabId))
            {
                prefabs_to_destroy.Enqueue(prefabId);
            }
        }
    }

    private void InstantiatePrefab(Prefab prefab)
    {
        GameObject prefab_object = new GameObject("Prefab " + prefab.uid);
        prefab_object.AddComponent<PrefabHandler>();
        
        prefab_object.transform.parent = this.transform;
        prefab_object.transform.position = prefab.origin_node.PositionTuple();

        for(int i = 0; i < prefab.nav_routes.Length; i++)
        {
            NavRoute route = prefab.nav_routes[i];
            Mesh mesh = route.CreateMeshAlongPoints(prefab.origin_node.PositionTuple());
            GameObject route_object = new GameObject("Route " + i.ToString());
            route_object.transform.parent = prefab_object.transform;
            route_object.transform.position = prefab.origin_node.PositionTuple();
            route_object.AddComponent<MeshFilter>().mesh = mesh;
            MeshRenderer mesh_renderer = route_object.AddComponent<MeshRenderer>();
            mesh_renderer.material = base_material;

            // Which markings to use
            PrefabMarking[] markings = GetMarkingsForLane(prefab, i);
            RoadMarkingType left_marking = markings[0].type;
            RoadMarkingType right_marking = markings[1].type;

            // Left Side Marking
            if (left_marking != RoadMarkingType.NONE)
            {
                Mesh marking_mesh = route.CreateMarkingMesh(Side.LEFT, left_marking, prefab.origin_node.PositionTuple());
                GameObject marking_object = new GameObject("Marking Left " + i.ToString() + " " + left_marking.ToString());
                marking_object.transform.parent = route_object.transform;
                marking_object.transform.position = prefab.origin_node.PositionTuple();
                marking_object.AddComponent<MeshFilter>().mesh = marking_mesh;
                MeshRenderer marking_mesh_renderer = marking_object.AddComponent<MeshRenderer>();
                if (left_marking == RoadMarkingType.DASHED)
                {
                    marking_mesh_renderer.material = dashed_marking_material;
                    marking_mesh_renderer.material.SetFloat("_length", markings[0].distance);
                }
                else
                {
                    marking_mesh_renderer.material = solid_marking_material;
                }
            }
        
            // Right Side Marking
            if (right_marking != RoadMarkingType.NONE) {
                Mesh marking_mesh = route.CreateMarkingMesh(Side.RIGHT, right_marking, prefab.origin_node.PositionTuple());
                GameObject marking_object = new GameObject("Marking Right " + i.ToString() + " " + right_marking.ToString());
                marking_object.transform.parent = route_object.transform;
                marking_object.transform.position = prefab.origin_node.PositionTuple();
                marking_object.AddComponent<MeshFilter>().mesh = marking_mesh;
                MeshRenderer marking_mesh_renderer = marking_object.AddComponent<MeshRenderer>();
                if (right_marking == RoadMarkingType.DASHED)
                {
                    marking_mesh_renderer.material = dashed_marking_material;
                    marking_mesh_renderer.material.SetFloat("_length", markings[1].distance);
                }
                else
                {
                    marking_mesh_renderer.material = solid_marking_material;
                }
            }
        }

        instantiated_prefabs.Add(prefab.uid, prefab_object);
        prefab_object.AddComponent<StaticObject>();
        prefab_object.GetComponent<StaticObject>().position = prefab_object.transform.position;
    }

    private void DestroyPrefab(string prefabId)
    {
        if (instantiated_prefabs.TryGetValue(prefabId, out GameObject prefabObject))
        {
            Destroy(prefabObject);
        }
        instantiated_prefabs.Remove(prefabId);
    }
}