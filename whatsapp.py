import os

import requests

API_VERSION = "v21.0"


def send_text(body: str) -> dict:
    phone_number_id = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
    token = os.environ["WHATSAPP_ACCESS_TOKEN"]
    recipient = os.environ["WHATSAPP_RECIPIENT"]

    url = f"https://graph.facebook.com/{API_VERSION}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {"preview_url": True, "body": body[:4096]},
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()
