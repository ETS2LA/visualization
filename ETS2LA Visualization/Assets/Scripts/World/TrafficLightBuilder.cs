using System.Collections.Generic;
using UnityEngine;

public class TrafficLightBuilder : MonoBehaviour
{

    public List<GameObject> traffic_lights = new List<GameObject>();
    public GameObject traffic_light_prefab;
    public BackendSocket backend;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
    }

    void Update()
    {
        if (backend.world == null)
        {
            return;
        }
        if (backend.world.traffic_lights == null)
        {
            return;
        }
        if (backend.world.traffic_lights.Length > 0)
        {
            string[] traffic_light_names = new string[backend.world.traffic_lights.Length];
            for(int i = 0; i < backend.world.traffic_lights.Length; i++)
            {
                traffic_light_names[i] = "Traffic Light " + backend.world.traffic_lights[i].uid;

                TrafficLight traffic_light = backend.world.traffic_lights[i];
                if(traffic_lights.Exists(traffic_light_object => traffic_light_object.name == "Traffic Light " + traffic_light.uid))
                {
                    GameObject light = traffic_lights.Find(traffic_light_object => traffic_light_object.name == "Traffic Light " + traffic_light.uid);
                    string state = traffic_light.state_text;
                    switch (state)
                    {
                        case "Red":
                            light.transform.GetChild(0).gameObject.SetActive(true);
                            light.transform.GetChild(1).gameObject.SetActive(false);
                            light.transform.GetChild(2).gameObject.SetActive(false);
                            break;
                        case "Yellow":
                            light.transform.GetChild(0).gameObject.SetActive(false);
                            light.transform.GetChild(1).gameObject.SetActive(true);
                            light.transform.GetChild(2).gameObject.SetActive(false);
                            break;
                        case "Green":
                            light.transform.GetChild(0).gameObject.SetActive(false);
                            light.transform.GetChild(1).gameObject.SetActive(false);
                            light.transform.GetChild(2).gameObject.SetActive(true);
                            break;
                        default:
                            light.transform.GetChild(0).gameObject.SetActive(false);
                            light.transform.GetChild(1).gameObject.SetActive(false);
                            light.transform.GetChild(2).gameObject.SetActive(false);
                            break;
                    }
                    continue;
                }
                Vector3 position = new Vector3(
                    traffic_light.position.z + 512 * traffic_light.cy,
                    traffic_light.position.y, 
                    traffic_light.position.x + 512 * traffic_light.cx
                );
                GameObject traffic_light_object = Instantiate(traffic_light_prefab, position, Quaternion.Euler(traffic_light.rotation.pitch, -traffic_light.rotation.yaw - 90, traffic_light.rotation.roll));
                traffic_light_object.name = "Traffic Light " + traffic_light.uid;

                traffic_light_object.AddComponent<StaticObject>();
                traffic_light_object.GetComponent<StaticObject>().position = position;

                traffic_light_object.transform.parent = transform;

                traffic_lights.Add(traffic_light_object);
            }

            GameObject[] to_remove = new GameObject[traffic_lights.Count];
            foreach(GameObject traffic_light_object in traffic_lights)
            {
                if(!System.Array.Exists(traffic_light_names, traffic_light_name => traffic_light_name == traffic_light_object.name))
                {
                    to_remove[System.Array.IndexOf(traffic_lights.ToArray(), traffic_light_object)] = traffic_light_object;
                }
            }

            foreach(GameObject traffic_light_object in to_remove)
            {
                if(traffic_light_object != null)
                {
                    traffic_lights.Remove(traffic_light_object);
                    Destroy(traffic_light_object);
                }
            }

        }
    }
}
