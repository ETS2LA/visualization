using UnityEngine;
using DG.Tweening;
using System.Linq;

public class Trailer : MonoBehaviour
{
    public int uid;
    public BackendSocket backend;

    Theme theme;

    void Start()
    {
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
    }

    void Update()
    {
        if(uid == 0)
        {
            return;
        }
        if(backend == null)
        {
            backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
        }
        if(backend.world != null && backend.world.highlights != null && backend.world.highlights.vehicles != null && backend.world.highlights.vehicles.Contains(uid))
        {
            Color color = backend.world.highlights.aeb ? theme.aebColor : theme.highlightColor;
            Material material = transform.GetChild(0).GetChild(0).GetComponent<MeshRenderer>().material;
            material.color = color;
            material = transform.GetChild(1).GetChild(0).GetComponent<MeshRenderer>().material;
            material.color = color;
        }    
        else
        {
            Material material = transform.GetChild(0).GetChild(0).GetComponent<MeshRenderer>().material;
            material.color = theme.baseColor;
            material = transform.GetChild(1).GetChild(0).GetComponent<MeshRenderer>().material;
            material.color = theme.baseColor;
        }
    }
}