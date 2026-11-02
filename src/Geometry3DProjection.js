/**
 * ============================================================================
 * GEOMETRY 3D PROJECTION ENGINE (Tier 2 - Oxyz Spatial Geometry Engine)
 * ============================================================================
 * Chuyển đổi tọa độ không gian 3D (x, y, z) thành tọa độ màn hình 2D (screenX, screenY)
 * bằng Phép chiếu Cabinet (Cabinet Oblique Projection) kết hợp thuật toán
 * Tự động nhận diện cạnh khuất (Hidden Line Removal via Face Normal & Camera Vector).
 * ============================================================================
 */

/**
 * 1. Phép chiếu Cabinet (Cabinet Oblique Projection) chuẩn Toán phổ thông:
 * Công thức:
 *   screenX = originX + x - y * Math.cos(alpha)
 *   screenY = originY - z + y * Math.sin(alpha)
 * 
 * @param {[number, number, number]|{x:number, y:number, z:number}} pt - Tọa độ không gian (x, y, z)
 * @param {{x: number, y: number}} origin - Gốc tọa độ trên màn hình Canvas (originX, originY)
 * @param {number} alpha - Hệ số góc chiếu (alpha = 45° = PI/4 hoặc 135° = 3*PI/4)
 * @param {number} scale - Tỉ lệ phóng to thu nhỏ (pixels trên một đơn vị không gian)
 * @param {number} depthScale - Hệ số co trục chiều sâu y (chuẩn Cabinet k = 0.5 đến 1.0)
 * @returns {{x: number, y: number}} Tọa độ màn hình 2D
 */
export function projectCabinet(pt, origin, alpha = Math.PI / 4, scale = 40, depthScale = 0.6) {
  const x = (Array.isArray(pt) ? pt[0] : pt.x) * scale;
  const y = (Array.isArray(pt) ? pt[1] : pt.y) * scale * depthScale;
  const z = (Array.isArray(pt) ? pt[2] : pt.z) * scale;

  const screenX = origin.x + x - y * Math.cos(alpha);
  const screenY = origin.y - z + y * Math.sin(alpha);

  return {
    x: Number(screenX.toFixed(2)),
    y: Number(screenY.toFixed(2))
  };
}

/**
 * Tính tích có hướng (Cross Product) giữa 2 vector trong không gian 3D
 */
export function crossProduct(v1, v2) {
  return [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0]
  ];
}

/**
 * Tính tích vô hướng (Dot Product)
 */
export function dotProduct(u, v) {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

/**
 * Độ dài vector 3D
 */
export function vectorLength(v) {
  return Math.hypot(v[0], v[1], v[2]) || 1;
}

/**
 * Chuẩn hóa vector 3D về độ dài đơn vị
 */
export function normalizeVector(v) {
  const len = vectorLength(v);
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Tính Vector pháp tuyến (Normal Vector) của một mặt đa giác 3D
 * Quy tắc bàn tay phải / Thứ tự ngược chiều kim đồng hồ (CCW winding)
 * 
 * @param {[number, number, number]} p0 - Đỉnh 0
 * @param {[number, number, number]} p1 - Đỉnh 1
 * @param {[number, number, number]} p2 - Đỉnh 2
 * @returns {[number, number, number]} Vector pháp tuyến đơn vị
 */
export function calculateFaceNormal(p0, p1, p2) {
  const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const normal = crossProduct(v1, v2);
  return normalizeVector(normal);
}

/**
 * 2. Thuật toán nhận diện cạnh khuất (Hidden Line Detection):
 * - Tính vector pháp tuyến (Normal Vector) cho từng mặt (faces).
 * - So sánh tích vô hướng với Vector Camera giả lập (Camera / Viewer Vector).
 * - Nếu một cạnh CHỈ tiếp giáp với các mặt quay lưng lại (Back-facing faces):
 *   -> Đánh dấu cạnh đó là "bị khuất" (DASHED, vẽ nét đứt).
 * - Nếu cạnh tiếp giáp với ít nhất một mặt hướng về người nhìn (Front-facing):
 *   -> Đánh dấu là "hiển thị" (SOLID, vẽ nét liền).
 * 
 * @param {Object} pointsMap - Tọa độ 3D các đỉnh: { "A": [x,y,z], ... }
 * @param {Array<Array<string>>} faces - Danh sách các mặt: [ ["A","D","C","B"], ... ]
 * @param {Array<Array<string>>} edges - Danh sách các cạnh: [ ["A","B"], ... ]
 * @param {[number, number, number]} cameraVector - Vector hướng nhìn camera
 * @returns {Array<Object>} Danh sách cạnh đã phân loại hiển thị / khuất
 */
export function detectHiddenLines(pointsMap, faces, edges, cameraVector = [1.0, 1.0, 1.0]) {
  // 1. Phân loại từng mặt: Front-facing (thấy) hay Back-facing (quay lưng)
  const faceStatusList = faces.map((faceVerts, fIdx) => {
    if (faceVerts.length < 3) return { id: fIdx, isFront: true, normal: [0, 0, 1] };

    const p0 = pointsMap[faceVerts[0]];
    const p1 = pointsMap[faceVerts[1]];
    const p2 = pointsMap[faceVerts[2]];

    if (!p0 || !p1 || !p2) return { id: fIdx, isFront: true, normal: [0, 0, 1] };

    const normal = calculateFaceNormal(p0, p1, p2);
    const dot = dotProduct(normal, cameraVector);
    const isFront = dot > 0.001; // Mặt hướng về phía camera

    return {
      id: fIdx,
      vertices: faceVerts,
      normal,
      dotProduct: dot,
      isFront
    };
  });

  // 2. Phân loại từng cạnh
  return edges.map(([u, v]) => {
    // Tìm các mặt chứa cạnh này
    const adjacentFaces = faceStatusList.filter(f => {
      const verts = f.vertices;
      const idxU = verts.indexOf(u);
      const idxV = verts.indexOf(v);
      if (idxU === -1 || idxV === -1) return false;
      // Trong đa giác, 2 đỉnh kề nhau là cạnh nếu chỉ số cách nhau 1 hoặc là đầu-cuối
      const diff = Math.abs(idxU - idxV);
      return diff === 1 || diff === verts.length - 1;
    });

    // Cạnh là nét liền nếu nó thuộc ít nhất 1 mặt hướng về phía trước (Front-facing)
    // Nếu cạnh chỉ thuộc các mặt quay lưng (Back-facing), cạnh đó bị khối che khuất -> Nét đứt!
    const isVisible = adjacentFaces.length === 0 || adjacentFaces.some(f => f.isFront);

    return {
      u,
      v,
      dashed: !isVisible,
      adjacentFaceCount: adjacentFaces.length,
      frontFaceCount: adjacentFaces.filter(f => f.isFront).length
    };
  });
}

/**
 * 3. Mô hình mẫu 3D chuẩn SGK Toán phổ thông Việt Nam
 */
export const PRESET_3D_MODELS = {
  // Hình hộp chữ nhật ABCD.A'B'C'D'
  cuboid: {
    name: "Hình hộp chữ nhật ABCD.A'B'C'D'",
    shape_type: "cuboid",
    dimensions: { length: 4.5, width: 3.0, height: 3.5 },
    points: {
      "A": [0, 0, 0],
      "B": [4.5, 0, 0],
      "C": [4.5, 3.0, 0],
      "D": [0, 3.0, 0],
      "A'": [0, 0, 3.5],
      "B'": [4.5, 0, 3.5],
      "C'": [4.5, 3.0, 3.5],
      "D'": [0, 3.0, 3.5]
    },
    faces: [
      ["A", "D", "C", "B"],      // Đáy dưới (ABCD) - Pháp tuyến hướng xuống -Z
      ["A'", "B'", "C'", "D'"],  // Đáy trên (A'B'C'D') - Pháp tuyến hướng lên +Z
      ["A", "B", "B'", "A'"],    // Mặt trước sau (ABB'A')
      ["B", "C", "C'", "B'"],    // Mặt bên phải (BCC'B')
      ["C", "D", "D'", "C'"],    // Mặt bên diện (CDD'C')
      ["D", "A", "A'", "D'"]     // Mặt bên trái (DAA'D')
    ],
    edges: [
      ["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"],
      ["A'", "B'"], ["B'", "C'"], ["C'", "D'"], ["D'", "A'"],
      ["A", "A'"], ["B", "B'"], ["C", "C'"], ["D", "D'"]
    ]
  },

  // Hình chóp tứ giác S.ABCD
  pyramid: {
    name: "Hình chóp tứ giác S.ABCD",
    shape_type: "pyramid",
    dimensions: { baseWidth: 4.0, baseDepth: 3.0, height: 4.2 },
    points: {
      "S": [2.0, 1.5, 4.2],
      "A": [0, 0, 0],
      "B": [4.0, 0, 0],
      "C": [4.0, 3.0, 0],
      "D": [0, 3.0, 0]
    },
    faces: [
      ["A", "D", "C", "B"], // Mặt đáy
      ["A", "B", "S"],      // Mặt bên SAB
      ["B", "C", "S"],      // Mặt bên SBC
      ["C", "D", "S"],      // Mặt bên SCD
      ["D", "A", "S"]       // Mặt bên SDA
    ],
    edges: [
      ["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"],
      ["S", "A"], ["S", "B"], ["S", "C"], ["S", "D"]
    ]
  },

  // Hình lăng trụ tam giác ABC.A'B'C'
  triangular_prism: {
    name: "Hình lăng trụ tam giác ABC.A'B'C'",
    shape_type: "triangular_prism",
    dimensions: { a: 4.0, b: 3.0, height: 4.0 },
    points: {
      "A": [0, 0, 0],
      "B": [4.0, 0, 0],
      "C": [1.5, 3.0, 0],
      "A'": [0, 0, 4.0],
      "B'": [4.0, 0, 4.0],
      "C'": [1.5, 3.0, 4.0]
    },
    faces: [
      ["A", "C", "B"],           // Đáy dưới ABC
      ["A'", "B'", "C'"],        // Đáy trên A'B'C'
      ["A", "B", "B'", "A'"],    // Mặt bên ABB'A'
      ["B", "C", "C'", "B'"],    // Mặt bên BCC'B'
      ["C", "A", "A'", "C'"]     // Mặt bên CAA'C'
    ],
    edges: [
      ["A", "B"], ["B", "C"], ["C", "A"],
      ["A'", "B'"], ["B'", "C'"], ["C'", "A'"],
      ["A", "A'"], ["B", "B'"], ["C", "C'"]
    ]
  }
};

/**
 * Tự động tạo hệ trục tọa độ Oxyz làm nền tảng trước khi vẽ các khối không gian:
 * 1. Khởi tạo hệ trục: Đặt gốc O tại (0,0,0) (trùng với đỉnh A của hình hộp).
 * 2. Vươn 3 tia Ox, Oy, Oz ra ngoài giới hạn của vật thể.
 * 3. Đồng bộ góc chiếu: Áp dụng cùng phép chiếu Cabinet (alpha = 45° hoặc 135°), trục Oz thẳng đứng.
 * 4. Định dạng đồ họa (Styling): Nét mảnh màu xám nhạt #A9A9A9, mũi tên ở cuối mỗi tia, nhãn "x", "y", "z".
 * 5. Đảm bảo layer hệ trục được render đầu tiên trên Canvas (nằm dưới cùng).
 */
export function generateOxyzAxesPrimitives(origin, pointsMap, options = {}) {
  const {
    alpha = Math.PI / 4,
    scale = 45,
    depthScale = 0.55,
    strokeColor = '#A9A9A9',
    strokeWidth = 1.2
  } = options;

  let maxX = 4.5, maxY = 3.2, maxZ = 3.5;
  if (pointsMap && Object.keys(pointsMap).length > 0) {
    const xs = Object.values(pointsMap).map(p => (Array.isArray(p) ? p[0] : p.x));
    const ys = Object.values(pointsMap).map(p => (Array.isArray(p) ? p[1] : p.y));
    const zs = Object.values(pointsMap).map(p => (Array.isArray(p) ? p[2] : p.z));
    maxX = Math.max(...xs, 1);
    maxY = Math.max(...ys, 1);
    maxZ = Math.max(...zs, 1);
  }

  // Vươn 3 tia Ox, Oy, Oz ra ngoài giới hạn của vật thể (+ 1.8 đơn vị)
  const lenX = Number((maxX + 1.8).toFixed(2));
  const lenY = Number((maxY + 1.8).toFixed(2));
  const lenZ = Number((maxZ + 1.8).toFixed(2));

  // Chiếu 3 tia theo cùng một phép chiếu Cabinet
  const O_2D = origin; // Gốc O(0,0,0) trùng đỉnh A
  const X_2D = projectCabinet([lenX, 0, 0], origin, alpha, scale, depthScale);
  const Y_2D = projectCabinet([0, lenY, 0], origin, alpha, scale, depthScale);
  const Z_2D = projectCabinet([0, 0, lenZ], origin, alpha, scale, depthScale);

  return [
    // Tia Ox (nằm ngang sang phải)
    {
      id: 'axis-ox',
      type: 'line',
      isAxis: true,
      x1: O_2D.x,
      y1: O_2D.y,
      x2: X_2D.x,
      y2: X_2D.y,
      stroke: strokeColor, // #A9A9A9
      strokeWidth: strokeWidth,
      arrow: true,
      arrowColor: strokeColor
    },
    {
      id: 'lbl-ox',
      type: 'label',
      isAxisLabel: true,
      x: X_2D.x + 14,
      y: X_2D.y,
      text: 'x',
      color: strokeColor, // #A9A9A9
      fontSize: 13,
      bold: true
    },

    // Tia Oy (xiên theo góc alpha)
    {
      id: 'axis-oy',
      type: 'line',
      isAxis: true,
      x1: O_2D.x,
      y1: O_2D.y,
      x2: Y_2D.x,
      y2: Y_2D.y,
      stroke: strokeColor, // #A9A9A9
      strokeWidth: strokeWidth,
      arrow: true,
      arrowColor: strokeColor
    },
    {
      id: 'lbl-oy',
      type: 'label',
      isAxisLabel: true,
      x: Y_2D.x - (Math.cos(alpha) > 0 ? 14 : -14),
      y: Y_2D.y + 14,
      text: 'y',
      color: strokeColor, // #A9A9A9
      fontSize: 13,
      bold: true
    },

    // Tia Oz (thẳng đứng lên trên)
    {
      id: 'axis-oz',
      type: 'line',
      isAxis: true,
      x1: O_2D.x,
      y1: O_2D.y,
      x2: Z_2D.x,
      y2: Z_2D.y,
      stroke: strokeColor, // #A9A9A9
      strokeWidth: strokeWidth,
      arrow: true,
      arrowColor: strokeColor
    },
    {
      id: 'lbl-oz',
      type: 'label',
      isAxisLabel: true,
      x: Z_2D.x,
      y: Z_2D.y - 14,
      text: 'z',
      color: strokeColor, // #A9A9A9
      fontSize: 13,
      bold: true
    },

    // Gốc tọa độ O (trùng đỉnh A)
    {
      id: 'lbl-o-origin',
      type: 'label',
      isAxisLabel: true,
      x: O_2D.x - 14,
      y: O_2D.y + 14,
      text: 'O',
      color: strokeColor, // #A9A9A9
      fontSize: 12,
      italic: true
    }
  ];
}

/**
 * 4. Biên dịch mô hình 3D thành Scene Graph 2D hoàn chỉnh cho HTML5 Canvas
 */
export function compile3DScene(spec3D, canvasConfig = { width: 680, height: 480 }, options = {}) {
  const { width = 680, height = 480 } = canvasConfig;
  const {
    alpha = Math.PI / 4,        // 45° mặc định hoặc 135° = 3*PI/4
    scale = 45,                 // Pixel per unit
    depthScale = 0.55,          // Hệ số co trục y
    originOffset = { x: 0, y: 0 },
    showAxes = true,            // Hiển thị hệ trục Oxyz
    cameraVector = [1.0, 1.0, 1.0]
  } = options;

  const pointsMap = spec3D.points || {};
  const faces = spec3D.faces || [];
  const edges = spec3D.edges || [];

  // Gốc tọa độ chiếu Cabinet trên màn hình Canvas
  const origin = {
    x: width / 2 - 80 + originOffset.x,
    y: height / 2 + 100 + originOffset.y
  };

  // 1. Chiếu từng đỉnh 3D sang màn hình 2D bằng phép chiếu Cabinet
  const projectedPoints = {};
  Object.keys(pointsMap).forEach(key => {
    projectedPoints[key] = projectCabinet(pointsMap[key], origin, alpha, scale, depthScale);
  });

  // 2. Chạy thuật toán phát hiện cạnh khuất (Hidden Line Detection)
  const classifiedEdges = detectHiddenLines(pointsMap, faces, edges, cameraVector);

  // 3. Tạo primitives cho trục tọa độ Oxyz (Render đầu tiên ở layer nền)
  const axisPrimitives = showAxes
    ? generateOxyzAxesPrimitives(origin, pointsMap, { alpha, scale, depthScale, strokeColor: '#A9A9A9', strokeWidth: 1.2 })
    : [];

  // 4. Tạo primitives cho các cạnh hình học (Edges)
  const edgePrimitives = classifiedEdges.map((e, idx) => {
    const p1 = projectedPoints[e.u];
    const p2 = projectedPoints[e.v];
    return {
      id: `edge-${e.u}-${e.v}`,
      type: 'line',
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      // Nét đứt cho cạnh khuất [5, 5], nét liền cho cạnh thấy
      dashed: e.dashed,
      stroke: e.dashed ? '#94a3b8' : '#38bdf8',
      strokeWidth: e.dashed ? 1.8 : 2.5,
      dashPattern: [5, 5]
    };
  });

  // 5. Tạo primitives cho các đỉnh (Points)
  const pointPrimitives = Object.keys(projectedPoints).map(key => {
    const pt = projectedPoints[key];
    const isHiddenVertex = classifiedEdges
      .filter(e => (e.u === key || e.v === key))
      .every(e => e.dashed);

    return {
      id: `pt-${key}`,
      type: 'point',
      x: pt.x,
      y: pt.y,
      r: isHiddenVertex ? 3.5 : 4.5,
      color: isHiddenVertex ? '#64748b' : '#38bdf8',
      halo: !isHiddenVertex
    };
  });

  // 6. Tạo primitives cho nhãn đỉnh (Labels với auto-offset)
  const labelPrimitives = Object.keys(projectedPoints).map(key => {
    const pt = projectedPoints[key];
    let offX = 0, offY = 0;
    if (key.includes("'") || key === 'S') offY = -16;
    else if (key === 'A') { offX = -14; offY = -12; }
    else if (key === 'B') { offX = 14; offY = 12; }
    else if (key === 'C') { offX = 16; offY = 14; }
    else if (key === 'D') { offX = -16; offY = 14; }
    else { offX = 12; offY = -12; }

    return {
      id: `lbl-${key}`,
      type: 'label',
      x: pt.x + offX,
      y: pt.y + offY,
      text: key,
      color: '#f8fafc',
      fontSize: 14,
      bold: true
    };
  });

  return {
    title: spec3D.name || "Hình học không gian (Oxyz) - Phép chiếu Cabinet",
    subtitle: `Hệ số góc chiếu α = ${Math.round((alpha * 180) / Math.PI)}°. Đã tự động nhận diện và vẽ nét đứt [5, 5] cho cạnh khuất.`,
    spec3D,
    projectedPoints,
    classifiedEdges,
    primitives: [
      ...axisPrimitives,
      ...edgePrimitives,
      ...pointPrimitives,
      ...labelPrimitives
    ]
  };
}
