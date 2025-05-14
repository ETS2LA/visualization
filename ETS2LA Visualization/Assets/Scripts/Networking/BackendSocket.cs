using UnityEngine;
using MikeSchweitzer.WebSocket;
using Baracuda.Monitoring;
using System.Collections.Generic;
using DG.Tweening;

[System.Serializable]
public class RouteInformation
{
    public string[] uids;
    public int lane_index;
    public string type;
    public bool is_ended;
    public bool is_lane_changing;

    // Only populated if is_lane_changing is true
    public Vector3[] lane_points = new Vector3[0];
    public Vector3[] last_lane_points = new Vector3[0];
}

[System.Serializable]
public class StatusData
{
    public string[] enabled;
    public string[] disabled;
}

public class BackendSocket : MonitoredBehaviour
{
    #region Websocket
    public WebSocketConnection connection;
    public string url = "ws://localhost:37522"; // ETS2LA + 2 ports
    public float connection_retry_time = 5.0f; // seconds
    private float last_connection_retry = 0;
    private float last_acknowledge = 0;
    #endregion

    #region Profiling
    public float profiling_time = 1.0f;
    [Monitor]
    private string connection_status = "Disconnected";
    [Monitor]
    private int packets_per_second = 0;
    private float last_profile = 0;
    private List<string> messages = new List<string>();
    #endregion

    #region Backend Setup
    public int[] subscribed_channels = new int[] { 1, 2, 3, 4, 5, 6, 7, 8 };

    class SubscribeChannel {
        public int channel;
        public string method;
    }

    [System.Serializable]
    public class BaseResult {
        public string type;
        public object data;
    }
    [System.Serializable]
    public class BaseResponse {
        public int channel;
        public BaseResult result;
    }
    #endregion

    # region Channel 1 - Position
    [System.Serializable]
    public class Transform {
        public float x;
        public float y;
        public float z;
        public float sector_x;
        public float sector_y;
        public float rx;
        public float ry;
        public float rz;
    }
    [System.Serializable]
    public class TransformResult : BaseResult { public new Transform data; }
    [System.Serializable]
    public class TransformResponse : BaseResponse { public new TransformResult result; }
    #endregion

    # region Channel 2 - Steering
    [System.Serializable]
    public class SteeringData
    {
        public Point[] points;
        public RouteInformation[] information;
    }
    [System.Serializable]
    public class SteeringResult : BaseResult { public new SteeringData data; }
    [System.Serializable]
    public class SteeringResponse : BaseResponse { public new SteeringResult result; }
    float last_steering_point_added = 0;
    Vector3[] last_steering = new Vector3[0];
    #endregion

    # region Channel 3 - Truck State
    [System.Serializable]
    public class TruckState
    {
        public float speed;
        public float speed_limit;
        public float cruise_control;
        public float target_speed;
        public float throttle;
        public float brake;
        public bool indicating_left;
        public bool indicating_right;
        public bool indicator_left;
        public bool indicator_right;
        public string game;
        public int time;
    }

    [System.Serializable]
    public class StateResult : BaseResult { public new TruckState data; }
    [System.Serializable]
    public class StateResponse : BaseResponse { public new StateResult result; }
    #endregion

    # region Channel 4 - Traffic
    [System.Serializable]
    public class TrafficData
    {
        public VehicleClass[] vehicles;
    }
    [System.Serializable]
    public class TrafficResult : BaseResult { public new TrafficData data; }
    [System.Serializable]
    public class TrafficResponse : BaseResponse { public new TrafficResult result; }
    #endregion

    # region Channel 5 - Trailers
    [System.Serializable]
    public class TrailerData
    {
        public ConnectedTrailer[] trailers;
    }
    [System.Serializable]
    public class TrailerResult : BaseResult { public new TrailerData data; }
    [System.Serializable]
    public class TrailerResponse : BaseResponse { public new TrailerResult result; }
    #endregion

    # region Channel 6 - Higlights

    [System.Serializable]
    public class HighlightData
    {
        public int[] vehicles;
    }
    [System.Serializable]
    public class HighlightResult : BaseResult { public new HighlightData data; }
    [System.Serializable]
    public class HighlightResponse : BaseResponse { public new HighlightResult result; }

    #endregion

    # region Channel 7 - Status
    [System.Serializable]
    public class StatusResult : BaseResult { public new StatusData data; }
    [System.Serializable]
    public class StatusResponse : BaseResponse { public new StatusResult result; }
    #endregion

    # region Channel 8 - Semaphores

    [System.Serializable]
    public class SemaphoreData
    {
        public TrafficLight[] traffic_lights;
        public Gate[] gates;
    }
    [System.Serializable]
    public class SemaphoreResult : BaseResult { public new SemaphoreData data; }
    [System.Serializable]
    public class SemaphoreResponse : BaseResponse { public new SemaphoreResult result; }

    #endregion

    # region Truck
    public class Truck {
        public Transform transform;
        public Vector3[] steering = new Vector3[0];
        public TruckState state;
        public ConnectedTrailer[] trailers = new ConnectedTrailer[0];
    }
    public Truck truck = new Truck();
    #endregion 

    # region World
    public class Highlights
    {
        public int[] vehicles = new int[0];
    }

    public class World
    {
        public VehicleClass[] traffic = new VehicleClass[0];
        public TrafficLight[] traffic_lights = new TrafficLight[0];
        public Gate[] gates = new Gate[0];
        public Highlights highlights = new Highlights();
        public RouteInformation[] route_information = new RouteInformation[0];
        public StatusData status = new StatusData();
    }
    public World world = new World();
    #endregion

    public void Connect()
    {
        last_connection_retry = Time.time;
        Debug.LogWarning("Connecting to " + url);
        connection.Connect(url);
    }

    public void Disconnect()
    {
        connection.Disconnect();
    }

    private new void Awake()
    {
        DOTween.SetTweensCapacity(5000, 100);

        WebSocketConfig config = new WebSocketConfig();
        config.MaxReceiveBytes = 1024 * 1024;
        connection.DesiredConfig = config;

        connection.StateChanged += OnStateChanged;
        connection.ErrorMessageReceived += OnErrorMessageReceived;
        Connect();
        this.StartMonitoring();
    }

    private new void OnDestroy()
    {
        connection.StateChanged -= OnStateChanged;
        connection.ErrorMessageReceived -= OnErrorMessageReceived;
        this.StopMonitoring();
    }

    private void OnConnect(WebSocketConnection connection) {
        Debug.Log("Successfully connected to " + url);
        Debug.Log("Connecting to " + subscribed_channels.Length + " channels...");
        for (int i = 0; i < subscribed_channels.Length; i++)
        {
            SubscribeChannel subscribe = new SubscribeChannel();
            subscribe.channel = subscribed_channels[i];
            subscribe.method = "subscribe";

            connection.AddOutgoingMessage(JsonUtility.ToJson(subscribe));
            Debug.Log("Subscribed to channel " + subscribed_channels[i]);
        }
    }

    private void Acknowledge(WebSocketConnection connection, int channel)
    {
        SubscribeChannel subscribe = new SubscribeChannel();
        subscribe.channel = channel;
        subscribe.method = "acknowledge";
        connection.AddOutgoingMessage(JsonUtility.ToJson(subscribe));
        last_acknowledge = Time.time;
    }

    private void OnStateChanged(WebSocketConnection connection, WebSocketState oldState, WebSocketState newState)
    {
        switch (newState)
        {
            case WebSocketState.Connected:
                connection_status = "Connected";
                OnConnect(connection);
                break;
            case WebSocketState.Disconnected:
                connection_status = "Disconnected";
                break;
            case WebSocketState.Invalid:
                connection_status = "Invalid";
                break;
        }
    }

    private void OnErrorMessageReceived(WebSocketConnection connection, string errorMessage)
    {
        Debug.LogError("Socket failed to connect. Error: " + errorMessage);
    }

    void Update()
    {
        if (connection.State == WebSocketState.Disconnected && Time.time - last_connection_retry > connection_retry_time)
        {
            Debug.LogError("Connection lost...");
            return;
        }

        int count = 0;
        foreach(var message in connection.IncomingMessages)
        {
            count++;
        }


        if(count < subscribed_channels.Length)
        {
            if (Time.time - last_acknowledge > 0.1f)
            {
                // Didn't receive all message, clear and try again
                Acknowledge(connection, 0);
                while (connection.TryRemoveIncomingMessage(out string message)){}
            }
            
            return;
        }

        while (connection.TryRemoveIncomingMessage(out string message)){
            BaseResponse response = JsonUtility.FromJson<BaseResponse>(message);
            messages.Add(message);
            switch (response.channel)
            {
                case 1:
                    TransformResponse truck_response = JsonUtility.FromJson<TransformResponse>(message);
                    TransformResult truck_result = truck_response.result;
                    truck.transform = truck_result.data;
                    break;

                case 2:
                    SteeringResponse steering_response = JsonUtility.FromJson<SteeringResponse>(message);
                    SteeringResult steering_result = steering_response.result;
                    try
                    {
                        Vector3[] points = new Vector3[steering_result.data.points.Length];
                        for (int i = 0; i < steering_result.data.points.Length; i++)
                        {
                            points[i] = steering_result.data.points[i].ToVector3() - new Vector3(truck.transform.sector_y, 0, truck.transform.sector_x);
                        }
                        last_steering = points;

                        world.route_information = steering_result.data.information;
                    } catch {}
                    break;

                case 3:
                    StateResponse state_response = JsonUtility.FromJson<StateResponse>(message);
                    StateResult state_result = state_response.result;
                    truck.state = state_result.data;
                    break;

                case 4:
                    TrafficResponse traffic_response = JsonUtility.FromJson<TrafficResponse>(message);
                    TrafficResult traffic_result = traffic_response.result;
                    world.traffic = traffic_result.data.vehicles;
                    break;

                case 5:
                    TrailerResponse trailer_response = JsonUtility.FromJson<TrailerResponse>(message);
                    TrailerResult trailer_result = trailer_response.result;
                    truck.trailers = trailer_result.data.trailers;
                    break;

                case 6:
                    HighlightResponse highlight_response = JsonUtility.FromJson<HighlightResponse>(message);
                    HighlightResult highlight_result = highlight_response.result;
                    world.highlights.vehicles = highlight_result.data.vehicles;
                    break;

                case 7:
                    StatusResponse status_response = JsonUtility.FromJson<StatusResponse>(message);
                    StatusResult status_result = status_response.result;
                    world.status = status_result.data;
                    break;
                
                case 8:
                    SemaphoreResponse semaphore_response = JsonUtility.FromJson<SemaphoreResponse>(message);
                    SemaphoreResult semaphore_result = semaphore_response.result;
                    world.traffic_lights = semaphore_result.data.traffic_lights;
                    world.gates = semaphore_result.data.gates;
                    break;
            }
        }
        
        Acknowledge(connection, 0);

        if (Time.time - last_profile > profiling_time)
        {
            packets_per_second = messages.Count / subscribed_channels.Length;
            messages.Clear();
            last_profile = Time.time;
        }

        if(last_steering.Length > truck.steering.Length)
        {
            if(Time.time - last_steering_point_added > 0.05f)
            {
                last_steering_point_added = Time.time;
                truck.steering = last_steering[0..(truck.steering.Length + 1)];
            }
            else
            {
                // Smoothly interpolate the last point
                truck.steering[truck.steering.Length - 1] = Vector3.Lerp(truck.steering[truck.steering.Length - 1], last_steering[truck.steering.Length - 1], Time.deltaTime * 10);
            }
        }
        else
        {
            truck.steering = last_steering;
        }

    }

}