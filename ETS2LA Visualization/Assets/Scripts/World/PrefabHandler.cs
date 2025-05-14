using System.Linq;
using UnityEngine;

public class PrefabHandler : MonoBehaviour
{
    public GameObject[] lanes;
    public BackendSocket backend;
    public string uid;

    void Start()
    {
        uid = gameObject.name.Replace("Prefab ", "");
        lanes = new GameObject[transform.childCount];
        for (int i = 0; i < transform.childCount; i++)
        {
            lanes[i] = transform.GetChild(i).gameObject;
            lanes[i].GetComponent<Renderer>().material.color = new Color(0.04f, 0.04f, 0.04f);
        }

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
        // 
        //         if(lanes.Length == 0)
        //         {
        //             return;
        //         }
        // 
        //         int highlighted_lane = information.lane_index;
        //         for (int i = 0; i < lanes.Length; i++)
        //         {
        //             if (i == highlighted_lane)
        //             {
        //                 lanes[i].GetComponent<Renderer>().material.color = new Color(0.04f, 0.05f, 0.076f);
        //                 lanes[i].transform.localPosition = new Vector3(0, 0.05f, 0);
        //             }
        //             else
        //             {
        //                 lanes[i].GetComponent<Renderer>().material.color = new Color(0.04f, 0.04f, 0.042f);
        //                 lanes[i].transform.localPosition = new Vector3(0, 0, 0);;
        //             }
        //         }
        //     }
        // }
    }

}