using UnityEngine;

[System.Serializable]
public class Elevation
{
    public int x;
    public int y;
    public int z;

    public void FixCoordinates()
    {
        // Unity is a bit different, so we need to swap x and z
        int temp_x = x;
        x = z;
        z = temp_x;
    }
}