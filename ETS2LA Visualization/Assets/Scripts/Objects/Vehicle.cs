using UnityEngine;
using DG.Tweening;
using System.Linq;

public class Vehicle : MonoBehaviour
{
    public GameObject[] trailers;
    public BackendSocket backend;
    public TrafficBuilder trafficBuilder;
    public int uid;
    private string type = "car";

    public GameObject car;
    public GameObject van;
    public GameObject bus;
    public GameObject truck;

    public VehicleLights lights;

    void Start()
    {
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
        trafficBuilder = GameObject.Find("Traffic").GetComponent<TrafficBuilder>();
    }

    void EnableChild(int index)
    {
        for (int i = 0; i < 5; i++)
        {
            transform.GetChild(i).gameObject.SetActive(i == index);
            if(i == index)
            {
                lights = transform.GetChild(i).GetComponent<VehicleLights>();
            }
        }
    }

    void ColorChild(int index, Color color)
    {
        GameObject child = transform.GetChild(index).gameObject;
        if (child.GetComponent<MeshRenderer>() == null)
        {
            child = child.transform.GetChild(0).gameObject;
        }
        Material material = child.GetComponent<MeshRenderer>().material;
        material.color = color;
    }

    float GetLightState(int time)
    {
        int hour = Mathf.FloorToInt(time / 60) % 24;

        if (hour >= 19)
            return 1f;

        if (hour < 7)
            return 1f;

        return 0f;
    }

    void Update()
    {
        if (backend.world == null)
        {
            return;
        }
        if (backend.world.traffic == null)
        {
            return;
        }
        if (backend.truck == null) { return; }
        if (backend.truck.state == null) { return; }

        float brightness = GetLightState(backend.truck.state.time);

        int[] uids = new int[backend.world.traffic.Length];
        for (int i = 0; i < backend.world.traffic.Length; i++)
        {
            uids[i] = backend.world.traffic[i].id;
        }

        if (!System.Array.Exists(uids, element => element == uid))
        {
            trafficBuilder.RemoveVehicle(uid);
            return;
        }

        VehicleClass self = backend.world.traffic[System.Array.FindIndex(uids, element => element == uid)];
        int trailer_count = self.trailer_count;

        if(trailer_count != 0 && self.size.height > 2)
        {
            type = "truck";
        }
        else if (self.size.length > 8)
        {
            type = "bus";
        }
        else if (self.size.height > 1.8)
        {
            type = "van";
        }
        else
        {
            type = "car";
        }

        Vector3 target_position = new Vector3(self.position.z - backend.truck.transform.sector_y, self.position.y + self.size.height / 2, self.position.x - backend.truck.transform.sector_x);
        Vector3 truck_position = new Vector3(backend.truck.transform.z - backend.truck.transform.sector_y, backend.truck.transform.y, backend.truck.transform.x - backend.truck.transform.sector_x);
        if(Vector3.Distance(transform.position, target_position) > 5f)
        {
            transform.position = target_position;
            transform.DOKill();
        }
        else
        {
            transform.DOMove(target_position, 0.25f).SetLink(gameObject);
        }
        
        transform.DORotate(new Vector3(self.rotation.pitch, -self.rotation.yaw + 90, -self.rotation.roll), 0.25f).SetLink(gameObject);
        transform.localScale = new Vector3(self.size.width, self.size.height, self.size.length);

        for(int i = 0; i < 2; i++)
        {
            if (i >= trailer_count)
            {
                trailers[i].SetActive(false);
                continue;
            }

            trailers[i].SetActive(true);
            trailers[i].GetComponent<Trailer>().uid = uid;
            trailers[i].GetComponent<Trailer>().backend = backend;

            if(type == "car")
            {
                trailers[i].transform.GetChild(0).gameObject.SetActive(false); // user_trailer
                trailers[i].transform.GetChild(1).gameObject.SetActive(true);  // traffic_caravan
                trailers[i].transform.GetChild(1).GetComponent<VehicleLights>().isBraking = self.acceleration < -1 || self.speed < 0.1;
                trailers[i].transform.GetChild(1).GetComponent<VehicleLights>().lightIntensity = brightness;
            }
            else
            {
                trailers[i].transform.GetChild(0).gameObject.SetActive(true); // user_trailer
                trailers[i].transform.GetChild(0).GetComponent<VehicleLights>().isBraking = self.acceleration < -1 || self.speed < 0.1;
                trailers[i].transform.GetChild(0).GetComponent<VehicleLights>().lightIntensity = brightness;
                trailers[i].transform.GetChild(1).gameObject.SetActive(false);  // traffic_caravan
            }

            Vector3 target_trailer_position = new Vector3(self.trailers[i].position.z - backend.truck.transform.sector_y, self.trailers[i].position.y + self.trailers[i].size.height / 2, self.trailers[i].position.x - backend.truck.transform.sector_x);
            if (Vector3.Distance(trailers[i].transform.position, target_trailer_position) > 5f)
            {
                trailers[i].transform.position = target_trailer_position;
                trailers[i].transform.DOKill();
            }
            else
            {
                trailers[i].transform.DOMove(target_trailer_position, 0.25f).SetLink(gameObject);
            }
            trailers[i].transform.DORotate(new Vector3(self.trailers[i].rotation.pitch, -self.trailers[i].rotation.yaw + 90, -self.trailers[i].rotation.roll), 0.25f).SetLink(gameObject);
            trailers[i].transform.localScale = new Vector3(self.trailers[i].size.width, self.trailers[i].size.height, self.trailers[i].size.length);
        }

        float distance = Vector3.Distance(truck_position, target_position);

        if (self.is_tmp == true)
        {
            // TMP doesn't have vans
            if(type == "van") type = "truck";
        }

        if (self.is_tmp == true && self.is_trailer == true)
        {
            // TMP sends a trailer flag instead of trailers
            // behind trucks.
            type = "trailer";
        }

        switch (type)
        {
            case "car":
                EnableChild(0);
                if(backend.world.highlights != null && backend.world.highlights.vehicles.Contains(uid) && distance < 100)
                    ColorChild(0, new Color(0.3f, 0.7f, 0.8f));
                else
                    ColorChild(0, new Color(0.5f, 0.5f, 0.5f));

                break;
            case "van":
                EnableChild(1);
                if(backend.world.highlights != null && backend.world.highlights.vehicles.Contains(uid) && distance < 100)
                    ColorChild(1, new Color(0.3f, 0.7f, 0.8f));
                else
                    ColorChild(1, new Color(0.5f, 0.5f, 0.5f));

                break;
            case "bus":
                EnableChild(2);
                if(backend.world.highlights != null && backend.world.highlights.vehicles.Contains(uid) && distance < 100)
                    ColorChild(2, new Color(0.3f, 0.7f, 0.8f));
                else
                    ColorChild(2, new Color(0.5f, 0.5f, 0.5f));

                break;
            case "truck":
                EnableChild(3);
                if(backend.world.highlights != null && backend.world.highlights.vehicles.Contains(uid) && distance < 100)
                    ColorChild(3, new Color(0.3f, 0.7f, 0.8f));
                else
                    ColorChild(3, new Color(0.5f, 0.5f, 0.5f));

                break;
            case "trailer":
                EnableChild(4);
                if(backend.world.highlights != null && backend.world.highlights.vehicles.Contains(uid) && distance < 100)
                    ColorChild(4, new Color(0.3f, 0.7f, 0.8f));
                else
                    ColorChild(4, new Color(0.5f, 0.5f, 0.5f));

                break;
        }

        lights.isBraking = self.acceleration < -1 || self.speed < 0.1;
        lights.lightIntensity = brightness;
    }
}