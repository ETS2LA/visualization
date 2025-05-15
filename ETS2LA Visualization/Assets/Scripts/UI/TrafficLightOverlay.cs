using UnityEngine;
using DG.Tweening;
using System;
using TMPro;

public class TrafficLightOverlay : MonoBehaviour
{

    public TMP_Text time;
    public TMP_Text to;
    public TMP_Text current;
    public BackendSocket backend;
    public TrafficLightBuilder traffic_light_builder;
    public int target_index;
    private Camera main_cam;

    Theme theme;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        transform.GetChild(0).gameObject.SetActive(false);
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
        traffic_light_builder = GameObject.Find("TrafficLights").GetComponent<TrafficLightBuilder>();
        main_cam = Camera.main;
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
    }

    Color state_text_to_color(string text)
    {
        switch (text)
        {
            case "Red":
                return new Color(255/255, 209/255, 117/255);
            case "Yellow":
                return new Color(255/255, 255/255, 117/255);
            case "Green":
                return new Color(47/255, 255/255, 117/255);
            default:
                return theme.text;
        }
    }

    // Update is called once per frame
    void Update()
    {
        if (backend.world == null)
        {
            transform.GetChild(0).gameObject.SetActive(false);
            return;
        }
        if (backend.world.traffic == null)
        {
            transform.GetChild(0).gameObject.SetActive(false);
            return;
        }

        Vector3 target_position = new Vector3(
            traffic_light_builder.traffic_lights[target_index].transform.position.x, 
            traffic_light_builder.traffic_lights[target_index].transform.position.y, 
            traffic_light_builder.traffic_lights[target_index].transform.position.z
        );

        float distance = Vector3.Distance(main_cam.transform.position, target_position);

        if(distance > 75)
        {
            transform.GetChild(0).gameObject.SetActive(false);
            return;
        }
        else
        {
            transform.GetChild(0).gameObject.SetActive(true);
        }

        string uid = traffic_light_builder.traffic_lights[target_index].gameObject.name.Replace("Traffic Light ", "");
        TrafficLight traffic_light;

        try
        {
            traffic_light = backend.world.traffic_lights[Array.FindIndex(backend.world.traffic_lights, x => x.uid == uid)];
        }
        catch
        {
            transform.GetChild(0).gameObject.SetActive(false);
            return;
        }

        float time_left = MathF.Round(traffic_light.time_left, 1);
        string state_text = traffic_light.state_text;
        int state = traffic_light.state;

        string next_state_text = "";
        switch (state)
        {
            case 0: // OFF
                next_state_text = "Off";
                break;
            case 1: // ORANGE_TO_RED
                next_state_text = "Red";
                break;
            case 2: // RED
                next_state_text = "Yellow";
                break;
            case 4: // ORANGE_TO_GREEN
                next_state_text = "Green";
                break;
            case 8: // GREEN
                next_state_text = "Yellow";
                break;
            case 32: // SLEEP
                next_state_text = "Disabled";
                break;
        }

        Color current_color = state_text_to_color(state_text);
        Color next_color = state_text_to_color(next_state_text);

        string time_text = time_left.ToString();
        if (time_left % 1 == 0)
        {
            time_text += ".0";
        }
        time_text += "s";

        time.text = time_text;
        time.color = theme.text;

        to.text = "> " + next_state_text.ToUpper();
        to.color = next_color;
        
        current.text = state_text.ToUpper();
        current.color = current_color;

        Vector3 screen_target = Camera.main.WorldToScreenPoint(target_position);
        float screen_distance = Vector3.Distance(main_cam.transform.position, target_position);
        
        // Scale is 0.8 at 30m distance
        float scale = 0.8f / (distance / 30);

        if (screen_target.z < 0)
        {
            transform.GetChild(0).gameObject.SetActive(false);
            return;
        }
        
        if (screen_distance > 25)
        {
            transform.position = screen_target;
            transform.localScale = new Vector3(scale, scale, scale);
            transform.DOKill();
        }
        else
        {
            transform.DOMove(Camera.main.WorldToScreenPoint(target_position), 0.2f);
            transform.DOScale(new Vector3(scale, scale, scale), 0.2f);
        }
    }
}
