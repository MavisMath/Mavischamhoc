import React, { useState } from 'react';
import { callGeminiMathAgent } from '../../services/geminiService';
import { AgentMathResponse, AIExecutionMode } from '../../types/agent';

interface MathAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyResult: (result: AgentMathResponse, mode: AIExecutionMode) => void;
}

export const MathAgentDrawer: React.FC<MathAgentDrawerProps> = ({
  isOpen,
  onClose,
  onApplyResult
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AIExecutionMode>('direct');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callGeminiMathAgent(prompt.trim(), mode);
      onApplyResult(result, mode);
      setPrompt('');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi giải toán qua AI');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="absolute top-0 right-0 h-full w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      <!-- Header -->
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500 text-white flex items-center justify-center font-bold">
            <i className="fa-solid fa-robot"></i>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">MathBoard AI Agent</h3>
            <span className="text-[10px] text-pink-600 font-semibold">Gemini 2.0 / Flash Compiler</span>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Mode Selector -->
      <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium">Chế độ xuất:</span>
        <button
          onClick={() => setMode('direct')}
          className={`px-2.5 py-1 rounded-md font-semibold ${mode === 'direct' ? 'bg-pink-600 text-white shadow-xs' : 'bg-white text-slate-700'}`}
        >
          🖌️ Vẽ bảng
        </button>
        <button
          onClick={() => setMode('hybrid')}
          className={`px-2.5 py-1 rounded-md font-semibold ${mode === 'hybrid' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700'}`}
        >
          🔀 Song song
        </button>
        <button
          onClick={() => setMode('card')}
          className={`px-2.5 py-1 rounded-md font-semibold ${mode === 'card' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700'}`}
        >
          📑 Thẻ Card
        </button>
      </div>

      <!-- Content Area -->
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
        <div className="p-3 bg-pink-50 rounded-xl border border-pink-200 text-pink-900 leading-relaxed">
          👋 Nhập đề bài hình học (ví dụ: <i>Cho đường tròn (O), 2 tiếp tuyến AB, AC...</i>) hoặc bài toán đại số. AI sẽ tự động phân tích và dựng hình học động trực tiếp lên bảng!
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
            ⚠️ {error}
          </div>
        )}
      </div>

      <!-- Input Form -->
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-white">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Nhập yêu cầu hoặc dán đề bài toán vào đây..."
            rows={3}
            className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-pink-500 outline-none text-xs"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="mt-2 w-full py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
            <span>{loading ? 'Đang phân tích & dựng hình...' : 'Thực thi vẽ toán học'}</span>
          </button>
        </div>
      </form>
    </aside>
  );
};
