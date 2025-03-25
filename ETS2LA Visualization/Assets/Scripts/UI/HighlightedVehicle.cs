using UnityEngine;
using TMPro;
using DG.Tweening;
using System;

public class HighlightedVehicle : MonoBehaviour
{

    public TMP_Text speed;
    public TMP_Text difference;
    public TMP_Text distance_text;
    public BackendSocket backend;
    public int target_uid;
    private Camera main_cam;

    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        backend = GameObject.Find("Websocket Data").GetComponent<BackendSocket>();
        main_cam = Camera.main;
    }

    // Update is called once per frame
    void Update()
    {
        if (backend.world == null)
        {
            return;
        }
        if (backend.world.traffic == null)
        {
            return;
        }

        if(target_uid == 0)
        {
            transform.GetChild(0).gameObject.SetActive(false);
            return;
        }

        for (int i = 0; i < backend.world.traffic.Length; i++)
        {
            if (backend.world.traffic[i].id == target_uid)
            {

                Vector3 target_position = new Vector3(
                    backend.world.traffic[i].position.z - backend.truck.transform.sector_y, 
                    backend.world.traffic[i].position.y + backend.world.traffic[i].size.height / 2, 
                    backend.world.traffic[i].position.x - backend.truck.transform.sector_x
                );
                float distance = Vector3.Distance(main_cam.transform.position, target_position);

                if(distance > 100)
                {
                    transform.GetChild(0).gameObject.SetActive(false);
                    return;
                }
                else
                {
                    transform.GetChild(0).gameObject.SetActive(true);
                }

                float target_speed = backend.world.traffic[i].speed * 3.6f;
                float target_speed_offset = (backend.world.traffic[i].speed - backend.truck.state.speed) * 3.6f;

                target_speed = (float)Math.Round(target_speed, 0);
                target_speed_offset = (float)Math.Round(target_speed_offset, 0);

                speed.text = target_speed.ToString() + " km/h";
                distance_text.text = Math.Round(distance, 0).ToString() + " m";

                if (target_speed_offset > 0)
                {
                    difference.text = "+ " + target_speed_offset.ToString();
                    difference.enabled = true;
                    difference.color = new Color(0, 1, 0);
                }
                else if (target_speed_offset < 0)
                {
                    difference.text = "- " + Math.Abs(target_speed_offset).ToString();
                    difference.enabled = true;
                    difference.color = new Color(1, 0, 0);
                }
                else
                {
                    difference.enabled = false;
                    difference.color = new Color(1, 1, 1);
                }

                Vector3 screen_target = Camera.main.WorldToScreenPoint(target_position);
                float screen_distance = Vector3.Distance(Camera.main.transform.position, target_position);
                // Scale is 0.8 at 30m distance
                float scale = 0.8f / (screen_distance / 30);

                if (screen_distance > 100)
                {
                    transform.DOKill(); // Ensure any existing animations are stopped.
                    transform.position = screen_target;
                    transform.localScale = new Vector3(scale, scale, scale);
                }
                else
                {
                    transform.DOMove(screen_target, 0.2f);
                    transform.DOScale(new Vector3(scale, scale, scale), 0.2f);
                }
            }
        }
    }
}
