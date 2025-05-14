using UnityEngine;

public enum RoadMarkingType
{
    NONE,
    SOLID,
    DASHED,
    DASHED_SHORT,
    DOUBLE
}

[System.Serializable]
public class Lane
{
    public Point[] points;
    public string side;
    public float length;

    public Mesh CreateMeshAlongPoints(float lane_width = 4.5f, float right_shoulder = 0, float left_shoulder = 0)
    {
        Mesh mesh = new Mesh();

        Vector3[] vertices = new Vector3[points.Length * 2];
        int[] triangles = new int[(points.Length - 1) * 6];
        Vector2[] uv = new Vector2[vertices.Length];
        Vector3[] normals = new Vector3[vertices.Length];
        Vector4[] tangents = new Vector4[vertices.Length];

        for (int i = 0; i < points.Length; i++)
        {
            Vector3 point = points[i].ToVector3();
            Vector3 direction;

            if (i < points.Length - 1)
            {
                direction = (points[i + 1].ToVector3() - point).normalized;
            }
            else
            {
                direction = (point - points[i - 1].ToVector3()).normalized;
            }

            Vector3 normal = Vector3.Cross(direction, Vector3.down).normalized;
            Vector3 tangent = direction;

            vertices[i * 2] = point + normal * (lane_width / 2 + right_shoulder);
            vertices[i * 2 + 1] = point - normal * (lane_width / 2 + left_shoulder);
            uv[i * 2] = new Vector2(0, (float)i / (points.Length - 1));
            uv[i * 2 + 1] = new Vector2(1, (float)i / (points.Length - 1));
            normals[i * 2] = normals[i * 2 + 1] = Vector3.up;
            tangents[i * 2] = tangents[i * 2 + 1] = new Vector4(tangent.x, tangent.y, tangent.z, 1);
        }

        for (int i = 0; i < points.Length - 1; i++)
        {
            triangles[i * 6] = i * 2;
            triangles[i * 6 + 1] = i * 2 + 1;
            triangles[i * 6 + 2] = i * 2 + 2;
            triangles[i * 6 + 3] = i * 2 + 1;
            triangles[i * 6 + 4] = i * 2 + 3;
            triangles[i * 6 + 5] = i * 2 + 2;
        }

        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.uv = uv;
        mesh.normals = normals;
        mesh.tangents = tangents;
        mesh.RecalculateBounds();
        mesh.RecalculateNormals();
        mesh.RecalculateTangents();
        return mesh;
    }

    public Mesh CreateMarkingMesh(Side side, RoadMarkingType type, float lane_width = 4.5f, float marking_width = 0.2f)
    {
        Mesh mesh = new Mesh();

        Vector3[] vertices = new Vector3[points.Length * 2];
        int[] triangles = new int[(points.Length - 1) * 6];
        Vector2[] uv = new Vector2[vertices.Length];
        Vector3[] normals = new Vector3[vertices.Length];
        Vector4[] tangents = new Vector4[vertices.Length];

        float offset = 0f;
        if (type == RoadMarkingType.DOUBLE)
        {
            offset = -marking_width / 2 - 0.075f; // Leave a small gap for double markings
        }
        else if (type == RoadMarkingType.DASHED || type == RoadMarkingType.DASHED_SHORT)
        {
            offset = marking_width / 2 / 2 - 0.01f; // Center the marking so the two roads together are the same width.
            marking_width /= 2; // Center the marking so the two roads together are the same width.
        }

        for (int i = 0; i < points.Length; i++)
        {
            Vector3 up = (side == Side.LEFT) ? Vector3.up : Vector3.down;

            Vector3 point = points[i].ToVector3() + Vector3.up * 0.05f; // Slightly above the road
            Vector3 direction;

            if (i < points.Length - 1)
            {
                direction = (points[i + 1].ToVector3() - point).normalized;
            }
            else
            {
                direction = (point - points[i - 1].ToVector3()).normalized;
            }

            Vector3 normal = Vector3.Cross(direction, up).normalized;

            // Determine the position of the marking based on the side
            float sideMultiplier = (side == Side.LEFT) ? -1f : 1f;
            Vector3 markingPosition = point + normal * (lane_width / 2 + offset);

            vertices[i * 2] = markingPosition + normal * (sideMultiplier * marking_width / 2);
            vertices[i * 2 + 1] = markingPosition - normal * (sideMultiplier * marking_width / 2);

            uv[i * 2] = new Vector2(0, (float)i / (points.Length - 1));
            uv[i * 2 + 1] = new Vector2(1, (float)i / (points.Length - 1));
            normals[i * 2] = normals[i * 2 + 1] = up;
            tangents[i * 2] = tangents[i * 2 + 1] = new Vector4(direction.x, direction.y, direction.z, 1);
        }

        for (int i = 0; i < points.Length - 1; i++)
        {
            triangles[i * 6] = i * 2;
            triangles[i * 6 + 1] = i * 2 + 1;
            triangles[i * 6 + 2] = i * 2 + 2;
            triangles[i * 6 + 3] = i * 2 + 1;
            triangles[i * 6 + 4] = i * 2 + 3;
            triangles[i * 6 + 5] = i * 2 + 2;
        }

        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.uv = uv;
        mesh.normals = normals;
        mesh.tangents = tangents;
        mesh.RecalculateBounds();
        mesh.RecalculateNormals();
        mesh.RecalculateTangents();

        return mesh;
    }
}

[System.Serializable]
public class RoadLook
{
    public string token;
    public string name;
    public string[] lanes_left;
    public string[] lanes_right;
    public float offset;
    public float lane_offset;
    public float shoulder_space_left;
    public float shoulder_space_right;
}

[System.Serializable]
public class Road
{
    public string uid;
    public int type;
    public int x;
    public int y;
    public int sector_x;
    public int sector_y;
    public int dlc_guard;
    public bool hidden;
    public RoadLook road_look;
    public int start_node_uid;
    public int end_node_uid;
    public float length;
    public bool maybe_divided;
    public Point[] points;
    public Lane[] lanes;
}