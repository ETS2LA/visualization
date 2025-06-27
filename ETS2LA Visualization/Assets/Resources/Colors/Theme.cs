using UnityEngine;

[CreateAssetMenu(fileName = "Theme", menuName = "Scriptable Objects/Theme")]
public class Theme : ScriptableObject
{
    [Header("Roads & Prefabs")]
    public Color asphalt;
    public Color asphaltLight;
    public Color dirt;
    public Color markings;
    public Color railings;

    [Header("Environment")]
    public Color sky;
    public Color fog;
    public Color buildings;

    [Header("Vehicles")]
    public Color baseColor;
    public Color highlightColor;

    [Header("UI")]
    public Color uiBackground;
    public Color secondaryBackground;
    public Color success;
    public Color warning;
    public Color failure;
    public Color text;
    public Color enabled;
    public Color disabled;

    [Header("Misc")]
    public Color lineEnabled;
    public Color lineDisabled;
}
