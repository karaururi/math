
import http.server
import socketserver
import json

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        # /log-json-error へのPOSTリクエストのみを処理
        if self.path == '/log-json-error':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                
                # 受け取ったデータをデコードして表示
                print("--- JSON PARSE ERROR RECEIVED ---")
                print(post_data.decode('utf-8'))
                print("---------------------------------")
                
                # 成功応答をクライアントに返す
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Log received')
            except Exception as e:
                print(f"Error processing log request: {e}")
                self.send_response(500)
                self.end_headers()
        else:
            # 他のPOSTリクエストは許可しない
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        # GETリクエストは通常通りファイルを返す
        super().do_GET()

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"Serving at port {PORT}")
    print("To stop the server, press Ctrl+C")
    httpd.serve_forever()
