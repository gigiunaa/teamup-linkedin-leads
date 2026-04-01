import os
import time
import json
import logging
import threading
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET")
ZOHO_REFRESH_TOKEN = os.environ.get("ZOHO_REFRESH_TOKEN")
ZOHO_API_BASE = "https://www.zohoapis.com"
ZOHO_ACCOUNTS_URL = "https://accounts.zoho.com"

SALESFORGE_API_KEY = os.environ.get("SALESFORGE_API_KEY")
SALESFORGE_WORKSPACE_ID = os.environ.get("SALESFORGE_WORKSPACE_ID", "wks_tl63uf09qzsj1om3t1his")

_token_cache = {"access_token": None, "expires_at": 0}
_token_lock = threading.Lock()


def get_zoho_access_token():
    now = time.time()
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["access_token"]

    with _token_lock:
        now = time.time()
        if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
            return _token_cache["access_token"]

        logger.info("Refreshing Zoho access token...")
        resp = requests.post(
            f"{ZOHO_ACCOUNTS_URL}/oauth/v2/token",
            params={
                "grant_type": "refresh_token",
                "client_id": ZOHO_CLIENT_ID,
                "client_secret": ZOHO_CLIENT_SECRET,
                "refresh_token": ZOHO_REFRESH_TOKEN,
            },
        )
        data = resp.json()
        if "access_token" not in data:
            logger.error(f"Zoho token refresh failed: {data}")
            raise Exception(f"Zoho token refresh failed: {data.get('error', 'unknown')}")

        _token_cache["access_token"] = data["access_token"]
        _token_cache["expires_at"] = now + data.get("expires_in", 3600)
        logger.info("Zoho access token refreshed")
        return _token_cache["access_token"]


def create_zoho_lead(lead_data):
    token = get_zoho_access_token()
    payload = {
        "data": [
            {
                "First_Name": lead_data.get("firstName", ""),
                "Last_Name": lead_data.get("lastName", "Unknown"),
                "Email": lead_data.get("email", ""),
                "Phone": lead_data.get("phone") or "",
                "Company": lead_data.get("company") or "Unknown",
                "Lead_Source": "Sales Team",
                "Tag": [{"name": "Outbound"}],
                "Description": (
                    f"LinkedIn: {lead_data.get('linkedinUrl', '')}\n"
                    f"Headline: {lead_data.get('headline', '')}\n"
                    f"Country: {lead_data.get('country', '')}"
                ),
            }
        ],
        "trigger": ["workflow"],
    }
    country = lead_data.get("country")
    if country:
        payload["data"][0]["Country"] = country

    resp = requests.post(
        f"{ZOHO_API_BASE}/crm/v2/Leads",
        headers={
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
    result = resp.json()
    logger.info(f"Zoho response: {resp.status_code} - {json.dumps(result)}")

    if resp.status_code == 201 and result.get("data"):
        record = result["data"][0]
        if record.get("status") == "success":
            return {"success": True, "id": record["details"]["id"]}

    if result.get("data") and result["data"][0].get("code") == "DUPLICATE_DATA":
        return {"success": True, "id": result["data"][0]["details"].get("id", ""), "duplicate": True}

    return {"success": False, "error": json.dumps(result)}


def create_salesforge_contact(lead_data):
    if not SALESFORGE_API_KEY:
        logger.warning("SALESFORGE_API_KEY not set, skipping Salesforge")
        return {"success": False, "error": "API key not configured"}

    payload = {
        "firstName": lead_data.get("firstName", ""),
    }
    if lead_data.get("lastName"):
        payload["lastName"] = lead_data["lastName"]
    if lead_data.get("email"):
        payload["email"] = lead_data["email"]
    if lead_data.get("company"):
        payload["company"] = lead_data["company"]
    if lead_data.get("linkedinUrl"):
        payload["linkedinUrl"] = lead_data["linkedinUrl"]
    if lead_data.get("headline"):
        payload["position"] = lead_data["headline"]

    resp = requests.post(
        f"https://api.salesforge.ai/public/v2/workspaces/{SALESFORGE_WORKSPACE_ID}/contacts",
        headers={
            "Authorization": SALESFORGE_API_KEY,
            "Content-Type": "application/json",
        },
        json=payload,
    )
    logger.info(f"Salesforge response: {resp.status_code} - {resp.text}")

    if resp.status_code in (200, 201):
        return {"success": True}

    return {"success": False, "error": f"Salesforge {resp.status_code}: {resp.text}"}


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "teamup-lead-api"})


@app.route("/api/lead", methods=["POST"])
def receive_lead():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "No JSON body"}), 400
    if not data.get("email") or "@" not in data.get("email", ""):
        return jsonify({"success": False, "error": "Valid email required"}), 400
    if not data.get("lastName"):
        return jsonify({"success": False, "error": "Last name required"}), 400

    logger.info(f"Lead: {data.get('firstName')} {data.get('lastName')} <{data.get('email')}>")

    try:
        zoho_result = create_zoho_lead(data)
        sf_result = create_salesforge_contact(data)

        zoho_ok = zoho_result.get("success")
        sf_ok = sf_result.get("success")

        if not zoho_ok:
            return jsonify({"success": False, "error": "Zoho: " + zoho_result.get("error", "unknown")}), 500

        msg = "Lead created in Zoho CRM"
        if zoho_result.get("duplicate"):
            msg = "Lead already exists in Zoho"
        if sf_ok:
            msg += " + Salesforge"
        else:
            msg += " (Salesforge failed: " + sf_result.get("error", "unknown") + ")"

        return jsonify({
            "success": True,
            "message": msg,
            "zohoId": zoho_result.get("id"),
        })
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500



def find_zoho_lead_by_email(email):
    token = get_zoho_access_token()
    resp = requests.get(
        f"{ZOHO_API_BASE}/crm/v2/Leads/search",
        headers={"Authorization": f"Zoho-oauthtoken {token}"},
        params={"email": email},
    )
    if resp.status_code == 200 and resp.json().get("data"):
        return resp.json()["data"][0]["id"]
    return None


def add_zoho_note(lead_id, title, content):
    token = get_zoho_access_token()
    payload = {
        "data": [
            {
                "Note_Title": title,
                "Note_Content": content,
                "Parent_Id": lead_id,
                "se_module": "Leads",
            }
        ]
    }
    resp = requests.post(
        f"{ZOHO_API_BASE}/crm/v2/Notes",
        headers={
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
    logger.info(f"Zoho note response: {resp.status_code} - {resp.text}")
    return resp.status_code in (200, 201)


@app.route("/api/webhook/salesforge", methods=["POST"])
def salesforge_webhook():
    data = request.get_json(silent=True) or {}
    logger.info(f"Salesforge webhook payload: {json.dumps(data, indent=2)}")

    event_type = data.get("event") or data.get("type") or data.get("event_type") or ""
    email = data.get("email") or data.get("contact", {}).get("email") or ""

    if not email:
        logger.warning("Webhook: no email found in payload")
        return jsonify({"ok": True, "note": "no email in payload"})

    lead_id = find_zoho_lead_by_email(email)
    if not lead_id:
        logger.warning(f"Webhook: no Zoho lead found for {email}")
        return jsonify({"ok": True, "note": "lead not found in Zoho"})

    title = ""
    content = ""

    if "replied" in event_type or "reply" in event_type:
        reply_text = data.get("message") or data.get("body") or data.get("text") or ""
        title = "Salesforge: Email Reply"
        content = f"Reply from {email}:\n\n{reply_text}" if reply_text else f"Reply received from {email}"

    elif "label" in event_type:
        label = data.get("label") or data.get("new_label") or data.get("label_name") or "unknown"
        title = f"Salesforge: Label — {label}"
        content = f"Label changed to: {label}"

    elif "opened" in event_type:
        title = "Salesforge: Email Opened"
        content = f"{email} opened the email"

    else:
        title = f"Salesforge: {event_type}"
        content = json.dumps(data, indent=2)

    add_zoho_note(lead_id, title, content)
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
