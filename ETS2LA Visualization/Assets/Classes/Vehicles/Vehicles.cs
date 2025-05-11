using UnityEngine;

[System.Serializable]
public class GamePosition
{
    public float x;
    public float y;
    public float z;
}

[System.Serializable]
public class GameQuaternion
{
    public float x;
    public float y;
    public float z;
    public float w;
    public float yaw;
    public float pitch;
    public float roll;
}

[System.Serializable]
public class VehicleSize
{
    public float width;
    public float height;
    public float length;
}

[System.Serializable]
public class TrailerClass
{
    public GamePosition position;
    public GameQuaternion rotation;
    public VehicleSize size;
}

[System.Serializable]
public class VehicleClass
{
    public GamePosition position;
    public GameQuaternion rotation;
    public VehicleSize size;
    public float speed;
    public float acceleration;
    public int trailer_count;
    public int id;
    public TrailerClass[] trailers;
    public bool is_tmp;
    public bool is_trailer;
}