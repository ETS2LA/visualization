using UnityEngine;

public class ThemeHandler : MonoBehaviour
{
    public Theme darkTheme;
    public Theme lightTheme;
    public Theme currentTheme; // This is gotten by other scripts.

    void Start()
    {
        // Extract theme parameter from URL
        string themeParam = Application.absoluteURL.Contains("theme=") ? Application.absoluteURL.Split(new[] { "theme=" }, System.StringSplitOptions.None)[1] : "dark";

        if (themeParam == "light")
        {
            currentTheme = lightTheme;
        }
        else
        {
            currentTheme = darkTheme;
        }
    }
}
