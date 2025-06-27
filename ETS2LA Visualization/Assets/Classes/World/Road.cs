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

    public Mesh CreateRailingMesh(Side side, float lane_width = 4.5f, float railing_height = 1.0f, float railing_width = 0.2f, float railing_offset = 0.5f)
    {
        Mesh mesh = new Mesh();
        
        // Parameters for guardrail appearance
        float postSpacing = 4.0f;     // Distance between posts
        float postWidth = 0.15f;      // Width of each post
        float beamHeight = 0.3f;      // Height of the horizontal beam
        float beamThickness = 0.05f;  // Thickness of beam
        
        // Calculate how many posts we'll need
        float totalLength = 0;
        for (int i = 0; i < points.Length - 1; i++) {
            totalLength += Vector3.Distance(points[i].ToVector3(), points[i+1].ToVector3());
        }
        
        int postCount = Mathf.Max(2, Mathf.CeilToInt(totalLength / postSpacing));
        
        // Create arrays for mesh data
        // Each post: 8 vertices (4 for top face, 4 for sides)
        // Beam: 4 vertices per segment
        int vertexCount = postCount * 8 + (points.Length * 4);
        Vector3[] vertices = new Vector3[vertexCount];
        Vector2[] uv = new Vector2[vertexCount];
        Vector3[] normals = new Vector3[vertexCount];
        
        // Triangles for posts and beam
        int postTriCount = (postCount * 12); // 2 triangles per face * 6 faces per post
        int beamTriCount = (points.Length - 1) * 18; // 2 triangles per segment
        int[] triangles = new int[postTriCount + beamTriCount];
        
        float sideMultiplier = (side == Side.LEFT) ? -1f : 1f;
        
        // First create beam along the entire path
        for (int i = 0; i < points.Length; i++) {
            Vector3 point = points[i].ToVector3();
            Vector3 direction;
            
            if (i < points.Length - 1) {
                direction = (points[i + 1].ToVector3() - point).normalized;
            } else {
                direction = (point - points[i - 1].ToVector3()).normalized;
            }
            
            Vector3 roadNormal = Vector3.Cross(direction, Vector3.down).normalized;
            Vector3 railPos = point + roadNormal * (lane_width / 2 + railing_offset) * sideMultiplier;
            
            // Position of beam - at top of railing
            float beamTop = railing_height - beamHeight * 0.5f;
            
            // Create beam vertices
            int baseIdx = i * 4;
            
            // Front edge of beam
            vertices[baseIdx] = railPos + roadNormal * (railing_width * 0.5f) + Vector3.up * (beamTop - beamHeight * 0.5f);
            vertices[baseIdx + 1] = railPos + roadNormal * (railing_width * 0.5f) + Vector3.up * (beamTop + beamHeight * 0.5f);
            
            // Back edge of beam
            vertices[baseIdx + 2] = railPos - roadNormal * (railing_width * 0.5f) + Vector3.up * (beamTop - beamHeight * 0.5f);  
            vertices[baseIdx + 3] = railPos - roadNormal * (railing_width * 0.5f) + Vector3.up * (beamTop + beamHeight * 0.5f);
            
            // Normals - facing outward for front, inward for back
            Vector3 outwardNormal = roadNormal * sideMultiplier;
            normals[baseIdx] = outwardNormal;
            normals[baseIdx + 1] = outwardNormal;
            normals[baseIdx + 2] = -outwardNormal;
            normals[baseIdx + 3] = -outwardNormal;
            
            // UVs - simple mapping
            uv[baseIdx] = new Vector2(0, 0);
            uv[baseIdx + 1] = new Vector2(0, 1);
            uv[baseIdx + 2] = new Vector2(1, 0);
            uv[baseIdx + 3] = new Vector2(1, 1);
        }
        
        // Create triangles for beam
        int triIdx = 0;
        for (int i = 0; i < points.Length - 1; i++)
        {
            int baseIdx = i * 4;

            // Front face of beam
            triangles[triIdx++] = baseIdx;
            triangles[triIdx++] = baseIdx + 1;
            triangles[triIdx++] = baseIdx + 4;

            triangles[triIdx++] = baseIdx + 1;
            triangles[triIdx++] = baseIdx + 5;
            triangles[triIdx++] = baseIdx + 4;

            // Back face of beam
            triangles[triIdx++] = baseIdx + 2;
            triangles[triIdx++] = baseIdx + 6;
            triangles[triIdx++] = baseIdx + 3;

            triangles[triIdx++] = baseIdx + 3;
            triangles[triIdx++] = baseIdx + 6;
            triangles[triIdx++] = baseIdx + 7;

            // Top face of beam
            triangles[triIdx++] = baseIdx + 1;
            triangles[triIdx++] = baseIdx + 3;
            triangles[triIdx++] = baseIdx + 5;

            triangles[triIdx++] = baseIdx + 3;
            triangles[triIdx++] = baseIdx + 7;
            triangles[triIdx++] = baseIdx + 5;
        }
        
        // Create posts at regular intervals
        int postBaseIdx = points.Length * 4;
        
        // Distribute posts evenly along the path
        float distanceTraveled = 0;
        float nextPostDistance = 0;
        int postsCreated = 0;
        
        for (int i = 0; i < points.Length - 1; i++) {
            Vector3 startPos = points[i].ToVector3();
            Vector3 endPos = points[i + 1].ToVector3();
            Vector3 direction = (endPos - startPos).normalized;
            Vector3 roadNormal = Vector3.Cross(direction, Vector3.down).normalized;
            
            float segmentLength = Vector3.Distance(startPos, endPos);
            float remainingSegment = segmentLength;
            
            // Create posts along this segment
            while (remainingSegment + distanceTraveled >= nextPostDistance && postsCreated < postCount) {
                // Interpolate position along this segment
                float t = (nextPostDistance - distanceTraveled) / segmentLength;
                Vector3 postPos = Vector3.Lerp(startPos, endPos, t);
                
                // Create post at this position
                Vector3 railPos = postPos + roadNormal * (lane_width / 2 + railing_offset) * sideMultiplier;
                
                // Post vertices (8 vertices per post - 4 corners at bottom, 4 at top)
                int vIdx = postBaseIdx + postsCreated * 8;
                
                // Bottom vertices
                Vector3 bottomFrontRight = railPos + roadNormal * (postWidth/2) - direction * (postWidth/2);
                Vector3 bottomFrontLeft = railPos - roadNormal * (postWidth/2) - direction * (postWidth/2);
                Vector3 bottomBackRight = railPos + roadNormal * (postWidth/2) + direction * (postWidth/2);
                Vector3 bottomBackLeft = railPos - roadNormal * (postWidth/2) + direction * (postWidth/2);
                
                // Top vertices
                Vector3 topFrontRight = bottomFrontRight + Vector3.up * railing_height;
                Vector3 topFrontLeft = bottomFrontLeft + Vector3.up * railing_height;
                Vector3 topBackRight = bottomBackRight + Vector3.up * railing_height;
                Vector3 topBackLeft = bottomBackLeft + Vector3.up * railing_height;
                
                // Assign vertices
                vertices[vIdx] = bottomFrontRight;
                vertices[vIdx + 1] = bottomFrontLeft;
                vertices[vIdx + 2] = bottomBackRight;
                vertices[vIdx + 3] = bottomBackLeft;
                vertices[vIdx + 4] = topFrontRight;
                vertices[vIdx + 5] = topFrontLeft;
                vertices[vIdx + 6] = topBackRight;
                vertices[vIdx + 7] = topBackLeft;
                
                // Set normals for post (front, back, sides)
                // Front face
                normals[vIdx] = -direction;
                normals[vIdx + 1] = -direction;
                normals[vIdx + 4] = -direction;
                normals[vIdx + 5] = -direction;
                
                // Back face
                normals[vIdx + 2] = direction;
                normals[vIdx + 3] = direction;
                normals[vIdx + 6] = direction;
                normals[vIdx + 7] = direction;
                
                // UVs
                for (int j = 0; j < 8; j++) {
                    uv[vIdx + j] = new Vector2(j % 2, j < 4 ? 0 : 1);
                }
                
                // Create post triangles (optional: only create visible faces)
                int tIdx = beamTriCount + postsCreated * 12;
                
                // Front face
                triangles[tIdx] = vIdx;
                triangles[tIdx + 1] = vIdx + 4;
                triangles[tIdx + 2] = vIdx + 1;
                
                triangles[tIdx + 3] = vIdx + 1;
                triangles[tIdx + 4] = vIdx + 4;
                triangles[tIdx + 5] = vIdx + 5;
                
                // Back face
                triangles[tIdx + 6] = vIdx + 2;
                triangles[tIdx + 7] = vIdx + 3;
                triangles[tIdx + 8] = vIdx + 6;
                
                triangles[tIdx + 9] = vIdx + 3;
                triangles[tIdx + 10] = vIdx + 7;
                triangles[tIdx + 11] = vIdx + 6;
                
                // Could add side faces if needed
                
                // Set up for next post
                postsCreated++;
                nextPostDistance += postSpacing;
            }
            
            distanceTraveled += segmentLength;
            remainingSegment = 0;
        }
        
        // Assign data to mesh
        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.uv = uv;
        mesh.normals = normals;
        mesh.RecalculateBounds();
        
        return mesh;
    }
    
    public Mesh CreateRailingMesh(Side side, Railing railing, float lane_width = 4.5f, float right_shoulder = 0, float left_shoulder = 0)
    {
        float railing_height = 1.0f;
        float railing_width = 0.2f;

        float offset = railing_width / 2;
        if (side == Side.LEFT)
        {
            offset += left_shoulder;
        }
        else if (side == Side.RIGHT)
        {
            offset += right_shoulder;
        }
        
        return CreateRailingMesh(side, lane_width, railing_height, railing_width, offset);
    }
}

[System.Serializable]
public class Railing
{
    public string right_railing;
    public int right_railing_offset;
    public string left_railing;
    public int left_railing_offset;
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
    public Railing[] railings;
}