import React, { useEffect, useRef } from 'react';

/**
 * ============================================================================
 * TIER 2: COMPONENT DYNAMIC GEOMETRY CARD (React 18 & JSXGraph)
 * ============================================================================
 * Kiến trúc tách biệt hoàn toàn (Decoupled Architecture):
 * - AI Chatbot (Tier 1): Chỉ bóc tách JSON và cập nhật State (setCards). Tuyệt đối KHÔNG thao tác DOM.
 * - DynamicGeometryCard (Tier 2): Tự chịu trách nhiệm gắn kết vòng đời React với bảng vẽ JSXGraph.
 * 
 * Luồng thực thi chuẩn:
 * 1. Đầu useEffect, bắt buộc kiểm tra `if (!boardRef.current) return;`
 * 2. Khởi tạo bảng vẽ dùng chính ID động `jxgbox-${card.id}` hoặc tham chiếu `boardRef.current`.
 * 3. Đọc dữ liệu JSON từ `props.card.data` và truyền vào hàm `renderDynamicGeometry(board, steps)`.
 * 4. Trả về hàm cleanup gọi `JXG.JSXGraph.freeBoard(board)` khi component unmount hoặc re-render.
 */

/**
 * Hàm biên dịch dựng hình Tier 2 (Geometry Compiler)
 * Ánh xạ mảng declarative JSON steps vào API của bảng vẽ JSXGraph
 */
export function renderDynamicGeometry(board, steps = []) {
    if (!board || !Array.isArray(steps)) return new Map();

    const registry = new Map();
    const resolve = (ref) => {
        if (!ref) return null;
        if (typeof ref === 'string') {
            if (registry.has(ref)) return registry.get(ref);
            for (const [k, v] of registry.entries()) {
                if (v && v.name === ref) return v;
            }
            return ref;
        }
        if (Array.isArray(ref)) return ref.map(r => resolve(r));
        return ref;
    };

    const defaultPointColor = '#38bdf8';
    const defaultLineColor = '#60a5fa';
    const defaultCircleColor = '#f43f5e';
    const defaultHighlightColor = '#fbbf24';

    board.suspendUpdate();

    steps.forEach((step, index) => {
        if (!step || !step.type) return;
        const stepId = step.id || step.name || `step_${index}`;

        try {
            let createdObj = null;

            switch (step.type.toLowerCase()) {
                // 1. Điểm tự do (Free Point)
                case 'point': {
                    const coords = step.coords || [(Math.random() * 6 - 3), (Math.random() * 6 - 3)];
                    createdObj = board.create('point', coords, {
                        name: step.name || step.id || '',
                        size: step.size || 4,
                        strokeColor: '#ffffff',
                        fillColor: step.color || defaultPointColor,
                        highlightFillColor: defaultHighlightColor,
                        fixed: step.fixed === true || step.isFree === false,
                        visible: step.visible !== false
                    });
                    break;
                }

                // 2. Điểm trượt ràng buộc trên đối tượng hình học (Glider)
                case 'glider': {
                    const targetObj = resolve(step.target || step.on);
                    const coords = step.coords || [0, 0];
                    if (targetObj) {
                        createdObj = board.create('glider', [coords[0], coords[1], targetObj], {
                            name: step.name || step.id || '',
                            size: step.size || 4.5,
                            strokeColor: '#ffffff',
                            fillColor: step.color || defaultCircleColor,
                            highlightFillColor: defaultHighlightColor,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 3. Đoạn thẳng (Segment)
                case 'segment': {
                    const pts = resolve(step.points || [step.p1, step.p2]);
                    if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                        createdObj = board.create('segment', pts, {
                            name: step.name || '',
                            strokeColor: step.color || defaultLineColor,
                            strokeWidth: step.width || 2.4,
                            dash: step.dash || 0,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 4. Tia (Ray)
                case 'ray': {
                    const pts = resolve(step.points || [step.point1, step.point2]);
                    if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                        createdObj = board.create('ray', [pts[0], pts[1]], {
                            name: step.name || '',
                            strokeColor: step.color || defaultLineColor,
                            strokeWidth: step.width || 2
                        });
                    }
                    break;
                }

                // 5. Đường thẳng vô tận (Line)
                case 'line': {
                    const pts = resolve(step.points || [step.p1, step.p2]);
                    if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                        createdObj = board.create('line', pts, {
                            name: step.name || '',
                            strokeColor: step.color || defaultLineColor,
                            strokeWidth: step.width || 1.8,
                            dash: step.dash || 0,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 6. Trung điểm (Midpoint)
                case 'midpoint': {
                    const pts = resolve(step.points || [step.p1, step.p2]);
                    if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                        createdObj = board.create('midpoint', pts, {
                            name: step.name || '',
                            size: 3.5,
                            fillColor: step.color || '#10b981',
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 7. Đường vuông góc (Perpendicular)
                case 'perpendicular': {
                    const baseLine = resolve(step.base || step.line);
                    const pt = resolve(step.point || step.through);
                    if (baseLine && pt) {
                        createdObj = board.create('perpendicular', [baseLine, pt], {
                            name: step.name || '',
                            strokeColor: step.color || '#94a3b8',
                            strokeWidth: step.width || 1.6,
                            dash: step.dash || 2,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 8. Đường song song (Parallel)
                case 'parallel': {
                    const baseLine = resolve(step.base || step.line);
                    const pt = resolve(step.point || step.through);
                    if (baseLine && pt) {
                        createdObj = board.create('parallel', [baseLine, pt], {
                            name: step.name || '',
                            strokeColor: step.color || '#94a3b8',
                            strokeWidth: step.width || 1.6,
                            dash: step.dash || 2,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 9. Đường phân giác (Bisector)
                case 'bisector': {
                    const pts = resolve(step.points || [step.p1, step.vertex, step.p2]);
                    if (pts && pts.length >= 3 && pts[0] && pts[1] && pts[2]) {
                        createdObj = board.create('bisector', pts, {
                            name: step.name || '',
                            strokeColor: step.color || '#f59e0b',
                            strokeWidth: 1.8,
                            dash: 2,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 10. Đường trung trực (Perpendicular Bisector)
                case 'perpendicularbisector': {
                    const pts = resolve(step.points || [step.p1, step.p2]);
                    if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                        createdObj = board.create('perpendicularbisector', pts, {
                            name: step.name || '',
                            strokeColor: step.color || '#94a3b8',
                            strokeWidth: 1.8,
                            dash: 2,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 7. Giao điểm của 2 đối tượng (Intersection)
                case 'intersection': {
                    const objs = resolve(step.objects || [step.obj1, step.obj2]);
                    const idx = step.index !== undefined ? step.index : 0;
                    if (objs && objs.length >= 2 && objs[0] && objs[1]) {
                        createdObj = board.create('intersection', [objs[0], objs[1], idx], {
                            name: step.name || '',
                            size: step.size || 4,
                            strokeColor: '#ffffff',
                            fillColor: step.color || '#10b981',
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 8. Đường tròn (Circle)
                case 'circle': {
                    const center = resolve(step.center || step.p1);
                    const pt = resolve(step.point || step.through || step.p2);
                    const radius = step.radius;

                    if (center && pt) {
                        createdObj = board.create('circle', [center, pt], {
                            name: step.name || '',
                            strokeColor: step.color || defaultCircleColor,
                            strokeWidth: step.width || 2.4,
                            dash: step.dash || 0,
                            fillColor: step.fillColor || 'none',
                            fillOpacity: step.fillOpacity || 0,
                            visible: step.visible !== false
                        });
                    } else if (center && typeof radius === 'number') {
                        createdObj = board.create('circle', [center, radius], {
                            name: step.name || '',
                            strokeColor: step.color || defaultCircleColor,
                            strokeWidth: step.width || 2.4,
                            dash: step.dash || 0,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 9. Đường tròn ngoại tiếp tam giác 3 đỉnh (Circumcircle)
                case 'circumcircle': {
                    const pts = resolve(step.points || [step.p1, step.p2, step.p3]);
                    if (pts && pts.length >= 3 && pts[0] && pts[1] && pts[2]) {
                        createdObj = board.create('circumcircle', pts, {
                            strokeColor: step.color || defaultCircleColor,
                            strokeWidth: step.width || 2.4,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 10. Đường tròn nội tiếp tam giác 3 đỉnh (Incircle)
                case 'incircle': {
                    const pts = resolve(step.points || [step.p1, step.p2, step.p3]);
                    if (pts && pts.length >= 3 && pts[0] && pts[1] && pts[2]) {
                        createdObj = board.create('incircle', pts, {
                            strokeColor: step.color || '#10b981',
                            strokeWidth: step.width || 2.2,
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 11. Đa giác (Polygon)
                case 'polygon': {
                    const pts = resolve(step.points || step.vertices);
                    if (pts && pts.length >= 3 && pts.every(p => p !== null)) {
                        createdObj = board.create('polygon', pts, {
                            fillColor: step.fillColor || defaultPointColor,
                            fillOpacity: step.fillOpacity !== undefined ? step.fillOpacity : 0.12,
                            borders: {
                                strokeColor: step.strokeColor || defaultLineColor,
                                strokeWidth: step.strokeWidth || 2.2
                            },
                            visible: step.visible !== false
                        });
                    }
                    break;
                }

                // 12. Góc & Ký hiệu góc vuông (Angle)
                case 'angle': {
                    const pts = resolve(step.points || [step.p1, step.vertex, step.p2]);
                    if (pts && pts.length >= 3 && pts[0] && pts[1] && pts[2]) {
                        const isRight = step.rightAngle === true || step.name === '90°';
                        createdObj = board.create('angle', pts, {
                            type: isRight ? 'right' : (step.angleType || 'sector'),
                            orthoType: 'square',
                            orthoSensitivity: 1.0,
                            radius: step.radius || 0.8,
                            fillColor: isRight ? '#f43f5e' : '#f59e0b',
                            fillOpacity: 0.2,
                            strokeColor: isRight ? '#f43f5e' : '#d97706',
                            strokeWidth: 1.8,
                            name: isRight ? '' : (step.label || '')
                        });
                    }
                    break;
                }

                // 15. Tiếp tuyến (Tangent)
                case 'tangent': {
                    const pt = resolve(step.point || step.glider);
                    const circ = resolve(step.circle);
                    if (pt && circ) {
                        createdObj = board.create('tangent', [pt, circ], {
                            strokeColor: step.color || defaultLineColor,
                            strokeWidth: 2
                        });
                    }
                    break;
                }

                // 16. Ký hiệu vạch bằng nhau trên đoạn thẳng (Ticks)
                case 'ticks': {
                    const targetObj = resolve(step.segment || step.target || step.line);
                    const count = step.count || step.num || 1;
                    if (targetObj) {
                        createdObj = board.create('ticks', [targetObj, count], {
                            strokeColor: step.color || defaultLineColor,
                            strokeWidth: step.width || 1.8,
                            tickEndings: [0.5, 0.5]
                        });
                    }
                    break;
                }

                // 17. Đồ thị hàm số (Functiongraph / Parabola)
                case 'functiongraph':
                case 'curve': {
                    let fn = null;
                    if (typeof step.fn === 'function') {
                        fn = step.fn;
                    } else if (typeof step.fn === 'string') {
                        try { fn = new Function('x', `return ${step.fn};`); } catch (e) {}
                    }
                    if (fn) {
                        createdObj = board.create('functiongraph', [fn, step.range ? step.range[0] : -10, step.range ? step.range[1] : 10], {
                            strokeColor: step.color || '#ec4899',
                            strokeWidth: step.width || 2.5
                        });
                    }
                    break;
                }

                // 14. Nhãn văn bản (Text)
                case 'text': {
                    const coords = step.coords || [0, 0];
                    createdObj = board.create('text', [coords[0], coords[1], step.text || ''], {
                        fontSize: step.fontSize || 13,
                        strokeColor: step.color || '#f8fafc'
                    });
                    break;
                }

                default:
                    break;
            }

            if (createdObj) registry.set(stepId, createdObj);
        } catch (err) {
            console.error(`[JSXGraph] Lỗi dựng bước ${stepId}:`, err);
        }
    });

    board.unsuspendUpdate();
    board.update();
    return registry;
}

/**
 * DynamicGeometryCard Component
 * Hiển thị thẻ bài hình học động hoàn toàn khép kín, an toàn tuyệt đối với State bất đồng bộ
 */
export const DynamicGeometryCard = ({
    card,
    onDelete,
    onTogglePin,
    onSelect,
    isSelected = false
}) => {
    // [Nhiệm vụ 3]: Tạo tham chiếu DOM với useRef
    const boardRef = useRef(null);
    const boardInstanceRef = useRef(null);
    const dynamicBoxId = `jxgbox-${card.id}`;

    // Lấy dữ liệu bài toán từ props.card.data
    const geomData = card.data || {};
    const steps = geomData.steps || card.steps || [];
    const options = geomData.options || card.options || {};
    const title = geomData.title || card.title || 'Thẻ bài hình học';
    const formula = geomData.formula || card.formula || '';
    const desc = geomData.desc || card.desc || '';

    // [Nhiệm vụ 3 & 4]: Khởi tạo an toàn với useEffect & Dependency Array chứa dữ liệu JSON
    useEffect(() => {
        // 1. Đầu useEffect, bắt buộc kiểm tra if (!boardRef.current) return;
        if (!boardRef.current) return;

        // Dọn dẹp bảng cũ nếu đã tồn tại để tránh duplicate listeners & memory leaks
        if (boardInstanceRef.current) {
            try {
                const b = boardInstanceRef.current;
                if (b.resizeObserver) try { b.resizeObserver.disconnect(); } catch (e) {}
                b.resizeContainer = function() {};
                b.updateContainerDims = function() {};
                if (window.JXG && window.JXG.JSXGraph && typeof window.JXG.JSXGraph.freeBoard === 'function') {
                    window.JXG.JSXGraph.freeBoard(b);
                }
            } catch (e) {
                console.warn(`[JSXGraph] Lỗi giải phóng bảng cũ "${dynamicBoxId}":`, e);
            }
            boardInstanceRef.current = null;
        }

        // Cấu hình bảng vẽ JSXGraph
        const defaultOptions = {
            boundingbox: options.boundingbox || [-7, 5.5, 7, -5.5],
            axis: options.axis !== undefined ? options.axis : false,
            grid: options.grid !== undefined ? options.grid : false,
            showNavigation: false,
            showCopyright: false,
            keepaspectratio: true,
            pan: { enabled: !card.isPinned, needShift: false },
            zoom: { factorX: 1.25, factorY: 1.25, wheel: !card.isPinned, needShift: false },
            ...options
        };

        // 2. Khởi tạo bảng vẽ dùng chính ID động hoặc tham chiếu DOM đó
        let board = null;
        try {
            board = window.JXG.JSXGraph.initBoard(boardRef.current || dynamicBoxId, defaultOptions);
            boardInstanceRef.current = board;
        } catch (initErr) {
            console.error(`[JSXGraph] Lỗi khởi tạo initBoard cho "${dynamicBoxId}":`, initErr);
            return;
        }

        // 3. Đọc dữ liệu JSON từ props.card.data và truyền vào hàm renderDynamicGeometry
        renderDynamicGeometry(board, steps);

        // 4. Trả về hàm cleanup gọi JXG.JSXGraph.freeBoard(board) khi component unmount hoặc re-render
        return () => {
            if (boardInstanceRef.current) {
                try {
                    const b = boardInstanceRef.current;
                    if (b.resizeObserver) try { b.resizeObserver.disconnect(); } catch (e) {}
                    b.resizeContainer = function() {};
                    b.updateContainerDims = function() {};
                    if (window.JXG && window.JXG.JSXGraph && typeof window.JXG.JSXGraph.freeBoard === 'function') {
                        window.JXG.JSXGraph.freeBoard(b);
                    }
                } catch (freeErr) {
                    console.warn(`[JSXGraph] Lỗi cleanup bảng "${dynamicBoxId}":`, freeErr);
                }
                boardInstanceRef.current = null;
            }
        };
    }, [card.id, JSON.stringify(card.data), card.isPinned]);

    return (
        <div 
            className={`rounded-2xl border transition-all flex flex-col overflow-hidden shadow-xl ${
                isSelected 
                    ? 'bg-slate-900 border-sky-500 ring-2 ring-sky-500/30' 
                    : card.isPinned 
                        ? 'bg-slate-900/90 border-amber-500/50 ring-1 ring-amber-500/20' 
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
        >
            {/* Header Thẻ bài */}
            <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60 select-none">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${card.isPinned ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'}`}></span>
                    <h3 className="text-xs font-bold text-white truncate" title={title}>
                        {title}
                    </h3>
                    {card.isPinned && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-1">
                            <i className="fa-solid fa-thumbtack text-[9px]"></i> Ghim
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {/* Nút Ghim (Pin Component) */}
                    {onTogglePin && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin(card.id);
                            }}
                            title={card.isPinned ? "Bỏ ghim (Mở khóa thao tác)" : "Ghim vị trí (Khóa kéo thả)"}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition text-xs ${
                                card.isPinned 
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                                    : 'hover:bg-slate-800 text-slate-400 hover:text-amber-400'
                            }`}
                        >
                            <i className="fa-solid fa-thumbtack"></i>
                        </button>
                    )}

                    {/* Nút Xem chi tiết */}
                    {onSelect && (
                        <button
                            onClick={() => onSelect(card.id)}
                            title="Xem chi tiết & Chỉnh sửa kịch bản"
                            className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-sky-400 flex items-center justify-center transition text-xs"
                        >
                            <i className="fa-solid fa-expand"></i>
                        </button>
                    )}

                    {/* Nút Xóa (Delete Callback) */}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(card.id);
                            }}
                            title="Xóa thẻ bài khỏi Dashboard"
                            className="w-7 h-7 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition text-xs"
                        >
                            <i className="fa-regular fa-trash-can"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Vùng Bảng vẽ JSXGraph: Gắn ref={boardRef} và id={dynamicBoxId} an toàn */}
            <div className="h-64 bg-slate-950 relative overflow-hidden">
                <div 
                    ref={boardRef} 
                    id={dynamicBoxId} 
                    className="jxgbox w-full h-full relative" 
                    style={{ minHeight: '100%', width: '100%', height: '100%' }}
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur-sm border border-slate-800 text-[10px] font-mono text-slate-400 pointer-events-none">
                    #{dynamicBoxId}
                </div>
            </div>

            {/* Footer Thẻ bài */}
            {(desc || formula) && (
                <div className="p-3 bg-slate-900/60 border-t border-slate-800/60 text-xs">
                    {desc && <div className="text-slate-400 text-[11px] line-clamp-1 mb-1">{desc}</div>}
                    {formula && <div className="text-sky-400 font-mono text-[11px] truncate">{formula}</div>}
                </div>
            )}
        </div>
    );
};

export default DynamicGeometryCard;
