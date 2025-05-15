using UnityEngine;
using Unity.Mathematics;
using TMPro;

public class Speed : MonoBehaviour
{
    private BackendSocket backend;
    private TMP_Text speed;
    private TMP_Text unit;

    Theme theme;
    void Start()
    {
        speed = GetComponent<TMP_Text>();
        unit = transform.GetChild(0).GetComponent<TMP_Text>();
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

        if(backend.truck.state.game == "ATS"){
            speed.text = math.round(backend.truck.state.speed * 2.23694f).ToString();
            unit.text = "mph";
        }
        else {
            speed.text = math.round(backend.truck.state.speed * 3.6f).ToString();
            unit.text = "km/h";
        }

        speed.color = theme.text;
        unit.color = theme.text * 0.8f;
    }
}
