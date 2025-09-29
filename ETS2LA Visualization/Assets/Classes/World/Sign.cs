using UnityEngine;

[System.Serializable]
public class SignDescription
{
    public string token;
    public string name;
    public string model_path;
    public string category;
}

[System.Serializable]
public class Sign
{
    public string uid;
    public int type;
    public float x;
    public float y;
    public int sector_x;
    public int sector_y;
    public float z;
    public float rotation;
    public string token;
    public string node_uid;
    public string[] text_items;
    public SignDescription description;
    public string action;
    public int action_data;
}