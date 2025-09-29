using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;

public class SignBuilder : MonoBehaviour
{
    private List<string> instantiated_signs = new List<string>();
    private BackendWebrequests backend;
    private Mesh cube;
    public Material material;
    [Header("General Prefabs")]
    public GameObject lampPrefab;
    public GameObject speedLimitPrefab;
    public GameObject giveWayPrefab;
    public GameObject noEntryPrefab;
    public GameObject goLeftHere;
    public GameObject goRightHere;
    public GameObject goAhead;
    public GameObject passBoth;
    public GameObject goLeft;
    public GameObject goRight;
    public GameObject speedCamera;
    [Header("Text Prefabs")]
    public GameObject oneLine;
    public GameObject twoLines;
    Theme theme;

    void Start()
    {
        backend = GameObject.Find("Map Data").GetComponent<BackendWebrequests>();
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
        GameObject cube_object = GameObject.CreatePrimitive(PrimitiveType.Cube);
        cube = cube_object.GetComponent<MeshFilter>().sharedMesh;
        cube_object.SetActive(false);
    }

    GameObject InstantiatePrefab(GameObject prefab, Vector3 position, Quaternion rotation, Vector3 scale, string name)
    {
        GameObject obj = Instantiate(prefab, position, rotation);
        obj.transform.localScale = scale;
        obj.AddComponent<StaticObject>();
        obj.GetComponent<StaticObject>().position = position;
        obj.transform.parent = transform;
        obj.name = name;
        return obj;
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
        if (backend.map.signs == null)
        {
            return;
        }
        if (backend.signs_count > 0)
        {
            List<string> signs_to_not_remove = new List<string>();

            foreach (Sign sign in backend.map.signs)
            {
                signs_to_not_remove.Add(sign.uid);
                if (instantiated_signs.Contains(sign.uid))
                {
                    continue;
                }

                if (sign.action == "lamp" && lampPrefab != null)
                {
                    GameObject lamp_object = InstantiatePrefab(lampPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), Vector3.one, "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "speed_limit" && speedLimitPrefab != null)
                {
                    GameObject speed_limit_object = InstantiatePrefab(speedLimitPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    speed_limit_object.GetComponentInChildren<TMP_Text>().text = sign.action_data.ToString();
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "give_way" && giveWayPrefab != null)
                {
                    GameObject give_way_object = InstantiatePrefab(giveWayPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "speedcamera" && speedCamera != null)
                {
                    GameObject speed_camera_object = InstantiatePrefab(speedCamera, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.description.name.ToLower().Contains("no entry") && noEntryPrefab != null)
                {
                    GameObject no_entry_object = InstantiatePrefab(noEntryPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.description.name.ToLower().Contains("go left here") && goLeftHere != null)
                {
                    GameObject go_left_object = InstantiatePrefab(goLeftHere, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.description.name.ToLower().Contains("go right here") && goRightHere != null)
                {
                    GameObject go_right_object = InstantiatePrefab(goRightHere, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.description.name.ToLower().Contains("go ahead") && goAhead != null)
                {
                    GameObject go_ahead_object = InstantiatePrefab(goAhead, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.description.name.ToLower().Contains("pass both") && passBoth != null)
                {
                    GameObject pass_both_object = InstantiatePrefab(passBoth, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.description.name.ToLower().Contains("go left") && goLeft != null)
                {
                    GameObject go_left_object = InstantiatePrefab(goLeft, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.description.name.ToLower().Contains("go right") && goRight != null)
                {
                    GameObject go_right_object = InstantiatePrefab(goRight, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                // Filter out any text_items that aren't "real" text
                bool is_valid_text(string text)
                {
                    if (string.IsNullOrWhiteSpace(text)) { return false; }
                    if (text.Contains("/")) { return false; }
                    if (text.Contains("\\")) { return false; }
                    if (text.Contains(".")) { return false; }
                    return true;
                }
                sign.text_items = sign.text_items.Where(text => is_valid_text(text)).ToArray();

                if (sign.action == "general" && sign.text_items != null && sign.text_items.Length == 1 && oneLine != null)
                {
                    GameObject text_object = InstantiatePrefab(oneLine, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    text_object.GetComponentInChildren<TMP_Text>().text = sign.text_items[0];
                    instantiated_signs.Add(sign.uid);
                    continue;
                }

                if (sign.action == "general" && sign.text_items != null && sign.text_items.Length == 2 && twoLines != null)
                {
                    GameObject text_object = InstantiatePrefab(twoLines, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
                    TMP_Text[] texts = text_object.GetComponentsInChildren<TMP_Text>();
                    texts[0].text = sign.text_items[0];
                    texts[1].text = sign.text_items[1];

                    instantiated_signs.Add(sign.uid);
                    continue;
                }
            }

            List<string> signs_to_remove = new List<string>();

            foreach (string sign in instantiated_signs)
            {
                if (!signs_to_not_remove.Contains(sign))
                {
                    signs_to_remove.Add(sign);
                }
            }

            foreach (string sign in signs_to_remove)
            {
                Destroy(GameObject.Find("Sign " + sign));
                instantiated_signs.Remove(sign);
            }
        } 
        else
        {
            foreach (string sign in instantiated_signs)
            {
                Destroy(GameObject.Find("Sign " + sign));
            }
        }
    }
}