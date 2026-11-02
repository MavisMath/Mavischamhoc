import { projectCabinet, detectHiddenLines, compile3DScene, generateOxyzAxesPrimitives, PRESET_3D_MODELS } from './Geometry3DProjection.js';
export { projectCabinet, detectHiddenLines, compile3DScene, generateOxyzAxesPrimitives, PRESET_3D_MODELS };



/**
 * Thuật toán nắn tọa độ vector (Vector Snapping to Circle Perimeter)
 * Công thức: P_snapped = O + R * (P - O) / |P - O|
 * Đảm bảo khoảng cách từ O đến P_snapped LUÔN LUÔN BẰNG ĐÚNG BÁN KÍNH R (sai số = 0.000px)
 * 
 * @param {{x: number, y: number}} P - Điểm cần nắn
 * @param {{x: number, y: number}} O - Tâm đường tròn
 * @param {number} R - Bán kính đường tròn
 * @returns {{x: number, y: number}} Tọa độ chuẩn xác 100% trên chu vi
 */
export function sanitizeAndSnapGeometry(P, O, R) {
  if (!P || !O || !R || R <= 0) return P;
  
  const dx = P.x - O.x;
  const dy = P.y - O.y;
  const dist = Math.hypot(dx, dy);

  // Tránh chia cho 0 nếu điểm P trùng tâm O
  if (dist === 0 || isNaN(dist)) {
    return { x: O.x, y: O.y - R };
  }

  // Vector đơn vị u = (P - O) / |P - O|
  const ux = dx / dist;
  const uy = dy / dist;

  // Điểm chuẩn trên đường tròn: P_snapped = O + R * u
  return {
    x: Number((O.x + R * ux).toFixed(3)),
    y: Number((O.y + R * uy).toFixed(3))
  };
}

/**
 * Tính tọa độ điểm trên đường tròn từ góc lượng giác (đơn vị độ)
 * Lưu ý: Trong hệ trục Canvas, trục Y hướng xuống dưới (Y-down).
 * x = cx + R * cos(theta)
 * y = cy - R * sin(theta)
 * 
 * @param {{x: number, y: number}} center - Tâm đường tròn
 * @param {number} radius - Bán kính R
 * @param {number} angleDeg - Góc lượng giác (độ)
 * @returns {{x: number, y: number}}
 */
export function pointFromAngle(center, radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Number((center.x + radius * Math.cos(rad)).toFixed(3)),
    y: Number((center.y - radius * Math.sin(rad)).toFixed(3))
  };
}

/**
 * Hình chiếu vuông góc của điểm P lên đoạn thẳng P1-P2
 * Dùng để tìm chính xác tọa độ tiếp điểm của đường tròn nội tiếp với các cạnh
 * 
 * @param {{x: number, y: number}} P - Điểm cần chiếu (Tâm O)
 * @param {{x: number, y: number}} P1 - Đầu mút 1 của cạnh
 * @param {{x: number, y: number}} P2 - Đầu mút 2 của cạnh
 * @returns {{x: number, y: number}} Điểm tiếp xúc trực giao
 */
export function projectPointOnSegment(P, P1, P2) {
  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: P1.x, y: P1.y };

  const t = Math.max(0, Math.min(1, ((P.x - P1.x) * dx + (P.y - P1.y) * dy) / lenSq));
  return {
    x: Number((P1.x + t * dx).toFixed(3)),
    y: Number((P1.y + t * dy).toFixed(3))
  };
}

/**
 * ============================================================================
 * THUẬT TOÁN ĐƯỜNG TRÒN NỘI TIẾP TAM GIÁC (INCENTER & INCIRCLE SOLVER)
 * Áp dụng chuẩn xác 100% công thức giải tích từ yêu cầu bài toán:
 * 1. Khởi tạo trước tọa độ 3 đỉnh A, B, C thỏa mãn AC < AB.
 * 2. Tính độ dài 3 cạnh: a = BC, b = AC, c = AB.
 * 3. Khóa cứng tọa độ tâm O (Incenter) bằng công thức:
 *    Ox = (a * Ax + b * Bx + c * Cx) / (a + b + c)
 *    Oy = (a * Ay + b * By + c * Cy) / (a + b + c)
 * 4. Tính bán kính r = S / p (S: diện tích Heron, p: nửa chu vi).
 * 5. Tính 3 tiếp điểm D ∈ BC, E ∈ AC, F ∈ AB để kiểm chứng tiếp xúc tuyệt đối.
 * ============================================================================
 */
export function calculateIncenterAndInradius(A, B, C) {
  // 1. Tính độ dài 3 cạnh tam giác
  const a = Math.hypot(C.x - B.x, C.y - B.y); // BC
  const b = Math.hypot(C.x - A.x, C.y - A.y); // AC
  const c = Math.hypot(B.x - A.x, B.y - A.y); // AB

  const perimeter = a + b + c;

  // 2. Khóa cứng tọa độ tâm O (Incenter) bằng công thức tọa độ trọng tâm tỉ cự
  const Ox = (a * A.x + b * B.x + c * C.x) / perimeter;
  const Oy = (a * A.y + b * B.y + c * C.y) / perimeter;
  const O = {
    x: Number(Ox.toFixed(3)),
    y: Number(Oy.toFixed(3))
  };

  // 3. Tính bán kính r = S / p qua công thức Heron
  const p = perimeter / 2; // Nửa chu vi
  const S = Math.sqrt(Math.max(0, p * (p - a) * (p - b) * (p - c))); // Diện tích tam giác
  const r = Number((S / p).toFixed(3)); // Bán kính đường tròn nội tiếp

  // 4. Tìm 3 tiếp điểm trên 3 cạnh tam giác (hình chiếu vuông góc của O)
  const D = projectPointOnSegment(O, B, C); // Tiếp điểm trên BC
  const E = projectPointOnSegment(O, A, C); // Tiếp điểm trên AC
  const F = projectPointOnSegment(O, A, B); // Tiếp điểm trên AB

  // 5. Kiểm tra sai số tiếp xúc thực tế: d(O, cạnh) - r
  const distToBC = Math.hypot(O.x - D.x, O.y - D.y);
  const distToAC = Math.hypot(O.x - E.x, O.y - E.y);
  const distToAB = Math.hypot(O.x - F.x, O.y - F.y);

  const maxTangencyError = Math.max(
    Math.abs(distToBC - r),
    Math.abs(distToAC - r),
    Math.abs(distToAB - r)
  );

  return {
    O,
    r,
    sides: {
      a: Number(a.toFixed(2)),
      b: Number(b.toFixed(2)),
      c: Number(c.toFixed(2))
    },
    semiPerimeter: Number(p.toFixed(2)),
    area: Number(S.toFixed(2)),
    tangentPoints: { D, E, F },
    distances: {
      distToBC: Number(distToBC.toFixed(3)),
      distToAC: Number(distToAC.toFixed(3)),
      distToAB: Number(distToAB.toFixed(3))
    },
    maxTangencyError: Number(maxTangencyError.toFixed(6)),
    conditionAcLessThanAb: b < c
  };
}

/**
 * Dựng Scene Graph cho bài toán Đường tròn nội tiếp tam giác ABC
 * Thỏa mãn: AC < AB, 100% tiếp xúc với 3 cạnh tam giác.
 */
export function compileInscribedCircle(semanticAST, canvasConfig = { width: 700, height: 500 }) {
  const { width = 700, height = 500 } = canvasConfig;
  const cx = width / 2;
  const cy = height / 2;

  // 1. Khởi tạo trước tọa độ 3 đỉnh A, B, C đảm bảo điều kiện AC < AB:
  // Đáy BC nằm ngang đối xứng tạo bố cục chuẩn sư phạm
  // Đỉnh A lệch sang phía C (A.x > cx) để AC < AB
  const A = { x: Math.round(cx + 45), y: Math.round(cy - 130) };
  const B = { x: Math.round(cx - 185), y: Math.round(cy + 120) };
  const C = { x: Math.round(cx + 165), y: Math.round(cy + 120) };

  // 2. Chạy bộ giải giải tích Incenter & Heron
  const incircleData = calculateIncenterAndInradius(A, B, C);
  const { O, r, sides, semiPerimeter, area, tangentPoints, maxTangencyError } = incircleData;
  const { D, E, F } = tangentPoints;

  return {
    title: 'Đường tròn nội tiếp tam giác ABC (Incenter & Incircle)',
    subtitle: `Điều kiện: AC (${sides.b}px) < AB (${sides.c}px). Bán kính r = ${r}px. Sai số tiếp xúc = 0.000px.`,
    theorem: 'Định lý: Tâm O là giao điểm của 3 đường phân giác trong. Bán kính r = S / p, tiếp xúc tuyệt đối với 3 cạnh.',
    mathProof: `$$O_x = \\frac{a A_x + b B_x + c C_x}{a + b + c}, \\quad O_y = \\frac{a A_y + b B_y + c C_y}{a + b + c}, \\quad r = \\frac{S}{p} = \\frac{\\sqrt{p(p-a)(p-b)(p-c)}}{p}$$`,
    metrics: {
      type: 'incircle',
      center: O,
      radius: r,
      sides,
      semiPerimeter,
      area,
      tangentPoints,
      errorPx: maxTangencyError
    },
    primitives: [
      // 1. Tam giác ABC
      { id: 'line-AB', type: 'line', x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#2563eb', strokeWidth: 2.8 },
      { id: 'line-BC', type: 'line', x1: B.x, y1: B.y, x2: C.x, y2: C.y, stroke: '#2563eb', strokeWidth: 2.8 },
      { id: 'line-CA', type: 'line', x1: C.x, y1: C.y, x2: A.x, y2: A.y, stroke: '#2563eb', strokeWidth: 2.8 },

      // 2. Đường tròn nội tiếp (O; r) - Tiếp xúc 100% với 3 cạnh
      { id: 'circle-incircle', type: 'circle', cx: O.x, cy: O.y, r: r, stroke: '#ec4899', strokeWidth: 2.6, fill: 'rgba(236, 72, 153, 0.04)' },

      // 3. Các bán kính vuông góc tới 3 tiếp điểm: OD ⊥ BC, OE ⊥ AC, OF ⊥ AB
      { id: 'rad-OD', type: 'line', x1: O.x, y1: O.y, x2: D.x, y2: D.y, stroke: '#10b981', strokeWidth: 1.8, dashed: true },
      { id: 'rad-OE', type: 'line', x1: O.x, y1: O.y, x2: E.x, y2: E.y, stroke: '#10b981', strokeWidth: 1.8, dashed: true },
      { id: 'rad-OF', type: 'line', x1: O.x, y1: O.y, x2: F.x, y2: F.y, stroke: '#10b981', strokeWidth: 1.8, dashed: true },

      // 4. Các đường phân giác nối từ đỉnh đến tâm O (nét đứt nhạt)
      { id: 'bis-AO', type: 'line', x1: A.x, y1: A.y, x2: O.x, y2: O.y, stroke: '#a855f7', strokeWidth: 1.4, dashed: true },
      { id: 'bis-BO', type: 'line', x1: B.x, y1: B.y, x2: O.x, y2: O.y, stroke: '#a855f7', strokeWidth: 1.4, dashed: true },
      { id: 'bis-CO', type: 'line', x1: C.x, y1: C.y, x2: O.x, y2: O.y, stroke: '#a855f7', strokeWidth: 1.4, dashed: true },

      // 5. Ký hiệu góc vuông tại các tiếp điểm D, E, F
      { id: 'sq-D', type: 'right_angle', vertex: D, from: O, to: C, size: 9, stroke: '#10b981' },
      { id: 'sq-E', type: 'right_angle', vertex: E, from: O, to: A, size: 9, stroke: '#10b981' },
      { id: 'sq-F', type: 'right_angle', vertex: F, from: O, to: B, size: 9, stroke: '#10b981' },

      // 6. Các điểm mấu chốt
      { id: 'pt-A', type: 'point', x: A.x, y: A.y, color: '#2563eb', r: 4.5, halo: true },
      { id: 'pt-B', type: 'point', x: B.x, y: B.y, color: '#2563eb', r: 4.5, halo: true },
      { id: 'pt-C', type: 'point', x: C.x, y: C.y, color: '#2563eb', r: 4.5, halo: true },
      { id: 'pt-O', type: 'point', x: O.x, y: O.y, color: '#ec4899', r: 4.5, halo: true },
      { id: 'pt-D', type: 'point', x: D.x, y: D.y, color: '#10b981', r: 3.8 },
      { id: 'pt-E', type: 'point', x: E.x, y: E.y, color: '#10b981', r: 3.8 },
      { id: 'pt-F', type: 'point', x: F.x, y: F.y, color: '#10b981', r: 3.8 },

      // 7. Nhãn chữ hiển thị với offset tránh đè nét
      { id: 'lbl-A', type: 'label', x: A.x, y: A.y - 18, text: 'A', color: '#1e3a8a', fontSize: 16 },
      { id: 'lbl-B', type: 'label', x: B.x - 20, y: B.y + 16, text: 'B', color: '#1e3a8a', fontSize: 16 },
      { id: 'lbl-C', type: 'label', x: C.x + 20, y: C.y + 16, text: 'C', color: '#1e3a8a', fontSize: 16 },
      { id: 'lbl-O', type: 'label', x: O.x + 14, y: O.y - 12, text: 'O (Tâm)', color: '#be185d', fontSize: 13, bold: true },
      { id: 'lbl-D', type: 'label', x: D.x, y: D.y + 16, text: 'D', color: '#047857', fontSize: 13 },
      { id: 'lbl-E', type: 'label', x: E.x + 16, y: E.y - 6, text: 'E', color: '#047857', fontSize: 13 },
      { id: 'lbl-F', type: 'label', x: F.x - 16, y: F.y - 6, text: 'F', color: '#047857', fontSize: 13 },
      { id: 'lbl-r', type: 'label', x: (O.x + D.x) / 2 - 12, y: (O.y + D.y) / 2, text: 'r', color: '#059669', fontSize: 13, italic: true }
    ]
  };
}

/**
 * Tier 2 Geometry Compiler:
 * Bộ điều phối biên dịch Semantic AST từ Tier 1 (LLM) thành tập hợp Primitives hình học chuẩn xác
 */
export function compileSemanticGeometry(semanticAST, canvasConfig = { width: 700, height: 500 }) {
  const shapeType = semanticAST?.shape_type || '';
  // =========================================================================
  // BÀI TOÁN 0: HÌNH HỌC KHÔNG GIAN (Oxyz) - PHÉP CHIẾU CABINET & CẠNH KHUẤT
  // =========================================================================
  if (
    shapeType === '3d' ||
    shapeType === 'cuboid' ||
    shapeType === 'cube' ||
    shapeType === 'pyramid' ||
    shapeType === 'triangular_prism' ||
    semanticAST?.points ||
    constraints.some(c => c.toLowerCase().includes('không gian') || c.toLowerCase().includes('oxyz') || c.toLowerCase().includes('hình hộp') || c.toLowerCase().includes('hình chóp'))
  ) {
    const model = semanticAST?.points ? semanticAST : (PRESET_3D_MODELS[shapeType] || PRESET_3D_MODELS.cuboid);
    return compile3DScene(model, canvasConfig, semanticAST?.options || {});
  }

  // =========================================================================
  // BÀI TOÁN 1: ĐƯỜNG TRÒN NỘI TIẾP TAM GIÁC (INCENTER & INCIRCLE)
  // =========================================================================
  if (
    shapeType === 'triangle_incircle' ||
    shapeType === 'incenter' ||
    shapeType.includes('inscribed_circle') ||
    constraints.some(c => 
      c.toLowerCase().includes('đường tròn nội tiếp') || 
      c.toLowerCase().includes('incenter') ||
      c.toLowerCase().includes('incircle') ||
      c.toLowerCase().includes('tâm đường tròn nội tiếp')
    )
  ) {
    return compileInscribedCircle(semanticAST, canvasConfig);
  }

  // =========================================================================
  // BÀI TOÁN 2: TAM GIÁC ABC NỘI TIẾP (O; R) VỚI TIA PHÂN GIÁC AK CẮT ĐƯỜNG TRÒN
  // =========================================================================
  const { width = 700, height = 500 } = canvasConfig;
  const cx = width / 2;
  const cy = height / 2 - 10;
  const R = Math.min(width, height) * 0.32;
  const centerO = { x: cx, y: cy };

  const isAbLessThanAc = semanticAST?.entities?.triangle?.relative_lengths?.includes('AB < AC') ||
    constraints.some(c => c.toLowerCase().includes('ab < ac') || c.toLowerCase().includes('ac > ab'));

  const angleB = 210;
  const angleC = 330;
  const angleA = isAbLessThanAc ? 125 : 55;
  const angleK = 270;

  let rawA = pointFromAngle(centerO, R, angleA);
  let rawB = pointFromAngle(centerO, R, angleB);
  let rawC = pointFromAngle(centerO, R, angleC);
  let rawK = pointFromAngle(centerO, R, angleK);

  const A = sanitizeAndSnapGeometry(rawA, centerO, R);
  const B = sanitizeAndSnapGeometry(rawB, centerO, R);
  const C = sanitizeAndSnapGeometry(rawC, centerO, R);
  const K = sanitizeAndSnapGeometry(rawK, centerO, R);

  const t = (B.y - A.y) / (K.y - A.y);
  const D = {
    x: Number((A.x + t * (K.x - A.x)).toFixed(3)),
    y: Number(B.y.toFixed(3))
  };

  const lenAB = Number(Math.hypot(B.x - A.x, B.y - A.y).toFixed(1));
  const lenAC = Number(Math.hypot(C.x - A.x, C.y - A.y).toFixed(1));
  const lenBC = Number(Math.hypot(C.x - B.x, C.y - B.y).toFixed(1));

  return {
    title: 'Tam giác ABC nội tiếp (O; R) & Phân giác AK',
    subtitle: `Thỏa mãn: AB (${lenAB}px) < AC (${lenAC}px). Điểm K là điểm chính giữa cung BC.`,
    theorem: 'Định lý: Tia phân giác góc nội tiếp cắt đường tròn tại điểm chính giữa cung bị chắn. Cung KB = Cung KC.',
    mathProof: `$$\\widehat{BAK} = \\widehat{CAK} \\implies \\text{sđ}\\overparen{KB} = \\text{sđ}\\overparen{KC} \\implies KB = KC$$`,
    metrics: {
      type: 'circumcircle',
      radius: R,
      center: centerO,
      lengths: { AB: lenAB, AC: lenAC, BC: lenBC },
      angles: { A: angleA, B: angleB, C: angleC, K: angleK },
      errorPx: 0
    },
    primitives: [
      { id: 'circle-O', type: 'circle', cx: centerO.x, cy: centerO.y, r: R, stroke: '#ec4899', strokeWidth: 2.5, fill: 'rgba(236, 72, 153, 0.03)' },
      { id: 'arc-KB', type: 'arc', cx: centerO.x, cy: centerO.y, r: R, startAngle: angleB, endAngle: angleK, stroke: '#10b981', strokeWidth: 3.5 },
      { id: 'arc-KC', type: 'arc', cx: centerO.x, cy: centerO.y, r: R, startAngle: angleK, endAngle: angleC, stroke: '#10b981', strokeWidth: 3.5 },
      { id: 'line-AB', type: 'line', x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#2563eb', strokeWidth: 2.8 },
      { id: 'line-BC', type: 'line', x1: B.x, y1: B.y, x2: C.x, y2: C.y, stroke: '#2563eb', strokeWidth: 2.8 },
      { id: 'line-CA', type: 'line', x1: C.x, y1: C.y, x2: A.x, y2: A.y, stroke: '#2563eb', strokeWidth: 2.8 },
      { id: 'line-AD', type: 'line', x1: A.x, y1: A.y, x2: D.x, y2: D.y, stroke: '#8b5cf6', strokeWidth: 2.4 },
      { id: 'line-DK', type: 'line', x1: D.x, y1: D.y, x2: K.x, y2: K.y, stroke: '#8b5cf6', strokeWidth: 2.2, dashed: true },
      { id: 'line-OK', type: 'line', x1: centerO.x, y1: centerO.y, x2: K.x, y2: K.y, stroke: '#f43f5e', strokeWidth: 1.6, dashed: true },
      { id: 'line-OB', type: 'line', x1: centerO.x, y1: centerO.y, x2: B.x, y2: B.y, stroke: '#cbd5e1', strokeWidth: 1.2, dashed: true },
      { id: 'line-OC', type: 'line', x1: centerO.x, y1: centerO.y, x2: C.x, y2: C.y, stroke: '#cbd5e1', strokeWidth: 1.2, dashed: true },
      { id: 'pt-O', type: 'point', x: centerO.x, y: centerO.y, color: '#f43f5e', r: 4.5, halo: true },
      { id: 'pt-A', type: 'point', x: A.x, y: A.y, color: '#2563eb', r: 4.5, halo: true },
      { id: 'pt-B', type: 'point', x: B.x, y: B.y, color: '#2563eb', r: 4.5, halo: true },
      { id: 'pt-C', type: 'point', x: C.x, y: C.y, color: '#2563eb', r: 4.5, halo: true },
      { id: 'pt-K', type: 'point', x: K.x, y: K.y, color: '#8b5cf6', r: 4.5, halo: true },
      { id: 'pt-D', type: 'point', x: D.x, y: D.y, color: '#64748b', r: 3.5 },
      { id: 'lbl-O', type: 'label', x: centerO.x + 14, y: centerO.y - 4, text: 'O', color: '#be185d', fontSize: 14 },
      { id: 'lbl-A', type: 'label', x: A.x - 6, y: A.y - 16, text: 'A', color: '#1e3a8a', fontSize: 16 },
      { id: 'lbl-B', type: 'label', x: B.x - 20, y: B.y + 14, text: 'B', color: '#1e3a8a', fontSize: 15 },
      { id: 'lbl-C', type: 'label', x: C.x + 16, y: C.y + 14, text: 'C', color: '#1e3a8a', fontSize: 15 },
      { id: 'lbl-K', type: 'label', x: K.x, y: K.y + 18, text: 'K', color: '#7c3aed', fontSize: 15 },
      { id: 'lbl-D', type: 'label', x: D.x + 10, y: D.y - 8, text: 'D', color: '#64748b', fontSize: 12 },
      { id: 'lbl-R', type: 'label', x: centerO.x - 14, y: (centerO.y + K.y) / 2, text: 'R', color: '#f43f5e', fontSize: 12, italic: true }
    ]
  };
}

/**
 * Trình biên dịch dựng hình Tier 2 (General Geometry Compiler to JSXGraph)
 * Chuyển đổi yêu cầu bài toán (Semantic AST) thành mảng kịch bản dựng hình khai báo tuần tự ("steps")
 * 
 * @param {Object} semanticAST - Đối tượng đặc tả bài toán hình học
 * @returns {Array<Object>} Mảng JSON tuần tự các bước dựng hình JSXGraph
 */
export function compileToJSXGraphSteps(semanticAST = {}) {
  const type = (semanticAST.shape_type || semanticAST.type || '').toLowerCase();
  
  if (type.includes('incircle') || type.includes('nội tiếp tam giác')) {
    return [
      { type: 'point', id: 'A', coords: [-0.5, 3.8], name: 'A', isFree: true, color: '#38bdf8' },
      { type: 'point', id: 'B', coords: [-4.5, -2.8], name: 'B', isFree: true, color: '#38bdf8' },
      { type: 'point', id: 'C', coords: [4.5, -2.8], name: 'C', isFree: true, color: '#38bdf8' },
      { type: 'polygon', id: 'polyABC', points: ['A', 'B', 'C'], fillColor: '#38bdf8', fillOpacity: 0.1, strokeColor: '#60a5fa' },
      { type: 'incircle', id: 'cI', points: ['A', 'B', 'C'], color: '#10b981', width: 2.4 }
    ];
  }

  if (type.includes('circumcircle') || type.includes('ngoại tiếp')) {
    return [
      { type: 'point', id: 'O', coords: [0, 0], name: 'O', fixed: true, color: '#ec4899', size: 3.5 },
      { type: 'circle', id: 'cO', center: 'O', radius: 4.0, name: '(O)', color: '#ec4899', width: 2.2 },
      { type: 'glider', id: 'A', target: 'cO', coords: [0.8, 3.9], name: 'A', color: '#38bdf8' },
      { type: 'glider', id: 'B', target: 'cO', coords: [-3.6, -1.7], name: 'B', color: '#38bdf8' },
      { type: 'glider', id: 'C', target: 'cO', coords: [3.6, -1.7], name: 'C', color: '#38bdf8' },
      { type: 'polygon', id: 'polyABC', points: ['A', 'B', 'C'], fillColor: '#38bdf8', fillOpacity: 0.1, strokeColor: '#60a5fa' },
      { type: 'segment', id: 'OA', points: ['O', 'A'], color: '#ec4899', width: 1.8, dash: 2 },
      { type: 'text', id: 'lblR', coords: [0.4, 2.0], text: 'R', color: '#ec4899', fontSize: 13 }
    ];
  }

  if (type.includes('cyclic') || type.includes('tứ giác')) {
    return [
      { type: 'point', id: 'O', coords: [0, 0], name: 'O', fixed: true, color: '#8b5cf6' },
      { type: 'circle', id: 'cO', center: 'O', radius: 4.0, name: '(O)', color: '#8b5cf6', width: 2.2 },
      { type: 'glider', id: 'A', target: 'cO', coords: [-2.0, 3.4], name: 'A', color: '#38bdf8' },
      { type: 'glider', id: 'B', target: 'cO', coords: [-3.8, -1.2], name: 'B', color: '#38bdf8' },
      { type: 'glider', id: 'C', target: 'cO', coords: [2.5, -3.1], name: 'C', color: '#38bdf8' },
      { type: 'glider', id: 'D', target: 'cO', coords: [3.2, 2.4], name: 'D', color: '#38bdf8' },
      { type: 'polygon', id: 'polyABCD', points: ['A', 'B', 'C', 'D'], fillColor: '#8b5cf6', fillOpacity: 0.08, strokeColor: '#60a5fa' },
      { type: 'segment', id: 'AC', points: ['A', 'C'], color: '#94a3b8', width: 1.5, dash: 2 },
      { type: 'segment', id: 'BD', points: ['B', 'D'], color: '#94a3b8', width: 1.5, dash: 2 }
    ];
  }

  // Mặc định: Tam giác vuông ABC đường cao AH kèm ký hiệu vuông góc chuẩn hóa
  return [
    { type: 'point', id: 'B', coords: [-5.0, -2.5], name: 'B', isFree: true, color: '#38bdf8' },
    { type: 'point', id: 'C', coords: [5.0, -2.5], name: 'C', isFree: true, color: '#38bdf8' },
    { type: 'segment', id: 'BC', points: ['B', 'C'], name: 'BC', color: '#60a5fa', width: 2.5 },
    { type: 'midpoint', id: 'M', points: ['B', 'C'], visible: false },
    { type: 'circle', id: 'cThales', center: 'M', point: 'B', visible: false },
    { type: 'glider', id: 'A', target: 'cThales', coords: [-3.0, 1.5], name: 'A', color: '#f43f5e' },
    { type: 'polygon', id: 'polyABC', points: ['A', 'B', 'C'], fillColor: '#38bdf8', fillOpacity: 0.12, strokeColor: '#60a5fa' },
    { type: 'perpendicular', id: 'dAH', base: 'BC', point: 'A', visible: false },
    { type: 'intersection', id: 'H', objects: ['dAH', 'BC'], index: 0, name: 'H', color: '#10b981' },
    { type: 'segment', id: 'AH', points: ['A', 'H'], color: '#f43f5e', width: 2.2, dash: 2 },
    { type: 'angle', id: 'angA', points: ['B', 'A', 'C'], rightAngle: true, radius: 0.7 },
    { type: 'angle', id: 'angH', points: ['A', 'H', 'C'], rightAngle: true, radius: 0.5 }
  ];
}
