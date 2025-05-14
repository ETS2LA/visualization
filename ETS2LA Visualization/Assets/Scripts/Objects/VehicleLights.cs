using UnityEngine;

public class VehicleLights : MonoBehaviour
{

    public GameObject[] lights;
    public GameObject[] brakeLights;

    public float lightIntensity = 0f;
    public bool isBraking = false;

    void Update()
    {
        for(int i = 0; i < lights.Length; i++)
        {
            GameObject light = lights[i];
            Material material = light.GetComponent<MeshRenderer>().material;
            if(lightIntensity > 0)
            {
                material.EnableKeyword("_EMISSION");
                if(light.name.Contains("rear"))
                {
                    material.color = new Color(1f, 0, 0, 1f);
                    material.SetColor("_EmissionColor", new Vector4(lightIntensity * 1f,0,0, 1));
                }
                else
                {
                    material.color = new Color(0.5f, 0.5f, 0.5f, 1);
                    material.SetColor("_EmissionColor", new Vector4(lightIntensity * 10f, lightIntensity * 10f, lightIntensity * 10f, 1));
                }
            }
            else
            {
                material.color = new Color(0, 0, 0, 0);
                material.DisableKeyword("_EMISSION");
            }
        }

        for(int i = 0; i < brakeLights.Length; i++)
        {
            GameObject light = brakeLights[i];
            Material material = light.GetComponent<MeshRenderer>().material;
            if (isBraking)
            {
                material.EnableKeyword("_EMISSION");
                if (light.name.Contains("rear"))
                {
                    material.color = new Color(0.5f, 0, 0, 1);
                    material.SetColor("_EmissionColor", new Vector4(10, 0, 0, 1));
                }
                else
                {
                    material.color = new Color(0.5f, 0.5f, 0.5f, 1);
                    material.SetColor("_EmissionColor", new Vector4(10, 10, 10, 1));
                }
            }
            else
            {
                material.color = new Color(0, 0, 0, 0);
                material.DisableKeyword("_EMISSION");
            }
        }
    }
}
