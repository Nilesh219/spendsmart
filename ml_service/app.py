"""
SpendSmart - Step 2B: Flask API wrapper around the ML categorizer.
Exposes the AI brain as an HTTP service so the Node.js backend can call it.

Run:   python app.py        (listens on port 5001)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS

# ------------------------------------------------------------
# Import YOUR categorizer from your own categorizer.py.
# Two things happen on this line:
# 1. The model is TRAINED once, right now, at startup — every later
#    request is instant, we never retrain per request.
# 2. We get the categorize(text) function to use below.
# ------------------------------------------------------------
from categorizer import categorize

app = Flask(__name__)
CORS(app)  # allows the React frontend (Step 4) to call this API from the browser

PORT = 5001  # 5001 instead of 5000: port 5000 is taken by AirPlay on macOS

@app.route("/", methods=["GET"])
def root():
    """Friendly landing page — stops the 404 when someone opens the root URL."""
    return jsonify({
        "service": "spendsmart-ml",
        "status": "ok",
        "hint": 'POST /categorize with JSON body: {"text": "...", "amount": 123}',
    })



@app.route("/health", methods=["GET"])
def health():
    """A 'are you alive?' endpoint — used to check the service is up."""
    return jsonify({"status": "ok", "service": "spendsmart-ml"})


@app.route("/categorize", methods=["POST"])
def categorize_route():
    # 1. Read the JSON body the backend sends: { "text": "...", "amount": 300 }
    data = request.get_json(silent=True) or {}

    # 2. Validate: no text -> nothing to categorize -> error 400
    text = data.get("text")
    if not text or not str(text).strip():
        return jsonify({"error": "text is required"}), 400

    # 3. THE AI CALL — one line. Runs the trained model on the text.
    category, confidence = categorize(str(text).strip())

    # 4. Send the answer back as JSON.
    return jsonify({
        "category": category,
        "confidence": confidence,
        "text": text,
        "amount": data.get("amount"),
    })


if __name__ == "__main__":
    print(f"🧠 SpendSmart ML service listening at http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT)
