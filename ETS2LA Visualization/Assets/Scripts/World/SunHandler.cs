using UnityEngine;

public class SunHandler : MonoBehaviour
{
    public BackendSocket backend;
    
    Theme theme;
    void Start()
    {
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
    }

    float GetLightState(int time)
    {
        float hour = (time / 60f) % 24f;
        float transitionDuration = 2f;
    
        // Fade out: 19:00 - 21:00
        if (hour >= 19f && hour < 21f)
        {
            float t = (hour - 19f) / transitionDuration;
            return 2f - t;
        }
    
        // Fade in: 6:00 - 8:00
        if (hour >= 6f && hour < 8f)
        {
            float t = (hour - 6f) / transitionDuration;
            return 1f + t;
        }
    
        // Night time: 21:00 - 6:00
        if (hour >= 21f || hour < 6f)
            return 1f;
    
        // Day time: 8:00 - 19:00
        return 2f;
    }


    void Update()
    {
        if (backend.truck == null) { return; }
        if (backend.truck.state == null) { return; }
        float intensity = GetLightState(backend.truck.state.time);

        // Change the main light source intensity.
        Light light = GetComponent<Light>();
        light.intensity = intensity;

        // Update the background and fog to a
        // matching color.
        Color sky = new Color((theme.sky.r * 255f + intensity * 7) / 255f, (theme.sky.g * 255f + intensity * 7) / 255f, (theme.sky.b * 255f + intensity * 7) / 255f);
        Color fog = new Color((theme.fog.r * 255f + intensity * 7) / 255f, (theme.fog.g * 255f + intensity * 7) / 255f, (theme.fog.b * 255f + intensity * 7) / 255f);
        Camera main = Camera.main;
        main.backgroundColor = sky;
        RenderSettings.fogColor = fog;
    }
}
