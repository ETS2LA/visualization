using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class ModelBuilder : MonoBehaviour
{
    private List<string> instantiated_models = new List<string>();
    private BackendWebrequests backend;
    public Material material;
    private Mesh cube;

    Theme theme;

    void Start()
    {
        backend = GameObject.Find("Map Data").GetComponent<BackendWebrequests>();
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
        GameObject cube_object = GameObject.CreatePrimitive(PrimitiveType.Cube);
        cube = cube_object.GetComponent<MeshFilter>().sharedMesh;
        cube_object.SetActive(false);
    }

    void Update()
    {
        if (backend == null)
        {
            return;
        }
        if (backend.map == null)
        {
            return;
        }
        if (backend.map.models == null)
        {
            return;
        }
        if (backend.models_count > 0)
        {
            List<string> models_to_not_remove = new List<string>();

            foreach (Model model in backend.map.models)
            {
                models_to_not_remove.Add(model.uid);
                if (instantiated_models.Contains(model.uid))
                {
                    continue;
                }

                GameObject model_object = new GameObject("Model " + model.uid);
                model_object.AddComponent<MeshFilter>();
                model_object.AddComponent<MeshRenderer>();
                model_object.GetComponent<MeshFilter>().mesh = cube;
                model_object.GetComponent<MeshRenderer>().material = material; 
                model_object.GetComponent<MeshRenderer>().material.color = theme.buildings;

                model_object.transform.position = new Vector3(model.z, model.y + (model.description.height * model.scale.y) / 2, model.x);
                model_object.transform.localScale = new Vector3(model.description.length * model.scale.z, model.description.height * model.scale.y, model.description.width * model.scale.x);

                model_object.transform.rotation = Quaternion.Euler(0, Mathf.Rad2Deg * (float)(model.rotation - Math.PI / 2), 0);

                model_object.AddComponent<StaticObject>();
                model_object.GetComponent<StaticObject>().position = model_object.transform.position;
                
                instantiated_models.Add(model.uid);
                model_object.transform.parent = transform;
            }

            List<string> models_to_remove = new List<string>();

            foreach (string model in instantiated_models)
            {
                if (!models_to_not_remove.Contains(model))
                {
                    models_to_remove.Add(model);
                }
            }

            foreach (string model in models_to_remove)
            {
                Destroy(GameObject.Find("Model " + model));
                instantiated_models.Remove(model);
            }
        } 
        else
        {
            foreach (string model in instantiated_models)
            {
                Destroy(GameObject.Find("Model " + model));
            }
        }
    }
}