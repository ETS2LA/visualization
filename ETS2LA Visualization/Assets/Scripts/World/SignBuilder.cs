using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;

public class SignBuilder : MonoBehaviour
{
    private Dictionary<string, GameObject> instantiated_signs = new Dictionary<string, GameObject>();
    private int lastSignsCount = 0;
    private BackendWebrequests backend;

    [Header("Direction Prefabs")]
    public GameObject goLeftHere;
    public GameObject goRightHere;
    public GameObject goAhead;
    public GameObject passBoth;
    public GameObject goLeft;
    public GameObject goRight;
    [Header("General Prefabs")]
    public GameObject stopSign;
    public GameObject lampPrefab;
    public GameObject speedLimitPrefab;
    public GameObject noLimitsPrefab;
    public GameObject giveWayPrefab;
    public GameObject mainRoadPrefab;
    public GameObject noEntryPrefab;
    public GameObject speedCamera;
    public GameObject reflectivePost;
    [Header("Text Prefabs")]
    public GameObject oneLine;
    public GameObject twoLines;
    Theme theme;

    void Start()
    {
        backend = GameObject.Find("Map Data").GetComponent<BackendWebrequests>();
        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;
    }

    void SetCulling(GameObject gameObject)
    {
        gameObject.layer = LayerMask.NameToLayer("CullCloser");
        // Set the layer of all child objects too
        foreach (Transform child in gameObject.transform)
        {
            SetCulling(child.gameObject);
        }
    }

    GameObject InstantiatePrefab(GameObject prefab, Vector3 position, Quaternion rotation, Vector3 scale, string name)
    {
        GameObject obj = Instantiate(prefab, position, rotation);
        SetCulling(obj);
        obj.transform.localScale = scale;
        obj.AddComponent<StaticObject>();
        obj.GetComponent<StaticObject>().position = position;
        obj.transform.parent = transform;
        obj.name = name;
        return obj;
    }

    GameObject CreateSignObject(Sign sign)
    {
        if (sign.action == "lamp" && lampPrefab != null)
        {
            GameObject lamp_object = InstantiatePrefab(lampPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), Vector3.one, "Sign " + sign.uid);
            return lamp_object;
        }

        if (sign.action == "speed_limit" && speedLimitPrefab != null)
        {
            GameObject speed_limit_object = InstantiatePrefab(speedLimitPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            speed_limit_object.GetComponentInChildren<TMP_Text>().text = sign.action_data.ToString();
            return speed_limit_object;
        }

        if (sign.action == "give_way" && giveWayPrefab != null)
        {
            GameObject give_way_object = InstantiatePrefab(giveWayPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return give_way_object;
        }

        if (sign.action == "speedcamera" && speedCamera != null)
        {
            GameObject speed_camera_object = InstantiatePrefab(speedCamera, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return speed_camera_object;
        }

        if (sign.action == "post" && reflectivePost != null)
        {
            GameObject reflective_post_object = InstantiatePrefab(reflectivePost, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return reflective_post_object;
        }

        if (sign.action == "stop" && stopSign != null)
        {
            GameObject stop_sign_object = InstantiatePrefab(stopSign, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return stop_sign_object;
        }

        if (sign.action == "general" && sign.description.name.ToLower().Contains("no limits") && noLimitsPrefab != null)
        {
            GameObject no_limits_object = InstantiatePrefab(noLimitsPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return no_limits_object;
        }

        if (sign.action == "general" && sign.description.name.ToLower().Contains("no entry") && noEntryPrefab != null)
        {
            GameObject no_entry_object = InstantiatePrefab(noEntryPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return no_entry_object;
        }

        if (sign.action == "general" && (sign.description.name.ToLower().Contains("go left here") || sign.description.name.ToLower().Contains("pass left")) && goLeftHere != null)
        {
            GameObject go_left_object = InstantiatePrefab(goLeftHere, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return go_left_object;
        }

        if (sign.action == "general" && (sign.description.name.ToLower().Contains("go right here") || sign.description.name.ToLower().Contains("pass right")) && goRightHere != null)
        {
            GameObject go_right_object = InstantiatePrefab(goRightHere, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return go_right_object;
        }

        if (sign.action == "general" && sign.description.name.ToLower().Contains("go ahead") && goAhead != null)
        {
            GameObject go_ahead_object = InstantiatePrefab(goAhead, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return go_ahead_object;
        }

        if (sign.action == "general" && sign.description.name.ToLower().Contains("pass both") && passBoth != null)
        {
            GameObject pass_both_object = InstantiatePrefab(passBoth, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return pass_both_object;
        }

        if (sign.action == "general" && sign.description.name.ToLower().Contains("go left") && goLeft != null)
        {
            GameObject go_left_object = InstantiatePrefab(goLeft, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return go_left_object;
        }

        if (sign.action == "general" && sign.description.name.ToLower().Contains("go right") && goRight != null)
        {
            GameObject go_right_object = InstantiatePrefab(goRight, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return go_right_object;
        }

        if (sign.action == "general" && sign.description.name.ToLower().Contains("main road") && mainRoadPrefab != null)
        {
            GameObject main_road_object = InstantiatePrefab(mainRoadPrefab, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            return main_road_object;
        }

        // Filter out any text_items that aren't "real" text
        bool is_valid_text(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) { return false; }
            if (text.StartsWith("/")) { return false; }
            if (text.Contains("\\")) { return false; }
            if (text.StartsWith("https")) { return false; }
            return true;
        }
        sign.text_items = sign.text_items.Where(text => is_valid_text(text)).ToArray();

        // Filter out anything between <font ...>
        for (int i = 0; i < sign.text_items.Length; i++)
        {
            if (sign.text_items[i].StartsWith("<font"))
            {
                sign.text_items[i] = sign.text_items[i].Substring(sign.text_items[i].IndexOf('>') + 1);
            }
            if (sign.text_items[i].Contains("</font>"))
            {
                sign.text_items[i] = sign.text_items[i].Replace("</font>", "");
            }
        }

        if (sign.action == "general" && sign.text_items != null && sign.text_items.Length == 1 && oneLine != null)
        {
            GameObject text_object = InstantiatePrefab(oneLine, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            text_object.GetComponentInChildren<TMP_Text>().text = sign.text_items[0];

            return text_object;
        }

        if (sign.action == "general" && sign.text_items != null && sign.text_items.Length == 2 && twoLines != null)
        {
            GameObject text_object = InstantiatePrefab(twoLines, new Vector3(sign.z, sign.y, sign.x), Quaternion.Euler(0, Mathf.Rad2Deg * (float)(sign.rotation), 0), new Vector3(0.65f, 0.65f, 0.65f), "Sign " + sign.uid);
            TMP_Text[] texts = text_object.GetComponentsInChildren<TMP_Text>();
            texts[0].text = sign.text_items[0];
            texts[1].text = sign.text_items[1];

            return text_object;
        }

        return null;
    }

    void UpdateSigns()
    {
        var currentSignUIDs = new HashSet<string>();
        foreach (Sign sign in backend.map.signs)
        {
            currentSignUIDs.Add(sign.uid);
            if (instantiated_signs.ContainsKey(sign.uid))
                continue;

            GameObject signObj = CreateSignObject(sign);
            if (signObj != null)
                instantiated_signs[sign.uid] = signObj;
        }

        // Remove signs that no longer exist
        var toRemove = instantiated_signs.Keys.Where(uid => !currentSignUIDs.Contains(uid)).ToList();
        foreach (var uid in toRemove)
        {
            Destroy(instantiated_signs[uid]);
            instantiated_signs.Remove(uid);
        }
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
        if (backend.signs_count != lastSignsCount)
        {
            UpdateSigns();
            lastSignsCount = backend.signs_count;
        }
    }
}