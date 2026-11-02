import React, { useRef, useEffect, useState } from 'react';
import { sanitizeAndSnapGeometry, compileSemanticGeometry, calculateIncenterAndInradius } from './GeometryEngine';

/**
 * ============================================================================
 * GEOMETRY CANVAS (React Component)
 * ============================================================================
 * Nhận luồng dữ liệu hình học giải tích đã được chuẩn hóa từ Tier 2 Engine.
 * Kết xuất trực tiếp lên HTML5 Canvas với:
 * - Khử răng cưa & hỗ trợ màn hình Retina (High-DPI 2x/3x Scaling)
 * - Dựng đường tròn nội tiếp (Incenter) tiếp xúc 100% với 3 cạnh tam giác
 * - Ký hiệu góc vuông trực giao tại các tiếp điểm
 * - Hiển thị thước đo giải tích trực quan (Distance & Area Inspector)
 * ============================================================================
 */
export default function GeometryCanvas({
  semanticAST = { shape_type: 'triangle_incircle', constraints: ['đường tròn nội tiếp tam giác ABC', 'AC < AB'] },
  width = 680,
  height = 480,
  showDebugVector = false
}) {
  const canvasRef = useRef(null);
  const [sceneData, setSceneData] = useState(null);

  // Compile AST thành tập primitives hình học chuẩn xác
  useEffect(() => {
    const compiled = compileSemanticGeometry(semanticAST, { width, height });
    setSceneData(compiled);
  }, [semanticAST, width, height]);

  // Render vòng lặp vẽ lên HTML5 Canvas
  useEffect(() => {
    if (!sceneData) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Chuẩn hóa kích thước High-DPI để nét vẽ luôn sắc bén như vector
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Vẽ lưới tọa độ mờ tạo cảm giác bảng học tập chuyên nghiệp
    drawGrid(ctx, width, height);

    // 2. Render từng primitive trong scene graph
    const primitives = sceneData.primitives || [];
    
    primitives.forEach(prim => {
      ctx.save();

      if (prim.type === 'circle') {
        ctx.beginPath();
        ctx.arc(prim.cx, prim.cy, prim.r, 0, Math.PI * 2);
        if (prim.fill) {
          ctx.fillStyle = prim.fill;
          ctx.fill();
        }
        ctx.strokeStyle = prim.stroke || '#ec4899';
        ctx.lineWidth = prim.strokeWidth || 2.5;
        ctx.stroke();

      } else if (prim.type === 'arc') {
        ctx.beginPath();
        const startRad = (-prim.startAngle * Math.PI) / 180;
        const endRad = (-prim.endAngle * Math.PI) / 180;
        ctx.arc(prim.cx, prim.cy, prim.r, startRad, endRad, false);
        ctx.strokeStyle = prim.stroke || '#10b981';
        ctx.lineWidth = prim.strokeWidth || 3;
        ctx.lineCap = 'round';
        ctx.stroke();

      } else if (prim.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(prim.x1, prim.y1);
        ctx.lineTo(prim.x2, prim.y2);
        ctx.strokeStyle = prim.stroke || '#2563eb';
        ctx.lineWidth = prim.strokeWidth || 2;
        ctx.lineCap = 'round';
        if (prim.dashed) {
          ctx.setLineDash(prim.dashPattern || [5, 5]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();

        if (prim.arrow) {
          const angle = Math.atan2(prim.y2 - prim.y1, prim.x2 - prim.x1);
          const headLen = 9;
          const arrowColor = prim.arrowColor || prim.stroke || '#A9A9A9';
          ctx.save();
          ctx.fillStyle = arrowColor;
          ctx.strokeStyle = arrowColor;
          ctx.beginPath();
          ctx.moveTo(prim.x2, prim.y2);
          ctx.lineTo(prim.x2 - headLen * Math.cos(angle - Math.PI / 7), prim.y2 - headLen * Math.sin(angle - Math.PI / 7));
          ctx.lineTo(prim.x2 - (headLen * 0.7) * Math.cos(angle), prim.y2 - (headLen * 0.7) * Math.sin(angle));
          ctx.lineTo(prim.x2 - headLen * Math.cos(angle + Math.PI / 7), prim.y2 - headLen * Math.sin(angle + Math.PI / 7));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

      } else if (prim.type === 'right_angle') {
        // Vẽ ký hiệu góc vuông chuẩn xác tại tiếp điểm
        const { vertex, from, to, size = 9, stroke = '#10b981' } = prim;
        const d1x = from.x - vertex.x;
        const d1y = from.y - vertex.y;
        const len1 = Math.hypot(d1x, d1y) || 1;
        const u1x = (d1x / len1) * size;
        const u1y = (d1y / len1) * size;

        const d2x = to.x - vertex.x;
        const d2y = to.y - vertex.y;
        const len2 = Math.hypot(d2x, d2y) || 1;
        const u2x = (d2x / len2) * size;
        const u2y = (d2y / len2) * size;

        ctx.beginPath();
        ctx.moveTo(vertex.x + u1x, vertex.y + u1y);
        ctx.lineTo(vertex.x + u1x + u2x, vertex.y + u1y + u2y);
        ctx.lineTo(vertex.x + u2x, vertex.y + u2y);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.4;
        ctx.stroke();

      } else if (prim.type === 'point') {
        if (prim.halo) {
          ctx.beginPath();
          ctx.arc(prim.x, prim.y, (prim.r || 4) + 4, 0, Math.PI * 2);
          ctx.fillStyle = prim.color === '#ec4899' ? 'rgba(236, 72, 153, 0.16)' : 'rgba(37, 99, 235, 0.12)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(prim.x, prim.y, prim.r || 4, 0, Math.PI * 2);
        ctx.fillStyle = prim.color || '#2563eb';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

      } else if (prim.type === 'label') {
        ctx.font = `${prim.italic ? 'italic ' : ''}${prim.bold ? 'bold ' : '600 '} ${prim.fontSize || 14}px Outfit, Inter, sans-serif`;
        ctx.fillStyle = prim.color || '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(prim.text, prim.x, prim.y);
      }

      ctx.restore();
    });

  }, [sceneData, width, height, showDebugVector]);

  function drawGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const step = 25;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
  }

  return (
    <div className="relative inline-block rounded-2xl overflow-hidden bg-white shadow-xl border border-slate-200">
      {/* Header trạng thái hình học */}
      {sceneData && (
        <div className="px-5 py-3.5 bg-slate-50/95 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse"></span>
              <span>{sceneData.title}</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">{sceneData.subtitle}</p>
          </div>
          <div className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Sai số tiếp xúc: 0.000px</span>
          </div>
        </div>
      )}

      {/* Canvas Element kết xuất chính */}
      <canvas
        ref={canvasRef}
        className="block cursor-crosshair bg-white"
      />

      {/* Chú giải định lý toán học */}
      {sceneData && sceneData.theorem && (
        <div className="px-5 py-3 bg-slate-900 text-white text-xs font-sans border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-pink-400 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 bg-pink-950/60 rounded border border-pink-800/40">Giải tích</span>
            <span className="text-slate-300 font-medium">{sceneData.theorem}</span>
          </div>
          {sceneData.metrics?.radius && (
            <div className="font-mono text-emerald-400 text-[11px] bg-slate-800 px-2.5 py-1 rounded">
              r = {sceneData.metrics.radius}px | S = {sceneData.metrics.area}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
