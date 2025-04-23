using UnityEngine;
using Unity.Mathematics;
using TMPro;

public class SpeedLimit : MonoBehaviour
{
    private BackendSocket backend;
    private TMP_Text speedlimit_imperial;
    private TMP_Text speedlimit_metric;

    void Start()
    {
        speedlimit_imperial = transform.GetChild(0).GetChild(0).GetComponent<TMP_Text>();
        speedlimit_metric = transform.GetChild(1).GetChild(0).GetComponent<TMP_Text>();
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

        if(backend.truck.state.game == "ATS"){
            speedlimit_imperial.text = math.round(backend.truck.state.speed_limit * 2.23694f).ToString();

            speedlimit_imperial.transform.parent.gameObject.SetActive(true);
            speedlimit_metric.transform.parent.gameObject.SetActive(false);
        }
        else {
            speedlimit_metric.text = math.round(backend.truck.state.speed_limit * 3.6f).ToString();

            speedlimit_imperial.transform.parent.gameObject.SetActive(false);
            speedlimit_metric.transform.parent.gameObject.SetActive(true);
        }
    }
}
