using Unity.Mathematics;
using UnityEngine;
using System.Linq;
using TMPro;

public class TargetSpeed : MonoBehaviour
{
    private BackendSocket backend;
    private TMP_Text targetspeed;
    private TMP_Text set;

    void Start()
    {
        targetspeed = GetComponent<TMP_Text>();
        set = transform.GetChild(0).GetComponent<TMP_Text>();
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
    }

    // Update is called once per frame
    void Update()
    {
        if(backend.truck == null)
        {
            return;
        }
        if(backend.truck.state == null)
        {
            return;
        }

        float multiplier = 3.6f;
        if (backend.truck.state.game == "ATS")
        {
            multiplier = 2.23694f;
        }
        targetspeed.text = math.round(backend.truck.state.target_speed * multiplier).ToString();

        if (backend.world.status.enabled != null)
        {
            targetspeed.color = backend.world.status.enabled.Contains("AdaptiveCruiseControl") ? new Color(0, 170/255f, 200/255f, 1f) : new Color(1, 1, 1, 1);
            set.color = backend.world.status.enabled.Contains("AdaptiveCruiseControl") ? new Color(0, 170/255f, 200/255f, 1f) : new Color(0,0,0,0);
        }
    }
}
