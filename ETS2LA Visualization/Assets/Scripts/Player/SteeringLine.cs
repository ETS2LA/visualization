using System.Linq;
using UnityEngine;

public class SteeringLine : MonoBehaviour
{
    public BackendSocket backend;
    public GameObject truck;
    public Color enabled_color = new Color(0, 146/255f, 197/255f, 1f);
    public Color disabled_color = new Color(146/255f, 146/255f, 146/255f, 1f);
    public Vector3[] last_data = new Vector3[0];

    // Update is called once per frame
    void Update()
    {
        if (backend.truck == null)
        {
            return;
        }
        if (backend.truck.steering == null)
        {
            return;
        }
        LineRenderer lineRenderer = GetComponent<LineRenderer>();
        Material material = lineRenderer.material;

        if (backend.world.status.enabled != null)
        {
            material.SetColor("_base_color", backend.world.status.enabled.Contains("Map") ? enabled_color : disabled_color);
        }
        
        if(backend.truck.steering != last_data)
        {
            last_data = backend.truck.steering;
            lineRenderer.positionCount = last_data.Length;

            for (int i = 0; i < last_data.Length; i++)
            {
                lineRenderer.SetPosition(i, last_data[i] + Vector3.up * 0.2f);
            }

            if(last_data.Length == 0)
            {
                lineRenderer.positionCount = 0;
            }
        }
    }
}
