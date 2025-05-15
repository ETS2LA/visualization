using System.Linq;
using UnityEngine;

public class RoadHandler : MonoBehaviour
{
    public GameObject[] lanes;
    public BackendSocket backend;
    public string uid;   
    public Road road;
    private Color normal_color;
    private Color highlight_color;

    private Theme theme;

    void Start()
    {

        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;

        uid = gameObject.name.Replace("Road ", "");
        lanes = new GameObject[transform.childCount];
        for (int i = 0; i < transform.childCount; i++)
        {
            lanes[i] = transform.GetChild(i).gameObject;
            if(road.road_look.name.Contains("dirt"))
                lanes[i].GetComponent<Renderer>().material.color = theme.dirt;
            else
                lanes[i].GetComponent<Renderer>().material.color = theme.asphalt;
        }

        if(road.road_look.name.Contains("dirt"))
        {
            normal_color = theme.dirt;
        }
        else
        {
            normal_color = theme.asphalt;
        }

        highlight_color = normal_color; // Disable highlight for now...
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
    }

    void Update()
    {
        if (backend.world == null){
            return;
        }
        if (backend.world.route_information == null){
            return;
        }
        // Disable highlights for now...
        // foreach (RouteInformation information in backend.world.route_information)
        // {
        //     if (information.uids.Contains(uid))
        //     {
        //         int highlighted_lane = information.lane_index;
        //         int left_lanes = road.road_look.lanes_left.Length;
        //         if(highlighted_lane < left_lanes)
        //         { // Highlight all indeces until left_lanes (all the lanes on the left)
        //             for (int i = 0; i < left_lanes; i++)
        //             {
        //                 lanes[i].GetComponent<Renderer>().material.color = highlight_color;
        //             }
        //             for (int i = left_lanes; i < lanes.Length; i++)
        //             {
        //                 lanes[i].GetComponent<Renderer>().material.color = normal_color;
        //             }
        //         }
        //         else
        //         { // Highlight all indeces after left_lanes (all the lanes on the right)
        //             for (int i = left_lanes; i < lanes.Length; i++)
        //             {
        //                 lanes[i].GetComponent<Renderer>().material.color = highlight_color;
        //             }
        //             for (int i = 0; i < left_lanes; i++)
        //             {
        //                 lanes[i].GetComponent<Renderer>().material.color = normal_color;
        //             }
        //         }
        //     }
        // }
    }

}