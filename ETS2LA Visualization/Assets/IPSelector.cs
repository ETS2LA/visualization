using MikeSchweitzer.WebSocket;
using UnityEngine;
using TMPro;

public class IPSelector : MonoBehaviour
{
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
            ipInputField.text = WebSocketPrefix + "ets2la.local:37522";
        }

        // Add a listener to handle text changes
        ipInputField.onValueChanged.AddListener(OnInputFieldChanged);
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
            backendSocket.url = WebSocketPrefix + "ets2la.local:37522";
            backendWebrequests.ip_address = "ets2la.local";
        }
    }

    private void OnInputFieldChanged(string newText)
    {
        // Ensure the prefix is always present
        if (!newText.StartsWith(WebSocketPrefix))
        {
            ipInputField.text = WebSocketPrefix + "ets2la.local:37522";
        }
    }
}