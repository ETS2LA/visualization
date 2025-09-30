using MikeSchweitzer.WebSocket;
using UnityEngine;
using TMPro;
using UnityEngine.UI;

public class IPSelector : MonoBehaviour
{
    public TMP_Text HTTPSNotice;
    private TMP_InputField ipInputField;
    private BackendSocket backendSocket;
    private BackendWebrequests backendWebrequests;

    private Theme theme;

    private const string WebSocketPrefix = "ws://";

    void Start()
    {
        ipInputField = GetComponent<TMP_InputField>();
        backendSocket = FindFirstObjectByType<BackendSocket>();
        backendWebrequests = FindFirstObjectByType<BackendWebrequests>();

        // Initialize the input field with the prefix
        if (!ipInputField.text.StartsWith(WebSocketPrefix))
        {
            ipInputField.text = WebSocketPrefix + "localhost:37522";
        }

        // Add a listener to handle text changes
        ipInputField.onValueChanged.AddListener(OnInputFieldChanged);

        if (Application.absoluteURL.Contains("https"))
        {
            HTTPSNotice.gameObject.SetActive(true);
        }

        theme = FindFirstObjectByType<ThemeHandler>().currentTheme;

        // Set colors
        Debug.Log(theme);
        transform.parent.gameObject.GetComponent<RawImage>().color = theme.uiBackground;

        // Text
        transform.parent.GetChild(0).GetComponent<TMP_Text>().color = theme.text;
        HTTPSNotice.color = theme.text;
        
        // Input
        ipInputField.GetComponent<Image>().color = theme.secondaryBackground;
        ipInputField.GetComponent<TMP_InputField>().textComponent.color = theme.text * 0.8f;
        ipInputField.GetComponent<TMP_InputField>().placeholder.GetComponent<TMP_Text>().color = theme.text * 0.6f;

        // Buttons
        transform.parent.GetChild(2).GetChild(0).GetComponent<Image>().color = theme.success;
        transform.parent.GetChild(2).GetChild(0).GetChild(0).GetComponent<TMP_Text>().color = theme.text * 0.8f;
        transform.parent.GetChild(2).GetChild(1).GetComponent<Image>().color = theme.success;
        transform.parent.GetChild(2).GetChild(1).GetChild(0).GetComponent<TMP_Text>().color = theme.text * 0.8f;
        transform.parent.GetChild(4).GetComponent<Image>().color = theme.secondaryBackground;
        transform.parent.GetChild(4).GetChild(0).GetComponent<TMP_Text>().color = theme.text * 0.8f;
    }

    void Update()
    {
        if (backendSocket.connection.State != WebSocketState.Connected)
        {
            gameObject.transform.parent.gameObject.SetActive(true);
            if (backendSocket.connection.State != WebSocketState.Disconnected)
            {
                transform.parent.GetChild(4).GetChild(0).GetComponent<TMP_Text>().text = backendSocket.connection.State.ToString() + "...";
            }
            else
            {
                transform.parent.GetChild(4).GetChild(0).GetComponent<TMP_Text>().text = "Retry Connection";
            }
        }
        else
        {
            gameObject.transform.parent.gameObject.SetActive(false);
            return;
        }

        string text = ipInputField.text.Replace(WebSocketPrefix, "");
        if (text.Length > 0)
        {
            backendSocket.url = WebSocketPrefix + text;
            backendWebrequests.ip_address = text.Replace(WebSocketPrefix, "").Split(':')[0];
        }
        else
        {
            backendSocket.url = WebSocketPrefix + "localhost:37522";
            backendWebrequests.ip_address = "localhost";
        }
    }

    private void OnInputFieldChanged(string newText)
    {
        // Ensure the prefix is always present
        if (!newText.StartsWith(WebSocketPrefix))
        {
            ipInputField.text = WebSocketPrefix + "localhost:37522";
        }
    }

    public void TryLocal()
    {
        ipInputField.text = WebSocketPrefix + "localhost:37522";
        backendSocket.url = WebSocketPrefix + "localhost:37522";
        backendWebrequests.ip_address = "localhost";
        backendSocket.Connect();
    }

    public void TryRemote()
    {
        ipInputField.text = WebSocketPrefix + "ets2la.local:37522";
        backendSocket.url = WebSocketPrefix + "ets2la.local:37522";
        backendWebrequests.ip_address = "ets2la.local";
        backendSocket.Connect();        
    }
}