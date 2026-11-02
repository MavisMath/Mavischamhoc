import React, { useEffect, useRef, useId } from 'react';

/**
 * DynamicGeometryBoard - React Component nhúng JSXGraph an toàn cho Dashboard / Padlet
 * 
 * Khắc phục triệt để lỗi: "Cannot read properties of null (reading 'addEventListener')"
 * khi nhiều widget sinh ra cùng lúc hoặc khi AI trả kết quả động.
 * 
 * 3 BẢN VÁ KIẾN TRÚC SENIOR:
 * 1. [Loại bỏ Hardcode ID]: Cấp phát ID động duy nhất `jxgbox-${card.id}` hoặc auto-generated ID,
 *    tuyệt đối không dùng chung một chuỗi tĩnh `id="jxgbox"`.
 * 2. [Kiểm soát Event Loop]: Đặt `initBoard` và logic vẽ trong `setTimeout(() => { ... }, 0)`
 *    hoặc `requestAnimationFrame` bên trong `useEffect` để ép trình duyệt hoàn tất paint DOM.
 * 3. [Phòng ngự chặt chẽ]: Kiểm tra trực tiếp `const box = document.getElementById(dynamicId); if (!box) return;`
 *    trước khi cho phép JSXGraph can thiệp.
 */
export const DynamicGeometryBoard = ({
    id, // Định danh duy nhất (ví dụ: `jxgbox-${card.id}`)
    steps = [],
    options = {},
    onBoardReady = null,
    onObjectUpdate = null,
    className = "w-full h-full relative",
    style = { minHeight: '360px', width: '100%', height: '100%' }
}) => {
    // 1. Loại bỏ Hardcode ID: Sinh ID động duy nhất nếu không truyền prop id
    const reactId = useId ? useId().replace(/:/g, '_') : Math.random().toString(36).substring(2, 9);
    const fallbackId = useRef(`jxgbox-${reactId}`).current;
    const dynamicId = id || fallbackId;

    // Tham chiếu DOM Node và Board Instance
    const boardRef = useRef(null);
    const boardInstanceRef = useRef(null);

    // 2. Kiểm soát vòng đời & Event Loop (Render Timing)
    useEffect(() => {
        let timerId = null;

        // Đặt toàn bộ hàm initBoard và logic vẽ bên trong setTimeout 0 để nhường luồng cho Event Loop
        // Kỹ thuật này ép trình duyệt phải hoàn thiện việc hiển thị thẻ <div> ra màn hình rồi mới gắn event listener
        timerId = setTimeout(() => {
            // 3. Phòng ngự chặt chẽ (Defensive Programming): Kiểm tra trực tiếp trên DOM
            const box = document.getElementById(dynamicId);
            if (!box) {
                console.warn(`[JSXGraph] Bỏ qua khởi tạo vì DOM chưa sẵn sàng cho ID: "${dynamicId}"`);
                return;
            }

            // Dọn dẹp bảng cũ nếu đã tồn tại trên container này để tránh duplicate listeners
            if (boardInstanceRef.current) {
                try {
                    const b = boardInstanceRef.current;
                    if (b.resizeObserver) try { b.resizeObserver.disconnect(); } catch (e) {}
                    b.resizeContainer = function() {};
                    b.updateContainerDims = function() {};
                    window.JXG.JSXGraph.freeBoard(b);
                } catch (e) {
                    console.warn(`[JSXGraph] Lỗi dọn dẹp bảng cũ trên "${dynamicId}":`, e);
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
                pan: { enabled: true, needShift: false },
                zoom: { factorX: 1.25, factorY: 1.25, wheel: true, needShift: false },
                ...options
            };

            // Khởi tạo bảng vẽ an toàn với dynamicId duy nhất
            let board = null;
            try {
                board = window.JXG.JSXGraph.initBoard(dynamicId, defaultOptions);
                boardInstanceRef.current = board;
            } catch (err) {
                console.error(`[JSXGraph] Lỗi khởi tạo initBoard cho "${dynamicId}":`, err);
                return;
            }

            // ================================================================
            // TIER 2 - GENERAL GEOMETRY COMPILER (Bộ biên dịch hình học động)
            // ================================================================
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

            function renderDynamicGeometry(boardInstance, constructionSteps) {
                if (!boardInstance || !Array.isArray(constructionSteps)) return;

                constructionSteps.forEach((step, index) => {
                    if (!step || !step.type) return;
                    const stepId = step.id || step.name || `step_${index}`;

                    try {
                        let createdObj = null;

                        switch (step.type.toLowerCase()) {
                            case 'point': {
                                const coords = step.coords || [(Math.random() * 6 - 3), (Math.random() * 6 - 3)];
                                createdObj = boardInstance.create('point', coords, {
                                    name: step.name || step.id || '',
                                    size: step.size || 4,
                                    strokeColor: '#ffffff',
                                    fillColor: step.color || defaultPointColor,
                                    highlightFillColor: defaultHighlightColor,
                                    fixed: step.fixed === true || step.isFree === false,
                                    visible: step.visible !== false,
                                    label: { strokeColor: '#f8fafc', fontSize: 13, fontWeight: 'bold', offset: [8, 8] }
                                });
                                break;
                            }

                            case 'glider': {
                                const targetObj = resolve(step.target || step.on);
                                const coords = step.coords || [0, 0];
                                if (targetObj) {
                                    createdObj = boardInstance.create('glider', [coords[0], coords[1], targetObj], {
                                        name: step.name || step.id || '',
                                        size: step.size || 4,
                                        fillColor: step.color || '#f43f5e',
                                        strokeColor: '#ffffff',
                                        highlightFillColor: defaultHighlightColor,
                                        visible: step.visible !== false,
                                        label: { strokeColor: '#f8fafc', fontSize: 13, fontWeight: 'bold', offset: [8, 8] }
                                    });
                                }
                                break;
                            }

                            case 'segment': {
                                const pts = resolve(step.points || [step.point1, step.point2]);
                                if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                                    createdObj = boardInstance.create('segment', [pts[0], pts[1]], {
                                        name: step.name || '',
                                        strokeColor: step.color || defaultLineColor,
                                        strokeWidth: step.width || 2.5,
                                        dash: step.dash || (step.dashed ? 2 : 0),
                                        highlightStrokeColor: defaultHighlightColor
                                    });
                                }
                                break;
                            }

                            case 'line': {
                                const pts = resolve(step.points || [step.point1, step.point2]);
                                if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                                    createdObj = boardInstance.create('line', [pts[0], pts[1]], {
                                        name: step.name || '',
                                        strokeColor: step.color || defaultLineColor,
                                        strokeWidth: step.width || 2,
                                        dash: step.dash || (step.dashed ? 2 : 0),
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'ray': {
                                const pts = resolve(step.points || [step.point1, step.point2]);
                                if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                                    createdObj = boardInstance.create('ray', [pts[0], pts[1]], {
                                        name: step.name || '',
                                        strokeColor: step.color || defaultLineColor,
                                        strokeWidth: step.width || 2
                                    });
                                }
                                break;
                            }

                            case 'midpoint': {
                                const pts = resolve(step.points || [step.point1, step.point2]);
                                if (pts && pts.length >= 2) {
                                    createdObj = boardInstance.create('midpoint', [pts[0], pts[1]], {
                                        name: step.name || step.id || '',
                                        size: 3.5,
                                        fillColor: step.color || '#a855f7',
                                        strokeColor: '#ffffff',
                                        visible: step.visible !== false,
                                        label: { strokeColor: '#f8fafc', fontWeight: 'bold' }
                                    });
                                }
                                break;
                            }

                            case 'perpendicular': {
                                const baseLine = resolve(step.base || step.line);
                                const pt = resolve(step.point || step.through);
                                if (baseLine && pt) {
                                    createdObj = boardInstance.create('perpendicular', [baseLine, pt], {
                                        name: step.name || '',
                                        strokeColor: step.color || '#94a3b8',
                                        strokeWidth: 1.8,
                                        dash: 2,
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'parallel': {
                                const baseLine = resolve(step.base || step.line);
                                const pt = resolve(step.point || step.through);
                                if (baseLine && pt) {
                                    createdObj = boardInstance.create('parallel', [baseLine, pt], {
                                        name: step.name || '',
                                        strokeColor: step.color || '#94a3b8',
                                        strokeWidth: 1.8,
                                        dash: 2,
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'bisector': {
                                const pts = resolve(step.points || [step.p1, step.vertex, step.p2]);
                                if (pts && pts.length >= 3) {
                                    createdObj = boardInstance.create('bisector', pts, {
                                        name: step.name || '',
                                        strokeColor: step.color || '#f59e0b',
                                        strokeWidth: 1.8,
                                        dash: 2,
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'perpendicularbisector': {
                                const pts = resolve(step.points || [step.p1, step.p2]);
                                if (pts && pts.length >= 2 && pts[0] && pts[1]) {
                                    createdObj = boardInstance.create('perpendicularbisector', pts, {
                                        name: step.name || '',
                                        strokeColor: step.color || '#94a3b8',
                                        strokeWidth: 1.8,
                                        dash: 2,
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'circle': {
                                const center = resolve(step.center);
                                const pt = resolve(step.point || step.radiusPoint);
                                const radius = step.radius;

                                if (center && pt) {
                                    createdObj = boardInstance.create('circle', [center, pt], {
                                        strokeColor: step.color || defaultCircleColor,
                                        strokeWidth: step.width || 2.4,
                                        dash: step.dash || 0,
                                        fillColor: step.fillColor || 'none',
                                        fillOpacity: step.fillOpacity || 0,
                                        visible: step.visible !== false
                                    });
                                } else if (center && typeof radius === 'number') {
                                    createdObj = boardInstance.create('circle', [center, radius], {
                                        strokeColor: step.color || defaultCircleColor,
                                        strokeWidth: step.width || 2.4,
                                        dash: step.dash || 0,
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'circumcircle': {
                                const pts = resolve(step.points || [step.p1, step.p2, step.p3]);
                                if (pts && pts.length >= 3) {
                                    createdObj = boardInstance.create('circumcircle', pts, {
                                        strokeColor: step.color || defaultCircleColor,
                                        strokeWidth: 2.4,
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'incircle': {
                                const pts = resolve(step.points || [step.p1, step.p2, step.p3]);
                                if (pts && pts.length >= 3) {
                                    createdObj = boardInstance.create('incircle', pts, {
                                        strokeColor: step.color || defaultCircleColor,
                                        strokeWidth: 2.4,
                                        visible: step.visible !== false
                                    });
                                }
                                break;
                            }

                            case 'intersection': {
                                const objs = resolve(step.objects || [step.obj1, step.obj2]);
                                const idx = step.index !== undefined ? step.index : 0;
                                if (objs && objs.length >= 2 && objs[0] && objs[1]) {
                                    createdObj = boardInstance.create('intersection', [objs[0], objs[1], idx], {
                                        name: step.name || step.id || '',
                                        size: 4,
                                        fillColor: step.color || '#10b981',
                                        strokeColor: '#ffffff',
                                        visible: step.visible !== false,
                                        label: { strokeColor: '#f8fafc', fontSize: 13, fontWeight: 'bold', offset: [8, 8] }
                                    });
                                }
                                break;
                            }

                            case 'polygon': {
                                const pts = resolve(step.points || step.vertices);
                                if (pts && pts.length >= 3) {
                                    createdObj = boardInstance.create('polygon', pts, {
                                        fillColor: step.fillColor || '#38bdf8',
                                        fillOpacity: step.fillOpacity !== undefined ? step.fillOpacity : 0.12,
                                        borders: { strokeColor: step.strokeColor || defaultLineColor, strokeWidth: step.strokeWidth || 2.5 },
                                        vertices: { visible: false }
                                    });
                                }
                                break;
                            }

                            case 'angle': {
                                const pts = resolve(step.points || [step.p1, step.vertex, step.p2]);
                                if (pts && pts.length >= 3) {
                                    const isRight = step.rightAngle === true || step.type_angle === 'right';
                                    createdObj = boardInstance.create('angle', pts, {
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

                            case 'tangent': {
                                const pt = resolve(step.point || step.glider);
                                const circ = resolve(step.circle);
                                if (pt && circ) {
                                    createdObj = boardInstance.create('tangent', [pt, circ], {
                                        strokeColor: step.color || defaultLineColor,
                                        strokeWidth: 2
                                    });
                                }
                                break;
                            }

                            case 'ticks': {
                                const targetObj = resolve(step.segment || step.target || step.line);
                                const count = step.count || step.num || 1;
                                if (targetObj) {
                                    createdObj = boardInstance.create('ticks', [targetObj, count], {
                                        strokeColor: step.color || defaultLineColor,
                                        strokeWidth: step.width || 1.8,
                                        tickEndings: [0.5, 0.5]
                                    });
                                }
                                break;
                            }

                            case 'functiongraph': {
                                let fn = null;
                                if (typeof step.fn === 'function') fn = step.fn;
                                else if (typeof step.fn === 'string') {
                                    try { fn = new Function('x', `return ${step.fn};`); } catch (e) {}
                                }
                                if (fn) {
                                    createdObj = boardInstance.create('functiongraph', [fn, -10, 10], {
                                        strokeColor: step.color || '#ec4899',
                                        strokeWidth: 2.8
                                    });
                                }
                                break;
                            }

                            case 'text': {
                                const coords = step.coords || [0, 0];
                                createdObj = boardInstance.create('text', [coords[0], coords[1], step.text || ''], {
                                    fontSize: step.fontSize || 13,
                                    strokeColor: step.color || '#f8fafc'
                                });
                                break;
                            }

                            default:
                                break;
                        }

                        if (createdObj) registry.set(stepId, createdObj);
                    } catch (stepErr) {
                        console.error(`[JSXGraph] Lỗi dựng bước ${stepId}:`, stepErr);
                    }
                });
            }

            // Cập nhật lại hình học
            board.update();

            if (onBoardReady) {
                onBoardReady({ board, dynamicId, registry });
            }

            // Đăng ký listener cập nhật toạ độ động
            board.on('update', () => {
                if (onObjectUpdate) {
                    const coords = {};
                    for (const [id, obj] of registry.entries()) {
                        if (obj && typeof obj.X === 'function' && typeof obj.Y === 'function') {
                            coords[id] = { x: obj.X().toFixed(2), y: obj.Y().toFixed(2) };
                        }
                    }
                    onObjectUpdate(coords);
                }
            });
        }, 0);

        // 4. Cleanup function: Hủy bỏ hẹn giờ và dọn dẹp triệt để bảng vẽ cũ
        return () => {
            if (timerId) clearTimeout(timerId);
            if (boardInstanceRef.current) {
                try {
                    const b = boardInstanceRef.current;
                    if (b.resizeObserver) try { b.resizeObserver.disconnect(); } catch (e) {}
                    b.resizeContainer = function() {};
                    b.updateContainerDims = function() {};
                    window.JXG.JSXGraph.freeBoard(b);
                } catch (freeErr) {
                    console.warn(`[JSXGraph] Lỗi giải phóng bảng "${dynamicId}":`, freeErr);
                }
                boardInstanceRef.current = null;
            }
        };
    }, [dynamicId, JSON.stringify(steps), JSON.stringify(options)]);

    // Khai báo ID động cho thẻ <div> dựa trên dynamicId duy nhất
    return (
        <div
            ref={boardRef}
            id={dynamicId}
            className={`jxgbox ${className}`}
            style={style}
        />
    );
};

export default DynamicGeometryBoard;
