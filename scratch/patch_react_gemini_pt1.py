import re

file_path = r"d:\Web padlet\react_geometry_app.html"

with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Add Google Generative AI ESM Loader in <head>
sdk_loader = """    <!-- Google Generative AI SDK (ESM Module Loader) -->
    <script type="module">
        try {
            import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';
            window.GoogleGenerativeAI = GoogleGenerativeAI;
            console.log('[Gemini SDK] @google/generative-ai loaded via ESM CDN');
        } catch (e) {
            console.warn('[Gemini SDK] ESM CDN dynamic load fallback:', e);
        }
    </script>
"""

if "window.GoogleGenerativeAI" not in html:
    html = html.replace("    <!-- React 18 & Babel Standalone -->", sdk_loader + "\n    <!-- React 18 & Babel Standalone -->", 1)
    print("Added Google Generative AI SDK loader to <head>")

# 2. Add Tier 1 Gemini Compiler functions before parseAiMathPromptToJson
tier1_ai_code = """        // ====================================================================
        // TIER 1: GEMINI AI GEOMETRY COMPILER (Bóc tách ngữ nghĩa & JSON Parser)
        // ====================================================================
        const STRICT_GEOMETRY_SYSTEM_PROMPT = `Bạn là trình biên dịch hình học. Tuyệt đối không phỏng đoán tọa độ (x,y) không gian. Hãy đọc đề bài và trả về kịch bản dựng hình bằng định dạng JSON thuần túy. Ví dụ: [{"type": "point", "id": "A"}, {"type": "line", "points": ["A", "B"]}]. Không giải thích, không output thêm text ngoài JSON.`;

        // Bóc tách an toàn chuỗi JSON từ AI, loại bỏ markdown code fences
        function extractAndParseGeometryJson(rawText) {
            if (!rawText || typeof rawText !== 'string') {
                throw new Error('Dữ liệu từ AI rỗng hoặc không đúng định dạng.');
            }
            let cleaned = rawText.trim();
            cleaned = cleaned.replace(/^```(?:json)?\\s*/i, '');
            cleaned = cleaned.replace(/\\s*```$/i, '').trim();

            const firstBracket = cleaned.indexOf('[');
            const lastBracket = cleaned.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                cleaned = cleaned.substring(firstBracket, lastBracket + 1);
            } else {
                const firstBrace = cleaned.indexOf('{');
                const lastBrace = cleaned.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
                }
            }

            const parsed = JSON.parse(cleaned);
            let steps = [];
            if (Array.isArray(parsed)) steps = parsed;
            else if (parsed && Array.isArray(parsed.steps)) steps = parsed.steps;
            else if (parsed && Array.isArray(parsed.construction)) steps = parsed.construction;
            else throw new Error('Cấu trúc JSON không chứa mảng các bước dựng hình [].');

            if (steps.length === 0) throw new Error('Mảng bước dựng hình trống rỗng.');
            return steps;
        }

        // Gọi Gemini API với cơ chế tự động thử lại (Retry Loop) chống ảo giác
        async function compileGeometryWithGemini(userPrompt, onStatus = null, maxRetries = 2) {
            const apiKey = (window.ENV && window.ENV.VITE_GEMINI_API_KEY)
                || localStorage.getItem('padlet_gemini_api_key')
                || localStorage.getItem('VITE_GEMINI_API_KEY')
                || '';

            if (!apiKey) {
                throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập khóa API.');
            }

            let attempt = 0;
            let currentPrompt = userPrompt.trim();
            let lastError = null;

            while (attempt <= maxRetries) {
                attempt++;
                try {
                    if (onStatus) {
                        if (attempt === 1) onStatus('🧠 Đang gửi đề bài lên Gemini API (Tier 1)...');
                        else onStatus(`🔄 AI sinh sai cấu trúc, đang tự động Retry (Lần ${attempt - 1}/${maxRetries})...`);
                    }

                    let textResponse = '';

                    // 1. Thử gọi qua SDK @google/generative-ai
                    if (window.GoogleGenerativeAI) {
                        try {
                            const genAI = new window.GoogleGenerativeAI(apiKey);
                            const model = genAI.getGenerativeModel({
                                model: 'gemini-1.5-flash',
                                systemInstruction: STRICT_GEOMETRY_SYSTEM_PROMPT,
                                generationConfig: {
                                    responseMimeType: 'application/json',
                                    temperature: 0.1
                                }
                            });
                            const result = await model.generateContent(currentPrompt);
                            const res = await result.response;
                            textResponse = res.text();
                        } catch (sdkErr) {
                            console.warn('[SDK Call Error, falling back to REST]:', sdkErr);
                        }
                    }

                    // 2. Fallback sang Google Generative Language REST Endpoint nếu SDK chưa sẵn sàng
                    if (!textResponse) {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 12000);

                        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: controller.signal,
                            body: JSON.stringify({
                                systemInstruction: {
                                    parts: [{ text: STRICT_GEOMETRY_SYSTEM_PROMPT }]
                                },
                                contents: [{ role: 'user', parts: [{ text: currentPrompt }] }],
                                generationConfig: {
                                    responseMimeType: 'application/json',
                                    temperature: 0.1
                                }
                            })
                        });

                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            const errData = await response.json().catch(() => ({}));
                            throw new Error(errData.error?.message || `HTTP ${response.status}`);
                        }

                        const data = await response.json();
                        textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    }

                    if (!textResponse) throw new Error('Phản hồi từ Gemini rỗng.');

                    if (onStatus) onStatus('🔍 Đang bóc tách JSON & thẩm định tính hợp lệ...');
                    const validatedSteps = extractAndParseGeometryJson(textResponse);
                    return validatedSteps;

                } catch (err) {
                    lastError = err;
                    console.warn(`[Gemini Geometry] Lần thử ${attempt} thất bại:`, err.message);

                    if (attempt <= maxRetries) {
                        currentPrompt = `Phản hồi vừa rồi bị lỗi cú pháp hoặc cấu trúc: "${err.message}".
Yêu cầu bắt buộc sửa lại:
- Đề bài: "${userPrompt.trim()}"
- CHỈ xuất mảng JSON thuần túy [ { "type": "point", "id": "A" }, ... ].
- Tuyệt đối không phỏng đoán tọa độ canvas, không giải thích, không kèm text ngoài JSON.`;
                    }
                }
            }

            throw lastError || new Error('Không thể bóc tách JSON hợp lệ từ Gemini');
        }

"""

if "STRICT_GEOMETRY_SYSTEM_PROMPT" not in html:
    marker = "        // ====================================================================\n        // TIER 1: HÀM XỬ LÝ PHẢN HỒI CỦA AI CHATBOT (PARSER & STATE DISPATCHER)"
    html = html.replace(marker, tier1_ai_code + marker, 1)
    print("Added Tier 1 Gemini compiler functions to react_geometry_app.html")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)
print("Updated react_geometry_app.html part 1.")
