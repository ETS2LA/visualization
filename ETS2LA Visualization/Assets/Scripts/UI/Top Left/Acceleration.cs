using UnityEngine;
using UnityEngine.UI;
using DG.Tweening;
public class Acceleration : MonoBehaviour
{
    private BackendSocket backend;
    private Slider acceleration;

    Theme theme;
    void Start()
    {
        acceleration = GetComponent<Slider>();
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
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

        acceleration.DOValue(backend.truck.state.throttle, 0.2f);
        acceleration.transform.GetChild(1).GetChild(0).GetComponent<Image>().color = theme.text * 0.8f;
        acceleration.transform.GetChild(0).GetComponent<Image>().color = theme.secondaryBackground;
    }
}