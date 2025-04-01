using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System;
using Baracuda.Monitoring;
using System.Collections.Generic;

public class BackendWebrequests : MonitoredBehaviour
{

    [System.Serializable]
    public class MapData
    {
        public Prefab[] prefabs;
        public Road[] roads;
        public Model[] models;
    }

    [System.Serializable]
    public class TagRequest
    {
        public string tag;
        public bool zlib = false;
    }

    [HideInInspector] public MapData map;
    [Monitor] public int roads_count = 0;
    [Monitor] public int prefabs_count = 0;
    [Monitor] public int models_count = 0;
    [Monitor] private float next_check = 0;
    private string last_update_time = "";
    private string current_update_time = "";

    public string ip_address = "localhost";

    IEnumerator CheckForUpdate()
    {
        yield return StartCoroutine(GetTagData($"http://{ip_address}:37520/api/tags/data", "map_update_time"));
        if (current_update_time != last_update_time)
        {
            last_update_time = current_update_time;
            yield return StartCoroutine(GetTagData($"http://{ip_address}:37520/api/tags/data", "map"));
        }
    }

    IEnumerator GetTagData(string uri, string tag)
    {
        TagRequest request = new TagRequest();
        request.tag = tag;
        using (UnityWebRequest www = UnityWebRequest.Post(uri, JsonUtility.ToJson(request), "application/json"))
        {
            www.timeout = 1;
            yield return www.SendWebRequest();

            if (www.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError(www.error);
            }
            else
            {
                if(tag == "map")
                {
                    string json = www.downloadHandler.text;
                    map = JsonUtility.FromJson<MapData>(json);

                    if(map.roads != null)
                    {
                        roads_count = map.roads.Length;
                        prefabs_count = map.prefabs.Length;
                        models_count = map.models.Length;
                        Debug.Log("Map data updated!");

                        List<string> lane_types = new List<string>();
                        foreach (Road road in map.roads)
                        {
                            foreach (string type in new string[] { "lanes_left", "lanes_right" })
                            {
                                foreach (string lane in road.road_look.GetType().GetField(type).GetValue(road.road_look) as string[])
                                {
                                    if (!lane_types.Contains(lane))
                                    {
                                        lane_types.Add(lane);
                                    }
                                }
                            }
                        }
                    }
                }
                else if(tag == "map_update_time")
                {
                    current_update_time = www.downloadHandler.text;
                }
            }
        }
    }

    void Update()
    {
        if(next_check < 0)
        {
            StartCoroutine(CheckForUpdate());
            next_check = 5;
        } 
        else
        {
            next_check -= Time.deltaTime;
        }
    }
}
