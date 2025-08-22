using System.Collections.Generic;
using System.Linq;
using Unity.VisualScripting;
using UnityEngine;

public class RoadBuilder : MonoBehaviour
{
    private List<string> instantiated_roads = new List<string>();
    private Queue<Road> roads_to_instantiate = new Queue<Road>();
    private Queue<string> roads_to_destroy = new Queue<string>();
    // Maximum road processes per frame.
    [SerializeField] private int maxRoadsPerFrame = 2;


    public BackendWebrequests backend;
    public Material base_material;
    public Material solid_marking_material;
    public Material dashed_marking_material;
    public Material railing_material;

    Theme theme;

    RoadMarkingType[] GetMarkingsForLane(Road road, int lane_index)
    {
        bool no_lanes = road.road_look.name.Contains("no lanes") || road.road_look.name.Contains("dirt");
        bool no_outer_lanes = road.road_look.name.Contains("no outer lanes");
        bool no_center_lane = road.road_look.name.Contains("no center lane");
        bool double_markings = road.road_look.name.Contains("double");
        if(no_lanes || road.road_look.name.Contains("rail") || road.road_look.name.Contains("tram"))
        {
            return new RoadMarkingType[] { RoadMarkingType.NONE, RoadMarkingType.NONE };
        }

        Lane lane = road.lanes[lane_index];
        string[] lane_types = road.road_look.lanes_left.Concat(road.road_look.lanes_right).ToArray();
        string lane_type = lane_types[lane_index];

        Lane left_lane = null;
        string left_lane_type = null;

        Lane right_lane = null;
        string right_lane_type = null;

        RoadMarkingType left_marking = RoadMarkingType.SOLID;
        RoadMarkingType right_marking = RoadMarkingType.SOLID;
        if(no_outer_lanes)
        {
            if(lane_index == 0)
            {
                left_marking = RoadMarkingType.NONE;
                if (double_markings)
                {
                    right_marking = RoadMarkingType.DOUBLE;
                }
            }
            if(lane_index == road.lanes.Length - 1)
            {
                right_marking = RoadMarkingType.NONE;
                if (double_markings)
                {
                    left_marking = RoadMarkingType.DOUBLE;
                }
            }
        }

        if (lane_index < road.lanes.Length - 1)
        {
            try { right_lane_type = lane_types[lane_index + 1]; right_lane = road.lanes[lane_index + 1]; } catch { }
        }
        if (lane_index > 0)
        {
            try { left_lane_type = lane_types[lane_index - 1]; left_lane = road.lanes[lane_index - 1]; } catch { }
        }

        if (left_lane_type != null && left_lane_type.Contains("no_vehicles"))
        {
            right_marking = RoadMarkingType.NONE;
            left_marking = RoadMarkingType.NONE;
        }
        else if (left_lane_type != null && !left_lane_type.Contains("no_overtake") && (left_lane.side == lane.side || road.lanes.Length == 2))
        {
            if (no_center_lane)
            {
                left_marking = RoadMarkingType.NONE;
            }
            else if (left_lane_type != lane_type)
            {
                left_marking = RoadMarkingType.DASHED_SHORT;
            }
            else if (Vector3.Distance(left_lane.points[0].ToVector3(), lane.points[0].ToVector3()) < 4.7f)
            {
                left_marking = RoadMarkingType.DASHED;
            }
            else
            {
                left_marking = RoadMarkingType.SOLID;
            }
        }
        else if (left_lane_type != null && left_lane_type.Contains("no_overtake") && (left_lane.side == lane.side || road.lanes.Length == 2))
        {
            if (no_center_lane)
            {
                left_marking = RoadMarkingType.NONE;
            }
            else
            {
                left_marking = RoadMarkingType.DOUBLE;
            }
        }
        else if (no_center_lane && left_lane_type != null)
        {
            left_marking = RoadMarkingType.NONE;
        }

        if (right_lane_type != null && right_lane_type.Contains("no_vehicles"))
        {
            right_marking = RoadMarkingType.NONE;
            left_marking = RoadMarkingType.NONE;
        }
        if (right_lane_type != null && !right_lane_type.Contains("no_overtake") && (right_lane.side == lane.side || road.lanes.Length == 2))
        {
            if (no_center_lane)
            {
                right_marking = RoadMarkingType.NONE;
            }
            else if (right_lane_type != lane_type)
            {
                right_marking = RoadMarkingType.DASHED_SHORT;
            }
            else if (Vector3.Distance(right_lane.points[0].ToVector3(), lane.points[0].ToVector3()) < 4.7f)
            {
                right_marking = RoadMarkingType.DASHED;
            }
            else
            {
                right_marking = RoadMarkingType.SOLID;
            }
        }
        else if (right_lane_type != null && right_lane_type.Contains("no_overtake") && (right_lane.side == lane.side || road.lanes.Length == 2))
        {
            if (no_center_lane)
            {
                right_marking = RoadMarkingType.NONE;
            }
            else
            {
                right_marking = RoadMarkingType.DOUBLE;
            }
        }
        else if (no_center_lane && right_lane_type != null)
        {
            right_marking = RoadMarkingType.NONE;
        }

        return new RoadMarkingType[] { left_marking, right_marking };
    }

    void Start()
    {
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
    }

    void Update()
    {
        if (backend == null || backend.map == null || backend.map.roads == null)
        {
            return;
        }

        base_material.color = theme.asphalt;
        solid_marking_material.color = theme.markings;
        dashed_marking_material.color = theme.markings;
        railing_material.color = theme.railings;

        if (backend.roads_count > 0)
        {
            if (roads_to_instantiate.Count == 0 && roads_to_destroy.Count == 0)
            {
                UpdateRoadQueues();
            }

            for (int i = 0; i < maxRoadsPerFrame && roads_to_instantiate.Count > 0; i++)
            {
                InstantiateRoad(roads_to_instantiate.Dequeue());
            }

            for (int i = 0; i < maxRoadsPerFrame && roads_to_destroy.Count > 0; i++)
            {
                string roadId = roads_to_destroy.Dequeue();
                DestroyRoad(roadId);
            }
        }
        else
        {
            // If no roads are available, queue all roads for destruction
            if (instantiated_roads.Count > 0 && roads_to_destroy.Count == 0)
            {
                foreach (string road in instantiated_roads)
                {
                    roads_to_destroy.Enqueue(road);
                }
            }

            for (int i = 0; i < maxRoadsPerFrame && roads_to_destroy.Count > 0; i++)
            {
                string roadId = roads_to_destroy.Dequeue();
                DestroyRoad(roadId);
            }
        }
    }

    private void UpdateRoadQueues()
    {
        HashSet<string> roads_to_not_remove = new HashSet<string>();
        
        foreach (Road road in backend.map.roads)
        {
            roads_to_not_remove.Add(road.uid);
            
            if (!instantiated_roads.Contains(road.uid))
            {
                roads_to_instantiate.Enqueue(road);
            }
        }

        foreach (string roadId in instantiated_roads)
        {
            if (!roads_to_not_remove.Contains(roadId))
            {
                roads_to_destroy.Enqueue(roadId);
            }
        }
    }

    bool OneWayRoad(Road road)
    {
        if (road.lanes.Length == 0)
        {
            return true;
        }

        string side = road.lanes[0].side;
        for (int i = 0; i < road.lanes.Length; i++)
        {
            if (road.lanes[i].side != side)
            {
                return false;
            }
        }

        return true;
    }

    int FirstLaneSideChangeIndex(Road road)
    {
        if (road.lanes.Length == 0)
        {
            return 0;
        }

        string side = road.lanes[0].side;
        for (int i = 1; i < road.lanes.Length; i++)
        {
            if (road.lanes[i].side != side)
            {
                return i;
            }
        }
        return 0;
    }

    private void InstantiateRoad(Road road)
    {
        GameObject road_object = new GameObject("Road " + road.uid);
        road_object.AddComponent<RoadHandler>();
        road_object.GetComponent<RoadHandler>().road = road;

        Vector3 average = new Vector3(0, 0, 0);
        for (int i = 0; i < road.points.Length; i++)
        {
            average += road.points[i].ToVector3();
        }
        road_object.transform.position = average / road.points.Length;

        bool is_one_way = OneWayRoad(road);
        int changed = FirstLaneSideChangeIndex(road);

        for (int i = 0; i < road.lanes.Length; i++)
        {

            float left_shoulder = road.road_look.shoulder_space_left;
            float right_shoulder = road.road_look.shoulder_space_right;
            if (is_one_way)
            {
                float tmp = left_shoulder;
                left_shoulder = right_shoulder;
                right_shoulder = tmp;
            }

            // Lane Base
            Lane lane = road.lanes[i];
            Mesh mesh;
            mesh = lane.CreateMeshAlongPoints(left_shoulder: left_shoulder, right_shoulder: right_shoulder);
            GameObject lane_object = new GameObject("Lane " + i.ToString() + " " + lane.side);
            lane_object.AddComponent<MeshFilter>().mesh = mesh;
            MeshRenderer mesh_renderer = lane_object.AddComponent<MeshRenderer>();
            mesh_renderer.material = base_material;
            lane_object.transform.parent = road_object.transform;

            // What is on each side?
            RoadMarkingType[] markings = GetMarkingsForLane(road, i);
            RoadMarkingType left_marking = markings[0];
            RoadMarkingType right_marking = markings[1];

            // Left Side Marking
            Mesh marking_mesh = lane.CreateMarkingMesh(Side.LEFT, left_marking);
            GameObject marking_object = new GameObject("Marking Left " + i.ToString() + " " + left_marking.ToString());
            marking_object.AddComponent<MeshFilter>().mesh = marking_mesh;
            MeshRenderer marking_mesh_renderer = marking_object.AddComponent<MeshRenderer>();
            if (left_marking == RoadMarkingType.DASHED || left_marking == RoadMarkingType.DASHED_SHORT)
            {
                marking_mesh_renderer.material = dashed_marking_material;
                marking_mesh_renderer.material.SetFloat("_length", road.length);
                if (left_marking == RoadMarkingType.DASHED_SHORT)
                {
                    marking_mesh_renderer.material.SetFloat("_dashes_per_meter", 0.3f);
                }
            }
            else if (left_marking == RoadMarkingType.NONE)
            {
                marking_object.SetActive(false);
            }
            else
            {
                marking_mesh_renderer.material = solid_marking_material;
            }
            marking_object.transform.parent = lane_object.transform;

            // Right Side Marking
            marking_mesh = lane.CreateMarkingMesh(Side.RIGHT, right_marking);
            marking_object = new GameObject("Marking Right " + i.ToString() + " " + right_marking.ToString());
            marking_object.AddComponent<MeshFilter>().mesh = marking_mesh;
            marking_mesh_renderer = marking_object.AddComponent<MeshRenderer>();
            if (right_marking == RoadMarkingType.DASHED || right_marking == RoadMarkingType.DASHED_SHORT)
            {
                marking_mesh_renderer.material = dashed_marking_material;
                marking_mesh_renderer.material.SetFloat("_length", road.length);
                if (right_marking == RoadMarkingType.DASHED_SHORT)
                {
                    marking_mesh_renderer.material.SetFloat("_dashes_per_meter", 0.3f);
                }
            }
            else if (right_marking == RoadMarkingType.NONE)
            {
                marking_object.SetActive(false);
            }
            else
            {
                marking_mesh_renderer.material = solid_marking_material;
            }
            marking_object.transform.parent = lane_object.transform;

            // Railings
            if (road.railings != null && road.railings.Length > 0)
            {
                // Is on the outermost lane?
                if (is_one_way && (i != 0 && i != road.lanes.Length - 1))
                {
                    continue;
                }

                // Check left side outermost lane
                if (lane.side == "left" && (i != changed - 1 && i != 0))
                {
                    continue;
                }

                // Check right side outermost lane
                if (lane.side == "right" && (i != road.lanes.Length - 1 && i != changed))
                {
                    continue;
                }

                Railing railing = road.railings[0];

                // Create left railing if defined
                if (!string.IsNullOrEmpty(railing.left_railing) || railing.left_railing_offset != 0)
                {
                    bool render = false;
                    if (is_one_way)
                    {
                        if (i == 0)
                        {
                            render = true;
                        }
                    }
                    else
                    {
                        if (i == changed - 1 || i == changed)
                        {
                            render = true;
                        }
                    }

                    if (render)
                    {
                        Side side = Side.LEFT;
                        if (!is_one_way && lane.side == "left") { side = Side.RIGHT; }

                        if (side == Side.LEFT && left_marking == RoadMarkingType.DASHED)
                        {
                            continue; // Do not render railings on dashed markings (it would be in the middle of the road)
                        }
                        if (side == Side.RIGHT && right_marking == RoadMarkingType.DASHED)
                        {
                            continue; // Do not render railings on dashed markings (it would be in the middle of the road)
                        }

                        Mesh railing_mesh = lane.CreateRailingMesh(side, railing, lane_width: 4.5f, right_shoulder: right_shoulder, left_shoulder: left_shoulder);
                        GameObject railing_object = new GameObject("Railing Left " + i.ToString());
                        railing_object.transform.parent = lane_object.transform;
                        railing_object.AddComponent<MeshFilter>().mesh = railing_mesh;
                        MeshRenderer railing_mesh_renderer = railing_object.AddComponent<MeshRenderer>();

                        railing_mesh_renderer.material = railing_material;
                    }
                }

                // Create right railing if defined
                if (!string.IsNullOrEmpty(railing.right_railing) || railing.right_railing_offset != 0)
                {
                    bool render = false;
                    if (is_one_way)
                    {
                        if (i == road.lanes.Length - 1)
                        {
                            render = true;
                        }
                    }
                    else
                    {
                        if (i == road.lanes.Length - 1 || i == 0)
                        {
                            render = true;
                        }
                    }

                    if (render)
                    {
                        Side side = Side.RIGHT;
                        if (!is_one_way && lane.side == "left") { side = Side.LEFT; }

                        if (side == Side.LEFT && left_marking == RoadMarkingType.DASHED)
                        {
                            continue; // Do not render railings on dashed markings (it would be in the middle of the road)
                        }
                        if (side == Side.RIGHT && right_marking == RoadMarkingType.DASHED)
                        {
                            continue; // Do not render railings on dashed markings (it would be in the middle of the road)
                        }

                        Mesh railing_mesh = lane.CreateRailingMesh(side, railing, lane_width: 4.5f, right_shoulder: right_shoulder, left_shoulder: left_shoulder);
                        GameObject railing_object = new GameObject("Railing Right " + i.ToString());
                        railing_object.transform.parent = lane_object.transform;
                        railing_object.AddComponent<MeshFilter>().mesh = railing_mesh;
                        MeshRenderer railing_mesh_renderer = railing_object.AddComponent<MeshRenderer>();

                        railing_mesh_renderer.material = railing_material;
                    }
                }
            }
        }

        road_object.transform.parent = this.transform;
        road_object.AddComponent<StaticObject>();
        road_object.GetComponent<StaticObject>().position = road_object.transform.position;
        instantiated_roads.Add(road.uid);
    }

    private void DestroyRoad(string roadId)
    {
        GameObject roadObject = GameObject.Find("Road " + roadId);
        if (roadObject != null)
        {
            Destroy(roadObject);
        }
        instantiated_roads.Remove(roadId);
    }
}
