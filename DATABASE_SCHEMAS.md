# Padlet MathBoard - Kiến Trúc Cơ Sở Dữ Liệu & Đồng Bộ Thời Gian Thực (Multi-User Collaboration)

Tài liệu này cung cấp toàn bộ cấu trúc cơ sở dữ liệu (Database Schemas) và cơ chế phân quyền RBAC (Role-Based Access Control) cho hệ thống bảng vẽ cộng tác thời gian thực Padlet MathBoard.

---

## 1. Cơ sở dữ liệu SQLite (Local / Self-Hosted Server)
Được triển khai sẵn trong tệp `collaborative_server.py`. Hệ thống tự động tạo các bảng và lưu trữ trạng thái canvas JSON theo chu kỳ tự động lưu (Auto-save) sau mỗi thao tác.

```sql
-- Bảng quản lý phòng học và Host
CREATE TABLE IF NOT EXISTS rooms (
    room_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host_id TEXT NOT NULL,
    is_locked INTEGER DEFAULT 0, -- 1: Host khóa quyền vẽ của tất cả Editor (chuyển sang Viewer)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lưu trữ trạng thái Canvas JSON (Google Docs Style)
CREATE TABLE IF NOT EXISTS canvas_states (
    room_id TEXT PRIMARY KEY,
    version INTEGER DEFAULT 1,
    state_json TEXT NOT NULL, -- Toàn bộ mảng strokes, padletTexts, cards, geometryObjects
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

-- Bảng ghi nhật ký thao tác (Audit / History Replay)
CREATE TABLE IF NOT EXISTS canvas_action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'stroke:add', 'geom:update', 'text:upsert', 'clear'
    delta_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Cấu trúc Supabase / PostgreSQL (Production Cloud Database)
Hỗ trợ cơ chế **Supabase Realtime (PostgreSQL Replication CDC)** cho phép đồng bộ tức thì giữa hàng ngàn người dùng thông qua WebSocket kênh xuất bản/đăng ký (Pub/Sub).

```sql
-- 1. Bảng quản lý Phòng học
CREATE TABLE public.padlet_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL, -- Mã phòng ngắn gọn (vd: "toan-9-hinh-hoc")
    title TEXT NOT NULL DEFAULT 'Bảng vẽ toán học mới',
    host_id UUID NOT NULL,          -- ID của Host tạo phòng
    is_locked BOOLEAN DEFAULT FALSE, -- Cờ khóa quyền vẽ toàn phòng
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng lưu trữ Trạng thái Canvas JSONB
CREATE TABLE public.padlet_canvas_states (
    room_id UUID REFERENCES public.padlet_rooms(id) ON DELETE CASCADE PRIMARY KEY,
    version INT DEFAULT 1,
    state JSONB NOT NULL DEFAULT '{
        "strokes": [],
        "padletTexts": [],
        "cards": [],
        "geometryObjects": [],
        "settings": {"panX": 40, "panY": 40, "zoom": 1}
    }'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng phân quyền thành viên trong phòng (RBAC)
CREATE TABLE public.padlet_room_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.padlet_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    role TEXT CHECK (role IN ('host', 'editor', 'viewer')) DEFAULT 'viewer',
    avatar_color TEXT DEFAULT '#3b82f6',
    last_active TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (room_id, user_id)
);

-- 4. Bật tính năng Supabase Realtime cho bảng Canvas và Thành viên
ALTER PUBLICATION supabase_realtime ADD TABLE public.padlet_canvas_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.padlet_room_members;

-- 5. Row Level Security (RLS) Policies
ALTER TABLE public.padlet_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_canvas_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_room_members ENABLE ROW LEVEL SECURITY;

-- Cho phép mọi thành viên trong phòng đọc dữ liệu
CREATE POLICY "Cho phép đọc phòng" ON public.padlet_rooms
    FOR SELECT USING (true);

-- Cho phép Host và Editor cập nhật Canvas State
CREATE POLICY "Quyền cập nhật Canvas" ON public.padlet_canvas_states
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.padlet_room_members
            WHERE room_id = padlet_canvas_states.room_id 
              AND user_id = auth.uid() 
              AND role IN ('host', 'editor')
        )
    );
```

---

## 3. Cấu trúc NoSQL Firebase Firestore (Google Cloud Serverless)
Cấu trúc Document / Collection tối ưu cho Firestore Document Snapshots:

```text
padlet_rooms (Collection)
 └── {roomId} (Document)
      ├── name: "Lớp Học Hình Học 9" (string)
      ├── hostId: "user_gv_01" (string)
      ├── isLocked: false (boolean)
      ├── createdAt: 2026-11-02T06:00:00Z (timestamp)
      ├── updatedAt: 2026-11-02T06:45:00Z (timestamp)
      │
      ├── canvas_state (Map)
      │    ├── strokes: [
      │    │     { id: "stroke-1", type: "pen", color: "#2563eb", width: 2, points: [{x, y}, ...] }
      │    │   ]
      │    ├── padletTexts: [
      │    │     { id: "text-1", x: 120, y: 150, text: "Chứng minh tam giác ABC...", fontSize: "text-xl" }
      │    │   ]
      │    ├── cards: []
      │    ├── geometryObjects: [
      │    │     { id: "geom-1", category: "incircle", originX: 400, originY: 300, vertices: { A, B, C } }
      │    │   ]
      │    └── settings: { panX: 40, panY: 40, zoom: 1 }
      │
      └── active_participants (Sub-collection)
           └── {userId} (Document)
                ├── userName: "Nguyễn Văn A" (string)
                ├── role: "host" | "editor" | "viewer" (string)
                ├── color: "#ec4899" (string)
                ├── cursor: { x: 450, y: 320 } (map)
                └── lastPing: 2026-11-02T06:45:12Z (timestamp)
```

---

## 4. Đặc tả cơ chế phân quyền (Role-Based Access Control - RBAC)

| Quyền hạn | 👑 Host (Chủ phòng / Giáo viên) | ✏️ Editor (Cộng tác viên / Học sinh vẽ) | 👁️ Viewer (Học sinh dự thính / Khách) |
|---|:---:|:---:|:---:|
| **Xem bảng vẽ trực tiếp** | ✅ | ✅ | ✅ |
| **Vẽ bút / dạ quang / hình học** | ✅ | ✅ (nếu phòng mở) | ❌ Bị vô hiệu hóa |
| **Gõ chữ viết / Chèn công thức** | ✅ | ✅ (nếu phòng mở) | ❌ Bị vô hiệu hóa |
| **Di chuyển / Kéo nắn hình vẽ** | ✅ | ✅ (nếu phòng mở) | ❌ Bị vô hiệu hóa |
| **Dùng Trợ lý AI giải toán** | ✅ | ✅ (nếu phòng mở) | ❌ Bị vô hiệu hóa |
| **Khóa quyền vẽ toàn phòng** | ✅ Toàn quyền bật/tắt | ❌ Không có quyền | ❌ Không có quyền |
| **Tạo Link chia sẻ Editor/Viewer**| ✅ | ❌ | ❌ |
| **Xóa bảng vẽ (Clear Board)** | ✅ | ❌ Chỉ xóa nét của mình | ❌ Không có quyền |
