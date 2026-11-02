import os

# ============================================================
# 1. PATCH PADLET_AI_MATHBOARD.HTML
# ============================================================
padlet_path = r"d:\Web padlet\padlet_ai_mathboard.html"

with open(padlet_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure DEFAULT_GEMINI_API_KEY checks window.ENV.VITE_GEMINI_API_KEY
old_key_init = "const DEFAULT_GEMINI_API_KEY = '';\n        let savedKey = localStorage.getItem('padlet_gemini_api_key') || '';"
new_key_init = """const DEFAULT_GEMINI_API_KEY = (typeof window !== 'undefined' && window.ENV && window.ENV.VITE_GEMINI_API_KEY) || '';
        let savedKey = localStorage.getItem('padlet_gemini_api_key') || DEFAULT_GEMINI_API_KEY;"""

if old_key_init in content:
    content = content.replace(old_key_init, new_key_init, 1)
    print("Patched DEFAULT_GEMINI_API_KEY initialization.")

# Find callGeminiAgent in padlet_ai_mathboard.html
target_fn_start = "async function callGeminiAgent(prompt, mode, imageObj = null) {"
target_fn_end = "        // ================= CHAT LOG RENDERING ================="

start_idx = content.find(target_fn_start)
end_idx = content.find(target_fn_end)

if start_idx != -1 and end_idx != -1:
    new_call_gemini_agent = """async function callGeminiAgent(prompt, mode, imageObj = null) {
            const activeKey = geminiApiKey || DEFAULT_GEMINI_API_KEY || (window.ENV && window.ENV.VITE_GEMINI_API_KEY);
            if (!activeKey) return null;

            // 1. SYSTEM PROMPT CHUẨN NGHIÊM NGẶT (TIER 1 BÓC TÁCH NGỮ NGHĨA)
            const STRICT_SYSTEM_INSTRUCTION = "Bạn là trình biên dịch hình học. Tuyệt đối không phỏng đoán tọa độ (x,y) không gian. Hãy đọc đề bài và trả về kịch bản dựng hình bằng định dạng JSON thuần túy. Ví dụ: [{\\"type\\": \\"point\\", \\"id\\": \\"A\\"}, {\\"type\\": \\"line\\", \\"points\\": [\\"A\\", \\"B\\"]}]. Không giải thích, không output thêm text ngoài JSON.";

            // Hàm bóc tách JSON an toàn (Data Flow Parser)
            function extractGeometryStepsSafely(rawText) {
                if (!rawText || typeof rawText !== 'string') return null;
                let cleaned = rawText.trim();
                cleaned = cleaned.replace(/^```(?:json)?\\s*/i, '').replace(/\\s*```$/i, '').trim();

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
                if (Array.isArray(parsed)) return parsed;
                if (parsed && Array.isArray(parsed.steps)) return parsed.steps;
                if (parsed && Array.isArray(parsed.construction)) return parsed.construction;
                return null;
            }

            const candidateModels = [
                'gemini-1.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-pro'
            ];

            const promptText = prompt ? prompt.trim() : (imageObj ? 'Đọc và bóc tách đề bài toán học trong ảnh này, tạo các bước dựng hình JSON.' : '');
            let currentPrompt = promptText;
            const maxRetries = 2; // Khối Retry Loop chống ảo giác

            for (const model of candidateModels) {
                let attempt = 0;
                while (attempt <= maxRetries) {
                    attempt++;
                    try {
                        const parts = [];
                        if (imageObj && imageObj.base64Data && attempt === 1) {
                            parts.push({
                                inlineData: {
                                    mimeType: imageObj.mimeType || 'image/jpeg',
                                    data: imageObj.base64Data
                                }
                            });
                        }
                        parts.push({ text: currentPrompt });

                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 14000);

                        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: controller.signal,
                            body: JSON.stringify({
                                systemInstruction: {
                                    parts: [{ text: STRICT_SYSTEM_INSTRUCTION }]
                                },
                                contents: [{ role: 'user', parts: parts }],
                                generationConfig: {
                                    responseMimeType: 'application/json',
                                    temperature: 0.1
                                }
                            })
                        });

                        clearTimeout(timeoutId);

                        if (response.ok) {
                            const data = await response.json();
                            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (rawText) {
                                try {
                                    const validatedSteps = extractGeometryStepsSafely(rawText);
                                    if (validatedSteps && validatedSteps.length > 0) {
                                        return {
                                            title: `📐 ${promptText.substring(0, 35)}...`,
                                            shapeType: 'custom',
                                            cardType: '2d',
                                            explanation: `Đã dịch chuyển đề bài thành kịch bản dựng hình JSXGraph qua Gemini Flash AI (${validatedSteps.length} bước).`,
                                            mathSummary: `$$\\\\text{Declarative JSXGraph Steps: } ${validatedSteps.length}$$`,
                                            steps: validatedSteps,
                                            axis: false,
                                            grid: false,
                                            boundingbox: [-7, 6, 7, -6]
                                        };
                                    }
                                } catch (parseErr) {
                                    console.warn(`[Gemini JSON Parse Error - Lần ${attempt}]:`, parseErr);
                                    // Gửi phản hồi sửa sai cho Gemini trong lần thử tiếp theo
                                    currentPrompt = `Phản hồi vừa rồi của bạn bị lỗi cú pháp JSON: "${parseErr.message}".
Yêu cầu: Đọc lại đề bài "${promptText}" và CHỈ trả về mảng JSON thuần túy [ { "type": "point", "id": "A" }, ... ]. Không kèm text ngoài.`;
                                    continue;
                                }
                            }
                        }
                    } catch (err) {
                        console.warn(`Model ${model} lần thử ${attempt} thất bại:`, err);
                    }
                }
            }

            return null; // Fallback an toàn sang Smart Built-in Engine
        }

"""
    content = content[:start_idx] + new_call_gemini_agent + content[end_idx:]
    with open(padlet_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched padlet_ai_mathboard.html with strict prompt and retry loop!")
else:
    print(f"Could not locate callGeminiAgent boundaries: {start_idx}, {end_idx}")
