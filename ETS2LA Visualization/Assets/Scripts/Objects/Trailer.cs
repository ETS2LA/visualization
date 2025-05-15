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
            Material material = transform.GetChild(0).GetChild(0).GetComponent<MeshRenderer>().material;
            material.color = theme.highlightColor;
            material = transform.GetChild(1).GetChild(0).GetComponent<MeshRenderer>().material;
            material.color = theme.highlightColor;
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