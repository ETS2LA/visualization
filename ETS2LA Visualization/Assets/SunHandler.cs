using UnityEngine;

public class SunHandler : MonoBehaviour
{
    public BackendSocket backend;
    
    void Start()
    {
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
    }

    float GetLightState(int time)
    {
        float hour = (time / 60f) % 24f;
        float transitionDuration = 2f;

        // Fade out: 19:00–21:00
        if (hour >= 19f && hour < 21f)
        {
            float t = (hour - 19f) / transitionDuration;
            return 1f + 0.5f * (1 + Mathf.Cos(t * Mathf.PI));
        }

        // Fade in: 6:00–8:00
        if (hour >= 6f && hour < 8f)
        {
            float t = (hour - 6f) / transitionDuration;
            return 2f - 0.5f * (1 - Mathf.Cos(t * Mathf.PI));
        }

        if (hour >= 21f || hour < 8f)
            return 1f;

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
        Color color = new Color((10 + intensity * 7) / 255f, (10 + intensity * 7) / 255f, (10 + intensity * 7) / 255f);
        Camera main = Camera.main;
        main.backgroundColor = color;
        RenderSettings.fogColor = color;
    }
}
