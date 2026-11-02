import re

file_path = r"d:\Web padlet\react_geometry_app.html"

with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Update App state declarations
old_state = """            const [chatPrompt, setChatPrompt] = useState('');
            const [isAiProcessing, setIsAiProcessing] = useState(false);"""

new_state = """            const [chatPrompt, setChatPrompt] = useState('');
            const [isAiProcessing, setIsAiProcessing] = useState(false);
            const [aiStatusMsg, setAiStatusMsg] = useState('');
            const [isSettingsOpen, setIsSettingsOpen] = useState(false);
            const [apiKeyInput, setApiKeyInput] = useState(
                localStorage.getItem('padlet_gemini_api_key') || 
                (window.ENV && window.ENV.VITE_GEMINI_API_KEY) || ''
            );"""

if old_state in html:
    html = html.replace(old_state, new_state, 1)
    print("Patched state declarations in App.")

# 2. Update handleAiChatbotSubmit
old_submit = """            const handleAiChatbotSubmit = (e, directPrompt = null) => {
                if (e && e.preventDefault) e.preventDefault();
                const text = (directPrompt !== null ? directPrompt : chatPrompt).trim();
                if (!text) return;

                setIsAiProcessing(true);
                // Mô phỏng AI Tier 1 phân tích và bóc tách dữ liệu toán học thành JSON
                setTimeout(() => {
                    const newCard = parseAiMathPromptToJson(text);
                    
                    // CHỈ ĐẨY OBJECT MỚI VÀO GLOBAL STATE - HOÀN TOÀN KHÔNG CHẠM VÀO DOM!
                    setCards(prev => [...prev, newCard]);
                    setSelectedCardId(newCard.id);
                    setChatPrompt('');
                    setIsAiProcessing(false);
                }, 100);
            };"""

new_submit = """            // ================================================================
            // TIER 1 -> TIER 2: DECOUPLED AI DISPATCHER VỚI AUTO-RETRY LOOP
            // ================================================================
            const handleAiChatbotSubmit = async (e, directPrompt = null) => {
                if (e && e.preventDefault) e.preventDefault();
                const text = (directPrompt !== null ? directPrompt : chatPrompt).trim();
                if (!text) return;

                setIsAiProcessing(true);
                setAiStatusMsg('🧠 Đang khởi tạo Tier 1 AI Parser...');

                try {
                    let steps = null;
                    let isOnlineAi = false;

                    // 1. Gửi prompt lên Gemini API với System Prompt nghiêm ngặt & Auto-Retry Loop
                    try {
                        steps = await compileGeometryWithGemini(text, (msg) => setAiStatusMsg(msg));
                        isOnlineAi = true;
                    } catch (aiErr) {
                        console.warn('[Tier 1 Gemini Fallback]:', aiErr.message);
                        setAiStatusMsg(`⚠️ Gemini API: ${aiErr.message}. Đang chuyển sang Smart Engine dự phòng...`);
                        
                        // Fallback an toàn sang Smart Built-in Engine để KHÔNG BAO GIỜ làm crash UI
                        const fallbackCard = parseAiMathPromptToJson(text);
                        steps = fallbackCard.data.steps;
                    }

                    if (!steps || !Array.isArray(steps) || steps.length === 0) {
                        throw new Error('Không nhận được các bước dựng hình hợp lệ.');
                    }

                    // 2. Đẩy trực tiếp mảng JSON vào React State (Tier 2 DynamicGeometryCard tự vẽ)
                    const newCardId = 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
                    const newCard = {
                        id: newCardId,
                        type: 'geometry',
                        isPinned: false,
                        data: {
                            title: isOnlineAi ? `⚡ AI: ${text.substring(0, 32)}...` : `📐 ${text.substring(0, 32)}`,
                            desc: `Đề bài: "${text}". Biên dịch tự động qua ${isOnlineAi ? 'Gemini 1.5 Flash' : 'Smart Engine (Offline)'}`,
                            formula: `Kịch bản dựng hình JSXGraph gồm ${steps.length} bước khai báo tuần tự`,
                            steps: steps,
                            options: { boundingbox: [-7, 6, 7, -6], axis: false, grid: false }
                        }
                    };

                    setCards(prev => [...prev, newCard]);
                    setSelectedCardId(newCard.id);
                    setChatPrompt('');
                    setAiStatusMsg(isOnlineAi ? '🎉 Đã dựng hình thành công qua Gemini API!' : '✅ Đã dựng hình qua Smart Engine!');
                    setTimeout(() => setAiStatusMsg(''), 4000);

                } catch (err) {
                    console.error('[MathBoard AI Error]:', err);
                    setAiStatusMsg(`⚠️ Lỗi dựng hình: ${err.message}`);
                } finally {
                    setIsAiProcessing(false);
                }
            };"""

if old_submit in html:
    html = html.replace(old_submit, new_submit, 1)
    print("Patched handleAiChatbotSubmit with live Gemini pipeline.")

# 3. Add API Key modal & Header status button
old_header_controls = """                        {/* Top Controls */}
                        <div className="flex items-center gap-3">"""

new_header_controls = """                        {/* Top Controls */}
                        <div className="flex items-center gap-3">
                            {/* Gemini API Key Status & Trigger Modal */}
                            {apiKeyInput ? (
                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 hover:bg-emerald-500/20 transition"
                                    title="Gemini API Key đang hoạt động. Nhấn để thay đổi"
                                >
                                    <i className="fa-solid fa-bolt text-emerald-400"></i>
                                    <span>Gemini Flash Active</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 hover:bg-slate-700 transition"
                                    title="Nhập Gemini API Key để kích hoạt AI bóc tách trực tiếp"
                                >
                                    <i className="fa-solid fa-key text-sky-400"></i>
                                    <span>Cài đặt Gemini Key</span>
                                </button>
                            )}"""

if old_header_controls in html:
    html = html.replace(old_header_controls, new_header_controls, 1)
    print("Added Gemini API Key button to header controls.")

# 4. Add Settings Modal JSX before </header>
settings_modal_jsx = """
                    {/* Gemini API Key Configuration Modal */}
                    {isSettingsOpen && (
                        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-key text-sky-400"></i>
                                        <h3 className="font-bold text-white text-sm">Cài đặt Gemini API Key (Tier 1 AI)</h3>
                                    </div>
                                    <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Khóa API dùng để kích hoạt mô hình <strong>Gemini 1.5 Flash</strong> tự động bóc tách đề bài toán học thành kịch bản JSON dựng hình cho JSXGraph.
                                </p>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                        VITE_GEMINI_API_KEY
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKeyInput}
                                        onChange={(e) => setApiKeyInput(e.target.value)}
                                        placeholder="Dán Gemini API Key của bạn (AIzaSy...)"
                                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 outline-none focus:border-sky-500 font-mono"
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setApiKeyInput('');
                                            localStorage.removeItem('padlet_gemini_api_key');
                                            if (window.ENV) window.ENV.VITE_GEMINI_API_KEY = '';
                                            setIsSettingsOpen(false);
                                        }}
                                        className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                                    >
                                        Xóa khóa API
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsSettingsOpen(false)}
                                            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const trimmed = apiKeyInput.trim();
                                                if (trimmed) {
                                                    localStorage.setItem('padlet_gemini_api_key', trimmed);
                                                    if (window.ENV) window.ENV.VITE_GEMINI_API_KEY = trimmed;
                                                } else {
                                                    localStorage.removeItem('padlet_gemini_api_key');
                                                    if (window.ENV) window.ENV.VITE_GEMINI_API_KEY = '';
                                                }
                                                setIsSettingsOpen(false);
                                            }}
                                            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition shadow-sm"
                                        >
                                            Lưu cấu hình
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
"""

if "{isSettingsOpen && (" not in html:
    html = html.replace("</header>", "</header>\n" + settings_modal_jsx, 1)
    print("Added Gemini Settings Modal JSX.")

# 5. Add AI Status Banner under chat bar
status_banner_jsx = """
                    {/* Animated AI Status Banner */}
                    {aiStatusMsg && (
                        <div className="px-6 py-2 bg-sky-950/40 border-b border-sky-800/40 flex items-center justify-between text-xs text-sky-300 animate-fadeIn">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-spinner fa-spin text-sky-400"></i>
                                <span>{aiStatusMsg}</span>
                            </div>
                            <button onClick={() => setAiStatusMsg('')} className="text-slate-400 hover:text-white text-xs">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    )}
"""

chat_bar_end = '                    </div>\n\n                    {/* Main Content Area */}'
if "{aiStatusMsg && (" not in html and chat_bar_end in html:
    html = html.replace(chat_bar_end, '                    </div>' + status_banner_jsx + '\n                    {/* Main Content Area */}', 1)
    print("Added AI Status Banner under chat bar.")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)
print("Successfully patched react_geometry_app.html part 2!")
