// This file was created mostly with claude.
// If there is someone with experience then please rewrite it!

using UnityEngine;
using System.Collections.Generic;
using System.Linq;
using System;

public class GroundBuilder : MonoBehaviour
{
    public Material material;
    BackendWebrequests backend;
    private int last_length = 0;
    private Mesh groundMesh;
    private GameObject groundObject;

    void Start()
    {
        backend = GameObject.Find("Map Data").GetComponent<BackendWebrequests>();
        groundMesh = new Mesh();
        groundObject = new GameObject("Terrain Mesh");
        groundObject.AddComponent<MeshFilter>().mesh = groundMesh;
        groundObject.AddComponent<MeshRenderer>().material = material;
        groundObject.GetComponent<MeshRenderer>().sortingLayerName = "Ground";
        groundObject.transform.parent = transform;
        groundObject.AddComponent<StaticObject>();
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
        if (backend.map.elevations == null)
        {
            return;
        }
        if (backend.map.elevations.Length < 3)
        {
            return;
        }

        if (backend.map.elevations.Length != last_length)
        {
            Elevation[] elevations = backend.map.elevations;
            last_length = elevations.Length;
            elevations = FilterElevations(elevations);

            // foreach (Elevation elevation in elevations)
            // {
            //     // Make a cube
            //     GameObject cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            //     cube.transform.position = new Vector3(elevation.x, elevation.y, elevation.z);
            //     cube.AddComponent<StaticObject>();
            //     cube.GetComponent<StaticObject>().position = new Vector3(elevation.x, elevation.y, elevation.z);
            //     cube.GetComponent<MeshRenderer>().material.color = Color.red;
            // }

            // Generate mesh using Delaunay triangulation
            GenerateTerrainMesh(elevations);
        }
    }

    Elevation[] FilterElevations(Elevation[] elevations)
    {
        // Create a spatial lookup dictionary for quick position checks
        Dictionary<(int x, int z), Elevation> elevationLookup = new Dictionary<(int x, int z), Elevation>();
        foreach (Elevation e in elevations)
        {
            elevationLookup[(e.x, e.z)] = e;
        }

        List<Elevation> filteredElevations = new List<Elevation>();
        int searchRadius = 15;
        
        foreach (Elevation elevation in elevations)
        {
            float averageHeight = 0;
            int count = 0;
            
            // Check surrounding points with early exit if we find enough sample points
            for (int x = -searchRadius; x <= searchRadius && count < 20; x++)
            {
                for (int z = -searchRadius; z <= searchRadius && count < 20; z++)
                {
                    if (x == 0 && z == 0) continue;
                    
                    int newX = elevation.x + x;
                    int newZ = elevation.z + z;
                    
                    // Dictionary lookup is O(1) instead of O(n) with Array.Find
                    if (elevationLookup.TryGetValue((newX, newZ), out Elevation surroundingPoint))
                    {
                        averageHeight += surroundingPoint.y;
                        count++;
                    }
                }
            }

            if (count > 0)
            {
                averageHeight /= count;
                if (Mathf.Abs(elevation.y - averageHeight) < 2)
                {
                    filteredElevations.Add(elevation);
                }
            }
            else
            {
                filteredElevations.Add(elevation);
            }
        }

        return filteredElevations.ToArray();
    }

    private void GenerateTerrainMesh(Elevation[] elevations)
    {
        // Clear any children from previous generation
        foreach (Transform child in transform)
        {
            if (child.gameObject != groundObject)
                Destroy(child.gameObject);
        }

        // Convert elevations to Vector3 points
        Vector3[] points = new Vector3[elevations.Length];
        for (int i = 0; i < elevations.Length; i++)
        {
            points[i] = new Vector3(elevations[i].x, elevations[i].y, elevations[i].z);
        }

        // Create Delaunay triangulation
        Delaunay delaunay = new Delaunay();
        List<Triangle> triangles = delaunay.Triangulate(points);

        // Create mesh from triangulation
        List<Vector3> vertices = new List<Vector3>();
        List<int> triangleIndices = new List<int>();
        List<Vector2> uvs = new List<Vector2>();

        // Get bounds for UV mapping
        float minX = points.Min(p => p.x);
        float maxX = points.Max(p => p.x);
        float minZ = points.Min(p => p.z);
        float maxZ = points.Max(p => p.z);

        // Add all vertices and triangles
        Dictionary<Vector3, int> vertexIndices = new Dictionary<Vector3, int>();
        
        foreach (Triangle triangle in triangles)
        {
            for (int i = 0; i < 3; i++)
            {
                Vector3 vertex = triangle.vertices[i];
                
                if (!vertexIndices.ContainsKey(vertex))
                {
                    vertexIndices[vertex] = vertices.Count;
                    vertices.Add(vertex);
                    
                    // Calculate UV based on normalized XZ position
                    float u = Mathf.InverseLerp(minX, maxX, vertex.x);
                    float v = Mathf.InverseLerp(minZ, maxZ, vertex.z);
                    uvs.Add(new Vector2(u, v));
                }
                
                triangleIndices.Add(vertexIndices[vertex]);
            }
        }

        // Create and assign mesh
        groundMesh.Clear();
        groundMesh.vertices = vertices.ToArray();
        groundMesh.triangles = triangleIndices.ToArray();
        groundMesh.uv = uvs.ToArray();
        groundMesh.RecalculateNormals();
        groundMesh.RecalculateBounds();

        // Update static object position reference
        groundObject.GetComponent<StaticObject>().position = new Vector3(0, -1f, 0);
    }
}

// Delaunay triangulation implementation
public class Delaunay
{
    public List<Triangle> Triangulate(Vector3[] points)
    {
        // Project points to XZ plane for triangulation
        Vector2[] points2D = new Vector2[points.Length];
        Dictionary<Vector2, Vector3> pointMap = new Dictionary<Vector2, Vector3>();
        
        for (int i = 0; i < points.Length; i++)
        {
            Vector2 point2D = new Vector2(points[i].x, points[i].z);
            points2D[i] = point2D;
            pointMap[point2D] = points[i];
        }

        // Create super triangle that contains all points
        float minX = float.MaxValue, minY = float.MaxValue;
        float maxX = float.MinValue, maxY = float.MinValue;
        
        foreach (Vector2 p in points2D)
        {
            minX = Mathf.Min(minX, p.x);
            minY = Mathf.Min(minY, p.y);
            maxX = Mathf.Max(maxX, p.x);
            maxY = Mathf.Max(maxY, p.y);
        }
        
        float dx = (maxX - minX) * 2;
        float dy = (maxY - minY) * 2;
        
        Vector2 v0 = new Vector2(minX - dx, minY - dy * 3);
        Vector2 v1 = new Vector2(minX - dx, maxY + dy);
        Vector2 v2 = new Vector2(maxX + dx * 3, minY - dy);
        
        Triangle2D superTriangle = new Triangle2D(v0, v1, v2);
        
        List<Triangle2D> triangles = new List<Triangle2D>();
        triangles.Add(superTriangle);
        
        // Add points one by one
        foreach (Vector2 point in points2D)
        {
            List<Edge2D> edges = new List<Edge2D>();
            
            // Find all triangles whose circumcircle contains the point
            List<Triangle2D> badTriangles = new List<Triangle2D>();
            
            foreach (Triangle2D triangle in triangles)
            {
                if (triangle.CircumcircleContains(point))
                {
                    badTriangles.Add(triangle);
                    edges.Add(new Edge2D(triangle.v0, triangle.v1));
                    edges.Add(new Edge2D(triangle.v1, triangle.v2));
                    edges.Add(new Edge2D(triangle.v2, triangle.v0));
                }
            }
            
            // Remove triangles with circumcircle containing the point
            foreach (Triangle2D triangle in badTriangles)
            {
                triangles.Remove(triangle);
            }
            
            // Find unique edges
            List<Edge2D> uniqueEdges = new List<Edge2D>();
            
            foreach (Edge2D edge in edges)
            {
                int count = 0;
                foreach (Edge2D otherEdge in edges)
                {
                    if (edge.Equals(otherEdge))
                        count++;
                }
                
                if (count == 1)
                    uniqueEdges.Add(edge);
            }
            
            // Create new triangles from unique edges and point
            foreach (Edge2D edge in uniqueEdges)
            {
                triangles.Add(new Triangle2D(edge.v0, edge.v1, point));
            }
        }
        
        // Remove triangles that share vertices with super triangle
        List<Triangle2D> finalTriangles = new List<Triangle2D>();
        
        foreach (Triangle2D triangle in triangles)
        {
            if (!triangle.SharesVertex(superTriangle))
            {
                finalTriangles.Add(triangle);
            }
        }
        
        // Convert back to 3D triangles
        List<Triangle> result = new List<Triangle>();
        
        foreach (Triangle2D triangle in finalTriangles)
        {
            Vector3 p0 = pointMap[triangle.v0];
            Vector3 p1 = pointMap[triangle.v1];
            Vector3 p2 = pointMap[triangle.v2];
            result.Add(new Triangle(p0, p1, p2));
        }
        
        return result;
    }
}

public class Triangle
{
    public Vector3[] vertices = new Vector3[3];
    
    public Triangle(Vector3 v0, Vector3 v1, Vector3 v2)
    {
        vertices[0] = v0;
        vertices[1] = v1;
        vertices[2] = v2;
    }
}

public class Triangle2D
{
    public Vector2 v0, v1, v2;
    private float circumcenterX, circumcenterY, circumradiusSquared;
    
    public Triangle2D(Vector2 v0, Vector2 v1, Vector2 v2)
    {
        this.v0 = v0;
        this.v1 = v1;
        this.v2 = v2;
        CalculateCircumcircle();
    }
    
    private void CalculateCircumcircle()
    {
        // Calculate circumcenter and radius squared
        float x0 = v0.x;
        float y0 = v0.y;
        float x1 = v1.x;
        float y1 = v1.y;
        float x2 = v2.x;
        float y2 = v2.y;
        
        float A = x1 - x0;
        float B = y1 - y0;
        float C = x2 - x0;
        float D = y2 - y0;
        
        float E = A * (x0 + x1) + B * (y0 + y1);
        float F = C * (x0 + x2) + D * (y0 + y2);
        
        float G = 2.0f * (A * (y2 - y1) - B * (x2 - x1));
        
        if (Mathf.Abs(G) < 0.000001f) // Colinear points
        {
            circumcenterX = (x0 + x2) * 0.5f;
            circumcenterY = (y0 + y2) * 0.5f;
        }
        else
        {
            circumcenterX = (D * E - B * F) / G;
            circumcenterY = (A * F - C * E) / G;
        }
        
        float dx = x0 - circumcenterX;
        float dy = y0 - circumcenterY;
        circumradiusSquared = dx * dx + dy * dy;
    }
    
    public bool CircumcircleContains(Vector2 point)
    {
        float dx = point.x - circumcenterX;
        float dy = point.y - circumcenterY;
        float distSquared = dx * dx + dy * dy;
        return distSquared <= circumradiusSquared * 1.001f; // Small epsilon to handle precision issues
    }
    
    public bool SharesVertex(Triangle2D other)
    {
        return v0 == other.v0 || v0 == other.v1 || v0 == other.v2 ||
               v1 == other.v0 || v1 == other.v1 || v1 == other.v2 ||
               v2 == other.v0 || v2 == other.v1 || v2 == other.v2;
    }
}

public class Edge2D
{
    public Vector2 v0, v1;
    
    public Edge2D(Vector2 v0, Vector2 v1)
    {
        this.v0 = v0;
        this.v1 = v1;
    }
    
    public override bool Equals(object obj)
    {
        float epsilon = 0.1f;
        if (obj is Edge2D other)
        {
            return (Mathf.Abs(v0.x - other.v0.x) < epsilon && Mathf.Abs(v0.y - other.v0.y) < epsilon &&
                    Mathf.Abs(v1.x - other.v1.x) < epsilon && Mathf.Abs(v1.y - other.v1.y) < epsilon) ||
                   (Mathf.Abs(v0.x - other.v1.x) < epsilon && Mathf.Abs(v0.y - other.v1.y) < epsilon &&
                    Mathf.Abs(v1.x - other.v0.x) < epsilon && Mathf.Abs(v1.y - other.v0.y) < epsilon);
        }
        return false;
    }
    
    public override int GetHashCode()
    {
        return v0.GetHashCode() ^ v1.GetHashCode();
    }
}