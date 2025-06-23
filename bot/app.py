from flask import Flask, request, jsonify
from flask_cors import CORS # Để xử lý Cross-Origin Resource Sharing
import threading
import bot_oauth as bot
import os


app = Flask(__name__)
CORS(app, resources={r"/check_url": {"origins": "*"}}, supports_credentials=True)


# ĐỔI ENDPOINT VÀ PHƯƠNG THỨC (NẾU CẦN)
@app.route('/check_url', methods=['POST']) # <-- ĐỔI PATH
def process_link_endpoint():
    if not bot:
        return jsonify({"status": "error", "message": "Bot script module not loaded."}), 500

    data = request.get_json()
    if not data or 'link' not in data:
        return jsonify({"status": "error", "message": "Missing 'link' in request body"}), 400

    received_link = data['link']
    print(f"Received link via /check_url: {received_link}")

    try:
        bot_thread = threading.Thread(target=bot.run_playwright_bot, args=(received_link,))
        bot_thread.start()
        return jsonify({"status": "success", "message": f"Link '{received_link}' received and process started in background via /check_url."}), 202
    except Exception as e:
        print(f"Error starting bot thread: {e}")
        return jsonify({"status": "error", "message": f"Failed to start bot process: {str(e)}"}), 500

if __name__ == '__main__':
    # CHẠY TRÊN PORT 8888
    port = int(os.getenv('PORT', 8888))
    print(f"Starting Flask app on port {port} for /check_url endpoint...")
    app.run(host='0.0.0.0', port=port, debug=True) # <-- ĐỔI PORT