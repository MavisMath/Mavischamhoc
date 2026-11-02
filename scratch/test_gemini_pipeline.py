import asyncio
import json
import urllib.request
import websockets

async def test_pages():
    print("--- 1. Testing HTTP Server availability ---")
    try:
        req = urllib.request.urlopen("http://127.0.0.1:8089/react_geometry_app.html", timeout=5)
        print(f"react_geometry_app.html HTTP status: {req.status}")
        req2 = urllib.request.urlopen("http://127.0.0.1:8089/padlet_ai_mathboard.html", timeout=5)
        print(f"padlet_ai_mathboard.html HTTP status: {req2.status}")
    except Exception as e:
        print(f"HTTP test failed: {e}")

    print("\n--- 2. Connecting to Edge via CDP ---")
    try:
        # Get list of targets
        req = urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5)
        targets = json.loads(req.read().decode('utf-8'))
        ws_url = None
        for t in targets:
            if t.get('type') == 'page':
                ws_url = t.get('webSocketDebuggerUrl')
                print(f"Found page target: {t.get('title')} ({t.get('url')})")
                break
        
        if not ws_url:
            print("No suitable page target found.")
            return

        async with websockets.connect(ws_url) as ws:
            # Navigate to react_geometry_app.html
            msg_id = 1
            await ws.send(json.dumps({
                "id": msg_id,
                "method": "Page.navigate",
                "params": {"url": "http://localhost:8088/react_geometry_app.html"}
            }))
            await asyncio.sleep(2.0)

            # Evaluate JavaScript: Test extractAndParseGeometryJson
            msg_id += 1
            eval_script = """
            (() => {
                const results = {};
                
                // 1. Check STRICT_GEOMETRY_SYSTEM_PROMPT
                results.hasPrompt = typeof STRICT_GEOMETRY_SYSTEM_PROMPT === 'string' && STRICT_GEOMETRY_SYSTEM_PROMPT.includes('trình biên dịch hình học');
                
                // 2. Test extractAndParseGeometryJson with markdown code fences
                const mockAiOutput = "```json\\n[\\n  {\\"type\\": \\"point\\", \\"id\\": \\"A\\", \\"coords\\": [0, 3]},\\n  {\\"type\\": \\"line\\", \\"points\\": [\\"A\\", \\"B\\"]}\\n]\\n```";
                try {
                    const parsed = extractAndParseGeometryJson(mockAiOutput);
                    results.testMarkdownParseSuccess = Array.isArray(parsed) && parsed.length === 2 && parsed[0].id === 'A';
                } catch(e) {
                    results.testMarkdownParseSuccess = false;
                    results.testMarkdownParseError = e.message;
                }

                // 3. Test compileGeometryWithGemini function existence
                results.hasCompileFn = typeof compileGeometryWithGemini === 'function';

                // 4. Test renderDynamicGeometry function existence
                results.hasRenderFn = typeof renderDynamicGeometry === 'function';

                // 5. Test GEOMETRY_TEMPLATES
                results.templatesCount = Object.keys(GEOMETRY_TEMPLATES || {}).length;

                return results;
            })()
            """
            await ws.send(json.dumps({
                "id": msg_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": eval_script,
                    "returnByValue": True
                }
            }))

            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == msg_id:
                    result = data.get("result", {}).get("result", {}).get("value", {})
                    print("\n--- JavaScript Evaluation Results on react_geometry_app.html ---")
                    print(json.dumps(result, indent=2, ensure_ascii=False))
                    break

            # Now test padlet_ai_mathboard.html
            msg_id += 1
            await ws.send(json.dumps({
                "id": msg_id,
                "method": "Page.navigate",
                "params": {"url": "http://localhost:8088/padlet_ai_mathboard.html"}
            }))
            await asyncio.sleep(2.5)

            msg_id += 1
            eval_padlet = """
            (() => {
                const results = {};
                results.hasCallGeminiAgent = typeof callGeminiAgent === 'function';
                results.hasRenderDynamicGeometry = typeof renderDynamicGeometry === 'function';
                results.defaultApiKeyChecked = typeof DEFAULT_GEMINI_API_KEY !== 'undefined';
                return results;
            })()
            """
            await ws.send(json.dumps({
                "id": msg_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": eval_padlet,
                    "returnByValue": True
                }
            }))

            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == msg_id:
                    result = data.get("result", {}).get("result", {}).get("value", {})
                    print("\n--- JavaScript Evaluation Results on padlet_ai_mathboard.html ---")
                    print(json.dumps(result, indent=2, ensure_ascii=False))
                    break

            # Capture screenshot of padlet whiteboard with active cards
            msg_id += 1
            await ws.send(json.dumps({
                "id": msg_id,
                "method": "Page.captureScreenshot",
                "params": {"format": "png"}
            }))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == msg_id:
                    import base64
                    img_data = base64.b64decode(data["result"]["data"])
                    with open(r"d:\Web padlet\scratch\gemini_pipeline_padlet.png", "wb") as img_file:
                        img_file.write(img_data)
                    print("\nSaved screenshot: gemini_pipeline_padlet.png")
                    break

    except Exception as e:
        print(f"CDP Test Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_pages())
