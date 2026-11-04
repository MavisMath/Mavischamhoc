/**
 * MathBoard AI - Google Gemini Geometry & Math Compiler Service
 * Translates natural language math problems into structured Dynamic Geometry JSON (JSXGraph 2D & Three.js 3D).
 */

import { AgentMathResponse, AIExecutionMode } from '../types/agent';
import { DynamicGeometrySpec } from '../types/geometry';

export const CANDIDATE_GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash'
];

export const GEMINI_SYSTEM_INSTRUCTION = `Bạn là MathBoard AI - Trình giải toán & Biên dịch hình học động (Dynamic Geometry & Math Compiler) hàng đầu.
Nhiệm vụ: nhận câu hỏi, bài toán hoặc yêu cầu dựng hình và trả về DUY NHẤT một chuỗi JSON thuần túy (không bọc markdown, không output text ngoài JSON).

CẤU TRÚC JSON BẮT BUỘC:
{
  "title": "Tiêu đề ngắn gọn kèm emoji",
  "cardType": "2d" | "3d" | "algebra",
  "shapeType": "square" | "rectangle" | "triangle" | "circle" | "quadrilateral" | "trapezoid" | "pyramid3d" | "cube3d" | "parabola" | "custom",
  "explanation": "Lời giải toán học chi tiết, chuẩn xác, sư phạm bằng tiếng Việt có công thức LaTeX ($...$).",
  "mathSummary": "Tóm tắt công thức hoặc hệ thức chính ($$...$$)",
  "boundingbox": [-7, 5.5, 7, -5.5],
  "axis": false,
  "grid": false,
  "steps": [ ... mảng các bước dựng hình JSXGraph 2D ... ]
}

QUY TẮC DỰNG HÌNH JSXGRAPH TRONG "steps":
1. BẢO ĐẢM TÍNH TOÀN VẸN & CHÍNH XÁC TUYỆT ĐỐI THEO ĐỀ BÀI:
   - TẤT CẢ các điểm xuất hiện trong đề bài (kể cả giao điểm, tiếp điểm, hình chiếu, chân đường vuông góc...) BẮT BUỘC PHẢI CÓ trong mảng "steps" với tên "name" và "id" tương ứng!
   - Kẻ đầy đủ các đoạn thẳng/đường thẳng liên quan đến giả thiết và kết luận. Các đường phụ dùng nét đứt ("dash": 2).
   - Đánh dấu góc vuông nếu có ("angle" với "rightAngle": true).

2. TÍNH TOÁN TỌA ĐỘ CHUẨN XÁC:
   - Đường tròn (O; R): tâm O(0,0), bán kính R khoảng 2.5 - 3.5.
   - Tiếp tuyến từ A ngoài đường tròn: tiếp điểm B, C thỏa mãn OB ⊥ AB, OC ⊥ AC.
   - Boundingbox: tính toán bao quát tất cả các điểm cộng lề 1.5 đơn vị.

CÁC LOẠI PHẦN TỬ HỢP LỆ TRONG "steps":
- "point": id, coords ([x, y]), name, color
- "segment": id, points ([id1, id2]), color, width, dash (0 hoặc 2)
- "line": id, points ([id1, id2]), color, dash
- "polygon": id, points ([id1, id2, id3, ...]), fillColor, strokeColor
- "angle": id, points ([p1, vertex, p2]), rightAngle (boolean)
- "circle": id, center (id), radius (number) hoặc point (id)
- "intersection": id, objects ([obj1_id, obj2_id]), name
- "functiongraph": id, fn (string biểu thức js như "x*x - 4*x + 3"), range ([-10, 10])

TUYỆT ĐỐI CHỈ TRẢ VỀ JSON HỢP LỆ THEO SCHEMA TRÊN. KHÔNG GIẢI THÍCH THÊM BÊN NGOÀI JSON.`;

/**
 * Sanitizes JSON containing unescaped LaTeX backslashes (\widehat, \cdot, \Delta, \perp...)
 */
export function robustFixJson(s: string): string {
  if (!s || typeof s !== 'string') return s;
  const out: string[] = [];
  let inString = false;
  let i = 0;
  const n = s.length;

  while (i < n) {
    const ch = s[i];
    if (ch === '"') {
      let slashCount = 0;
      let k = i - 1;
      while (k >= 0 && s[k] === '\\') {
        slashCount++;
        k--;
      }
      if (slashCount % 2 === 0) {
        inString = !inString;
      }
      out.push(ch);
      i++;
    } else if (inString && ch === '\\') {
      if (i + 1 < n) {
        const nxt = s[i + 1];
        if (nxt === '\\') {
          out.push('\\\\');
          i += 2;
        } else if (nxt === '"' || nxt === '/' || nxt === 'b' || nxt === 'f' || nxt === 'n' || nxt === 'r' || nxt === 't') {
          out.push('\\' + nxt);
          i += 2;
        } else if (nxt === 'u' && i + 5 < n && /^[0-9a-fA-F]{4}$/.test(s.substring(i + 2, i + 6))) {
          out.push(s.substring(i, i + 6));
          i += 6;
        } else {
          out.push('\\\\');
          i++;
        }
      } else {
        out.push('\\\\');
        i++;
      }
    } else {
      out.push(ch);
      i++;
    }
  }
  return out.join('');
}

export function extractGeminiResultSafely(rawText: string, fallbackPrompt: string): AgentMathResponse | null {
  if (!rawText) return null;
  let cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const tryParse = (str: string): any => {
    try {
      return JSON.parse(str);
    } catch {
      try {
        return JSON.parse(robustFixJson(str));
      } catch {
        return null;
      }
    }
  };

  let parsed: any = null;
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    parsed = tryParse(cleaned.substring(firstBrace, lastBrace + 1));
  }
  if (!parsed) {
    parsed = tryParse(cleaned);
  }
  if (!parsed) return null;

  const steps = Array.isArray(parsed.steps) ? parsed.steps : (Array.isArray(parsed.construction) ? parsed.construction : []);

  const rawRes: AgentMathResponse = {
    title: parsed.title || `📐 ${fallbackPrompt.substring(0, 30)}...`,
    shapeType: parsed.shapeType || 'custom',
    cardType: parsed.cardType || (steps.length > 0 ? '2d' : 'algebra'),
    explanation: parsed.explanation || 'Đã phân tích toán học chi tiết qua Gemini AI.',
    mathSummary: parsed.mathSummary || (steps.length > 0 ? `$$\\text{Mô hình hình học động JSXGraph: } ${steps.length} \\text{ phần tử}$$` : ''),
    steps,
    axis: parsed.axis ?? false,
    grid: parsed.grid ?? false,
    boundingbox: parsed.boundingbox || [-7, 5.5, 7, -5.5]
  };

  return autoCorrectGeometricConstraints(rawRes, fallbackPrompt);
}

/**
 * Geometric Constraint Solver & Auto-Corrector
 * Solves and normalizes coordinates mathematically using Euclidean analytical geometry.
 */
export function autoCorrectGeometricConstraints(
  agentResult: AgentMathResponse,
  promptText: string
): AgentMathResponse {
  if (!agentResult || !agentResult.steps || !Array.isArray(agentResult.steps)) return agentResult;
  const lower = (promptText || '').toLowerCase().replace(/\s+/g, ' ');

  const projectPointOnLine = (P: number[], A: number[], B: number[]): number[] => {
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const d2 = dx * dx + dy * dy;
    if (d2 === 0) return [A[0], A[1]];
    const t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / d2;
    return [A[0] + t * dx, A[1] + t * dy];
  };

  const reflectPoint = (P: number[], Center: number[]): number[] => [2 * Center[0] - P[0], 2 * Center[1] - P[1]];
  const midpoint = (A: number[], B: number[]): number[] => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const getPt = (id: string) => agentResult.steps.find((s: any) => s && s.type === 'point' && (s.id === id || s.name === id)) as any;

  // 1. Right Triangle at A with Altitude AH (and AB < AC)
  const isTriRightAtA = (lower.includes('tam giác') || lower.includes('△')) && 
                        (lower.includes('vuông tại a') || lower.includes('vuông ở a') || (lower.includes('tam giác abc') && lower.includes('vuông') && lower.includes('a')));
  const hasAbLessThanAc = lower.includes('ab < ac') || lower.includes('ab<ac') || lower.includes('ac > ab') || lower.includes('ac>ab');
  const hasAltitudeAH = lower.includes('đường cao ah') || lower.includes('ah vuông góc') || lower.includes('ah perp bc') || lower.includes('ah ⊥ bc');

  if (isTriRightAtA && hasAltitudeAH) {
    const xB = -4.0, yB = -2.0;
    const xC = 5.0, yC = -2.0;
    const bh = hasAbLessThanAc ? 2.5 : 4.5;
    const ch = hasAbLessThanAc ? 6.5 : 4.5;
    const xH = xB + bh;
    const yH = yB;
    const ahLen = Math.sqrt(bh * ch);
    const xA = xH;
    const yA = yH + ahLen;

    const pA = getPt('A'); if (pA) pA.coords = [xA, yA];
    const pB = getPt('B'); if (pB) pB.coords = [xB, yB];
    const pC = getPt('C'); if (pC) pC.coords = [xC, yC];
    const pH = getPt('H'); if (pH) pH.coords = [xH, yH];

    const pD = getPt('D');
    if (pD && (lower.includes('đối xứng') || lower.includes('d là điểm'))) {
      pD.coords = reflectPoint([xA, yA], [xH, yH]);
    }

    const pE = getPt('E');
    if (pE && (lower.includes('he perp ab') || lower.includes('he vuông góc') || lower.includes('tại e') || lower.includes('he ⊥ ab') || lower.includes('he perp'))) {
      pE.coords = projectPointOnLine([xH, yH], [xA, yA], [xB, yB]);
    }

    const pF = getPt('F');
    if (pF && (lower.includes('hf perp ac') || lower.includes('hf vuông góc') || lower.includes('tại f') || lower.includes('hf ⊥ ac') || lower.includes('hf perp'))) {
      pF.coords = projectPointOnLine([xH, yH], [xA, yA], [xC, yC]);
    }

    const pI = getPt('I');
    if (pI && (lower.includes('trung điểm') || lower.includes('i là trung điểm'))) {
      pI.coords = midpoint([xH, yH], [xC, yC]);
    }

    const minY = pD ? Math.min(-7.5, pD.coords[1] - 1.2) : -3.5;
    const maxY = Math.max(5.0, yA + 1.2);
    agentResult.boundingbox = [-6.5, maxY, 7.0, minY];

    agentResult.steps.forEach((s: any) => {
      if (s && s.type === 'angle' && s.rightAngle) {
        s.fillOpacity = 0.05;
        s.fillColor = 'transparent';
        s.radius = 0.45;
      }
    });
  }

  return agentResult;
}
}

export async function callGeminiMathAgent(
  prompt: string,
  mode: AIExecutionMode = 'direct',
  customApiKey?: string
): Promise<AgentMathResponse> {
  const apiKey = customApiKey || (typeof window !== 'undefined' && (window as any).DEFAULT_GEMINI_API_KEY) || '';
  if (!apiKey) {
    throw new Error('Chưa cấu hình Google Gemini API Key.');
  }

  let lastError: string | null = null;

  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${response.status}`;
        lastError = `[${model}]: ${msg}`;
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const result = extractGeminiResultSafely(rawText, prompt);
        if (result) return result;
      }
    } catch (err: any) {
      lastError = `[${model}]: ${err.message || String(err)}`;
    }
  }

  throw new Error(lastError || 'Không thể nhận phản hồi từ Gemini API.');
}
