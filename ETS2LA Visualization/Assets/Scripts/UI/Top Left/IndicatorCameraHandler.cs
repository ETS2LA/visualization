using DG.Tweening;
using UnityEngine.UI;
using UnityEngine;

public class IndicatorCameraHandler : MonoBehaviour
{

    public string side = "left";
    public GameObject indicatorCamera;
    private BackendSocket backend;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
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

        bool indicating = false;
        if(side == "left")
        {
            indicating = backend.truck.state.indicating_left;
        }
        else
        {
            indicating = backend.truck.state.indicating_right;
        }

        if(indicating)
        {
            indicatorCamera.SetActive(true);
            GetComponent<RawImage>().color = new Color(1, 1, 1, 1);
        }
        else
        {
            indicatorCamera.SetActive(false);
            GetComponent<RawImage>().color = new Color(1, 1, 1, 0);
        }
    }
}
