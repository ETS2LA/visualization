using MikeSchweitzer.WebSocket;
using UnityEngine;
using TMPro;

public class IPSelector : MonoBehaviour
{
    public TMP_Text HTTPSNotice;
    private TMP_InputField ipInputField;
    private BackendSocket backendSocket;
    private BackendWebrequests backendWebrequests;

    private const string WebSocketPrefix = "ws://";

    void Start()
    {
        ipInputField = GetComponent<TMP_InputField>();
        backendSocket = Object.FindFirstObjectByType<BackendSocket>();
        backendWebrequests = Object.FindFirstObjectByType<BackendWebrequests>();

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
    }

    void Update()
    {
        if (backendSocket.connection.State != WebSocketState.Connected)
        {
            gameObject.transform.parent.gameObject.SetActive(true);
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