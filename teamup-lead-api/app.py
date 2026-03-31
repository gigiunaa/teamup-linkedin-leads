import os
import time
import json
import logging
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

_token_cache = {"access_token": None, "expires_at": 0}


def get_zoho_access_token():
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
                "Tag": [{"name": "Inbound"}],
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
        result = create_zoho_lead(data)
        if result.get("duplicate"):
            return jsonify({"success": True, "message": "Lead already exists", "zohoId": result.get("id")})
        if result["success"]:
            return jsonify({"success": True, "message": "Lead created in Zoho CRM", "zohoId": result.get("id")})
        else:
            return jsonify({"success": False, "error": result.get("error")}), 500
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/lead", methods=["OPTIONS"])
def lead_options():
    return "", 204


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
