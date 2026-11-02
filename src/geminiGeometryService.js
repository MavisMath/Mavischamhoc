/**
 * ============================================================================
 * TIER 1: GEMINI AI GEOMETRY COMPILER SERVICE
 * ============================================================================
 * Nhiệm vụ:
 * 1. Khởi tạo Client Google Generative AI từ biến môi trường (VITE_GEMINI_API_KEY).
 * 2. Cấu hình System Prompt nghiêm ngặt (Trình bóc tách ngữ nghĩa) để ép Gemini
 *    ngừng phỏng đoán tọa độ (x, y) không gian và CHỈ xuất kịch bản JSON thuần túy.
 * 3. Bóc tách an toàn chuỗi JSON từ phản hồi (loại bỏ markdown ```json ... ```).
 * 4. Đồng bộ trực tiếp Tier 2 (JSXGraph renderDynamicGeometry) với cơ chế tự động
 *    gen lại (Retry Loop) khi AI "ảo giác" sinh sai cú pháp JSON, chống crash UI.
 * ============================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. SYSTEM PROMPT CHUẨN ĐƯỢC QUY ĐỊNH CHẶT CHẼ
export const GEOMETRY_SYSTEM_PROMPT = 
    `Bạn là trình biên dịch hình học. Tuyệt đối không phỏng đoán tọa độ (x,y) không gian. Hãy đọc đề bài và trả về kịch bản dựng hình bằng định dạng JSON thuần túy. Ví dụ: [{"type": "point", "id": "A"}, {"type": "line", "points": ["A", "B"]}]. Không giải thích, không output thêm text ngoài JSON.`;

/**
 * Lấy khóa API từ biến môi trường (Vite, Window, LocalStorage)
 */
export function getGeminiApiKey() {
    let key = '';
    
    // 1. Kiểm tra Vite / Bundler Environment
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            key = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.REACT_APP_GEMINI_API_KEY || '';
        }
    } catch (e) {
        // Môi trường không hỗ trợ import.meta
    }

    // 2. Kiểm tra window.ENV từ file env.js
    if (!key && typeof window !== 'undefined' && window.ENV) {
        key = window.ENV.VITE_GEMINI_API_KEY || window.ENV.REACT_APP_GEMINI_API_KEY || '';
    }

    // 3. Kiểm tra localStorage (Cấu hình người dùng lưu trong UI)
    if (!key && typeof localStorage !== 'undefined') {
        key = localStorage.getItem('padlet_gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY') || '';
    }

    return (key || '').trim();
}

/**
 * Khởi tạo client Google Generative AI
 */
let cachedGenAI = null;
let cachedApiKey = null;

export function getGeminiClient(customApiKey = null) {
    const apiKey = customApiKey || getGeminiApiKey();
    if (!apiKey) {
        throw new Error(
            'Chưa cấu hình Gemini API Key! Vui lòng đặt VITE_GEMINI_API_KEY trong file .env hoặc lưu trong cài đặt bảng vẽ.'
        );
    }

    if (cachedGenAI && cachedApiKey === apiKey) {
        return cachedGenAI;
    }

    cachedGenAI = new GoogleGenerativeAI(apiKey);
    cachedApiKey = apiKey;
    return cachedGenAI;
}

/**
 * Hàm bóc tách chuỗi JSON an toàn (Data Flow Parser)
 * - Tự động xóa markdown code blocks: ```json ... ``` hoặc ``` ... ```
 * - Cắt bỏ các câu chào hỏi, giải thích dư thừa ngoài cấu trúc mảng JSON
 * - Parse sang JavaScript Array
 * 
 * @param {string} rawText - Chuỗi văn bản thô do AI sinh ra
 * @returns {Array<Object>} Mảng các bước dựng hình hình học
 */
export function extractAndParseGeometryJson(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('Dữ liệu phản hồi từ AI rỗng hoặc không phải dạng chuỗi.');
    }

    let cleaned = rawText.trim();

    // 1. Loại bỏ các block markdown code block ```json ... ``` hoặc ``` ... ```
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    // 2. Tìm khối JSON hợp lệ: Ưu tiên mảng [...] hoặc object { "steps": [...] }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    } else {
        // Kiểm tra trường hợp AI trả về object bọc { "steps": [...] }
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
    }

    // 3. Thực hiện JSON.parse với kiểm soát ngoại lệ
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (parseError) {
        throw new Error(`Lỗi cú pháp JSON từ phản hồi của AI: ${parseError.message}. Nội dung nhận được: "${cleaned.substring(0, 150)}..."`);
    }

    // 4. Chuẩn hóa về mảng các bước dựng hình []
    let steps = [];
    if (Array.isArray(parsed)) {
        steps = parsed;
    } else if (parsed && Array.isArray(parsed.steps)) {
        steps = parsed.steps;
    } else if (parsed && Array.isArray(parsed.construction)) {
        steps = parsed.construction;
    } else {
        throw new Error('Cấu trúc JSON không hợp lệ: Phản hồi không phải là một mảng [] các bước dựng hình.');
    }

    // 5. Kiểm tra tính hợp lệ cơ bản của từng bước dựng hình
    if (steps.length === 0) {
        throw new Error('Mảng kịch bản dựng hình trống rỗng, không chứa bước dựng hình nào.');
    }

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step || typeof step !== 'object') {
            throw new Error(`Bước thứ ${i + 1} không phải là một object dựng hình hợp lệ.`);
        }
        if (!step.type) {
            throw new Error(`Bước thứ ${i + 1} thiếu thuộc tính "type" bắt buộc (ví dụ: point, line, segment, circle...).`);
        }
    }

    return steps;
}

/**
 * TIER 1: Gửi prompt lên Gemini API với cơ chế tự động thử lại (Auto-Retry Loop)
 * Nếu AI "ảo giác" sinh sai cú pháp JSON hoặc vi phạm schema, hệ thống sẽ tự động
 * gửi phản hồi lỗi lại cho Gemini để sửa sai ngay lập tức mà KHÔNG làm sập UI.
 * 
 * @param {string} userPrompt - Đề bài toán học người dùng nhập
 * @param {Object} options - Tùy chọn cấu hình
 * @param {number} options.maxRetries - Số lần tự động thử lại tối đa (mặc định: 2)
 * @param {string} options.model - Tên model Gemini (mặc định: gemini-1.5-flash)
 * @param {string} options.apiKey - Khóa API tùy chọn
 * @param {Function} options.onStatus - Callback cập nhật trạng thái ra giao diện
 * @returns {Promise<Array<Object>>} Mảng các bước dựng hình JSON đã kiểm duyệt
 */
export async function compileGeometryPromptWithGemini(userPrompt, options = {}) {
    const {
        maxRetries = 2,
        model = 'gemini-1.5-flash',
        apiKey = null,
        onStatus = null
    } = options;

    if (!userPrompt || !userPrompt.trim()) {
        throw new Error('Đề bài hình học không được để trống.');
    }

    const genAI = getGeminiClient(apiKey);
    const generativeModel = genAI.getGenerativeModel({
        model: model,
        systemInstruction: GEOMETRY_SYSTEM_PROMPT,
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1 // Nhiệt độ thấp để đảm bảo tính xác định toán học cao nhất
        }
    });

    let currentPrompt = userPrompt.trim();
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
        attempt++;
        try {
            if (onStatus) {
                if (attempt === 1) {
                    onStatus(`🧠 Đang gửi đề bài lên Gemini (${model}) phân tích ngữ nghĩa...`);
                } else {
                    onStatus(`🔄 AI sinh sai cấu trúc, đang kích hoạt tự động Retry (Lần ${attempt - 1}/${maxRetries})...`);
                }
            }

            // Gửi prompt lên Gemini API
            const result = await generativeModel.generateContent(currentPrompt);
            const response = await result.response;
            const textResponse = response.text();

            if (!textResponse) {
                throw new Error('Gemini trả về phản hồi rỗng.');
            }

            if (onStatus) {
                onStatus('🔍 Đang bóc tách cú pháp JSON & thẩm định các bước dựng hình...');
            }

            // Bóc tách an toàn chuỗi JSON
            const validatedSteps = extractAndParseGeometryJson(textResponse);
            
            if (onStatus) {
                onStatus(`✅ Đã phân tích thành công ${validatedSteps.length} bước dựng hình khai báo!`);
            }

            return validatedSteps;

        } catch (err) {
            lastError = err;
            console.warn(`[Gemini Geometry Compiler] Thử lần ${attempt} thất bại:`, err.message);

            if (attempt <= maxRetries) {
                // Chuẩn bị prompt sửa sai (Self-Correction Prompt) cho Gemini
                currentPrompt = `Phản hồi trước đó của bạn bị lỗi cấu trúc: "${err.message}".
YÊU CẦU BẮT BUỘC SỬA LẠI:
- Đề bài gốc: "${userPrompt.trim()}"
- Chỉ trả về duy nhất một mảng JSON thuần túy [ { "type": "point", "id": "A" }, ... ].
- Tuyệt đối không phỏng đoán tọa độ canvas, không bọc markdown giải thích, không output thêm bất kỳ văn bản nào ngoài JSON.`;
            }
        }
    }

    // Nếu đã hết số lần retry vẫn lỗi, ném lỗi có thông tin chi tiết
    throw new Error(
        `AI không thể sinh kịch bản JSON hợp lệ sau ${maxRetries + 1} lần thử: ${lastError ? lastError.message : 'Lỗi không xác định'}`
    );
}

/**
 * ============================================================================
 * TIER 1 -> TIER 2: PIPELINE ĐỒNG BỘ TOÀN DIỆN
 * ============================================================================
 * Kết nối trực tiếp kết quả bóc tách từ Gemini API với hàm renderDynamicGeometry
 * của JSXGraph. Bọc toàn bộ quá trình vẽ trong khối try/catch phòng vệ nhiều lớp.
 * 
 * @param {string} promptText - Đề bài toán
 * @param {Object|string|HTMLElement} boardOrContainer - JSXGraph Board hoặc Container ID
 * @param {Function} renderGeometryFn - Hàm renderDynamicGeometry của JSXGraph
 * @param {Object} options - Tùy chọn cấu hình bổ sung
 * @returns {Promise<{ success: boolean, steps: Array<Object>, error?: string }>}
 */
export async function executeGeometryPipeline(promptText, boardOrContainer, renderGeometryFn, options = {}) {
    const { onStatus = null, fallbackTemplateFn = null } = options;

    try {
        // TIER 1: Phân tích ngữ nghĩa & bóc tách JSON qua Gemini API
        let steps = null;
        try {
            steps = await compileGeometryPromptWithGemini(promptText, {
                ...options,
                onStatus
            });
        } catch (aiErr) {
            console.error('[Tier 1 AI Error]', aiErr);
            
            // Nếu có hàm fallback cục bộ (Smart Engine), kích hoạt dự phòng để không gián đoạn người dùng
            if (typeof fallbackTemplateFn === 'function') {
                if (onStatus) onStatus('⚠️ Gemini API bận/lỗi, đang chuyển sang Trình dựng hình dự phòng thông minh...');
                steps = fallbackTemplateFn(promptText);
            } else {
                throw aiErr;
            }
        }

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            throw new Error('Không có kịch bản dựng hình hợp lệ để chuyển sang Tier 2.');
        }

        // TIER 2: Đồng bộ vào bảng vẽ JSXGraph
        if (onStatus) onStatus('📐 Đang biên dịch và vẽ đồ thị hình học động lên JSXGraph...');

        try {
            if (typeof renderGeometryFn === 'function') {
                renderGeometryFn(boardOrContainer, steps);
            } else if (boardOrContainer && typeof boardOrContainer.create === 'function') {
                // Nếu người dùng truyền trực tiếp JSXGraph board
                if (typeof window !== 'undefined' && typeof window.renderDynamicGeometry === 'function') {
                    window.renderDynamicGeometry(boardOrContainer, steps);
                } else {
                    console.warn('[Tier 2] Không tìm thấy hàm renderDynamicGeometry, trả về mảng steps.');
                }
            }
        } catch (renderErr) {
            // Khối try/catch phòng vệ: Bắt lỗi của JSXGraph để KHÔNG LÀM SẬP UI
            console.error('[Tier 2 Render Error] Lỗi vẽ JSXGraph:', renderErr);
            throw new Error(`Lỗi khi dựng hình lên bảng vẽ JSXGraph: ${renderErr.message}`);
        }

        if (onStatus) onStatus('🎉 Hoàn tất dựng hình thành công!');

        return {
            success: true,
            steps: steps
        };

    } catch (pipelineErr) {
        console.error('[Geometry Pipeline Failed]', pipelineErr);
        if (onStatus) onStatus(`❌ Thất bại: ${pipelineErr.message}`);
        return {
            success: false,
            steps: null,
            error: pipelineErr.message
        };
    }
}
