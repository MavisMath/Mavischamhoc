# -*- coding: utf-8 -*-
"""
Padlet AI MathBoard - Unified Real-Time Collaboration & Web Server
==================================================================
- Single-Port Cloud Architecture (Works seamlessly on Render.com & Localhost)
- HTTP REST API for Instant Room State Hydration & Dashboard Sync
- WebSocket Endpoint (/ws) for Ultra-Low Latency Live Drawing & Cursors
- SQLite Database Persistence (Google Docs Auto-Save & Recovery)
- Static File Server for HTML, CSS, JS, and Assets
"""

import asyncio
import json
import os
import sys
import time
import sqlite3
from pathlib import Path
from datetime import datetime

from aiohttp import web, WSMsgType

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = str(BASE_DIR / 'padlet_collab.sqlite')

# ================= DATABASE LAYER (SQLITE) =================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            room_id TEXT PRIMARY KEY,
            name TEXT,
            host_id TEXT,
            is_locked INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS canvas_states (
            room_id TEXT PRIMARY KEY,
            version INTEGER DEFAULT 1,
            state_json TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(room_id) REFERENCES rooms(room_id)
        )
    ''')
    conn.commit()
    conn.close()
    print(f"[DB] SQLite database initialized successfully at {DB_PATH}")

def db_get_or_create_room(room_id, user_id=None, user_name=None, requested_role='editor'):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('SELECT host_id, is_locked, name FROM rooms WHERE room_id = ?', (room_id,))
    row = cur.fetchone()
    
    if not row:
        actual_role = 'host'
        room_name = f"Padlet {room_id}"
        host_id = user_id or f"u_host_{int(time.time())}"
        cur.execute('INSERT INTO rooms (room_id, name, host_id, is_locked) VALUES (?, ?, ?, 0)',
                    (room_id, room_name, host_id))
        empty_state = json.dumps({
            "strokes": [],
            "padletTexts": [],
            "cards": [],
            "geometryObjects": [],
            "jsxgraphBoards": [],
            "settings": {"panX": 40, "panY": 40, "zoom": 1}
        })
        cur.execute('''
            INSERT INTO canvas_states (room_id, version, state_json)
            VALUES (?, 1, ?)
            ON CONFLICT(room_id) DO NOTHING
        ''', (room_id, empty_state))
        conn.commit()
        is_locked = 0
    else:
        host_id, is_locked, room_name = row
        if user_id and user_id == host_id:
            actual_role = 'host'
        elif is_locked and requested_role != 'host':
            actual_role = 'viewer'
        else:
            actual_role = requested_role if requested_role in ('editor', 'viewer') else 'editor'
            
    conn.close()
    return actual_role, bool(is_locked), (room_name or f"Padlet {room_id}"), host_id

def db_get_canvas_state(room_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('SELECT state_json FROM canvas_states WHERE room_id = ?', (room_id,))
    row = cur.fetchone()
    conn.close()
    if row and row[0]:
        try:
            return json.loads(row[0])
        except Exception:
            pass
    return {
        "strokes": [],
        "padletTexts": [],
        "cards": [],
        "geometryObjects": [],
        "jsxgraphBoards": [],
        "settings": {"panX": 40, "panY": 40, "zoom": 1}
    }

def db_save_canvas_state(room_id, state_dict, room_name=None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO rooms (room_id, name, host_id, is_locked)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(room_id) DO NOTHING
    ''', (room_id, room_name or f"Padlet {room_id}", f"u_host_{int(time.time())}"))
    state_json = json.dumps(state_dict)
    cur.execute('''
        INSERT INTO canvas_states (room_id, version, state_json, updated_at)
        VALUES (?, 1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(room_id) DO UPDATE SET
            state_json = excluded.state_json,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
    ''', (room_id, state_json))
    
    if room_name:
        cur.execute('UPDATE rooms SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?', (room_name, room_id))
    else:
        cur.execute('UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE room_id = ?', (room_id,))
    conn.commit()
    conn.close()

def db_set_room_lock(room_id, is_locked):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('UPDATE rooms SET is_locked = ? WHERE room_id = ?', (1 if is_locked else 0, room_id))
    conn.commit()
    conn.close()

def db_list_rooms():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('''
        SELECT r.room_id, r.name, r.host_id, r.is_locked, r.created_at, r.updated_at, cs.state_json
        FROM rooms r
        LEFT JOIN canvas_states cs ON r.room_id = cs.room_id
        ORDER BY r.updated_at DESC
    ''')
    rooms = []
    for row in cur.fetchall():
        r_id, name, host_id, is_locked, created_at, updated_at, state_json = row
        strokes_cnt = 0
        cards_cnt = 0
        preview_shapes = []
        if state_json:
            try:
                st = json.loads(state_json)
                strokes_cnt = len(st.get('strokes', []))
                cards_cnt = len(st.get('cards', []))
                for c in st.get('cards', [])[:2]:
                    if c.get('title'): preview_shapes.append(c.get('title'))
            except Exception:
                pass
        rooms.append({
            'roomId': r_id,
            'name': name or f"Padlet {r_id}",
            'hostId': host_id,
            'isLocked': bool(is_locked),
            'createdAt': created_at,
            'updatedAt': updated_at,
            'strokesCount': strokes_cnt,
            'cardsCount': cards_cnt,
            'preview': ", ".join(preview_shapes) if preview_shapes else "Bảng vẽ tự do"
        })
    conn.close()
    return rooms

def db_rename_room(room_id, new_name):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('UPDATE rooms SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?', (new_name, room_id))
    conn.commit()
    conn.close()

def db_delete_room(room_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('DELETE FROM canvas_states WHERE room_id = ?', (room_id,))
    cur.execute('DELETE FROM rooms WHERE room_id = ?', (room_id,))
    conn.commit()
    conn.close()

def db_duplicate_room(src_id, target_id, new_name, host_id='u_host'):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('SELECT state_json FROM canvas_states WHERE room_id = ?', (src_id,))
    row = cur.fetchone()
    state_json = row[0] if row else json.dumps({
        "strokes": [], "padletTexts": [], "cards": [], "geometryObjects": [], "jsxgraphBoards": [], "settings": {"panX": 40, "panY": 40, "zoom": 1}
    })
    cur.execute('INSERT INTO rooms (room_id, name, host_id, is_locked) VALUES (?, ?, ?, 0)',
                (target_id, new_name, host_id))
    cur.execute('INSERT INTO canvas_states (room_id, version, state_json) VALUES (?, 1, ?)',
                (target_id, state_json))
    conn.commit()
    conn.close()

def db_create_room_with_state(room_id, name, host_id, state_dict=None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('INSERT OR REPLACE INTO rooms (room_id, name, host_id, is_locked) VALUES (?, ?, ?, 0)',
                (room_id, name, host_id))
    if state_dict is None:
        state_dict = {
            "strokes": [], "padletTexts": [], "cards": [], "geometryObjects": [], "jsxgraphBoards": [], "settings": {"panX": 40, "panY": 40, "zoom": 1}
        }
    cur.execute('INSERT OR REPLACE INTO canvas_states (room_id, version, state_json) VALUES (?, 1, ?)',
                (room_id, json.dumps(state_dict)))
    conn.commit()
    conn.close()



def db_apply_canvas_delta(room_id, delta):
    if not delta or not isinstance(delta, dict) or 'action' not in delta:
        return
    action = delta.get('action')
    state = db_get_canvas_state(room_id)
    changed = False

    if action == 'stroke:add':
        stroke = delta.get('stroke')
        if stroke:
            strokes = state.setdefault('strokes', [])
            idx = next((i for i, s in enumerate(strokes) if s.get('id') == stroke.get('id')), -1)
            if idx >= 0:
                strokes[idx] = stroke
            else:
                strokes.append(stroke)
            changed = True

    elif action == 'stroke:delete':
        stroke_id = delta.get('strokeId')
        if stroke_id:
            state['strokes'] = [s for s in state.get('strokes', []) if s.get('id') != stroke_id]
            changed = True

    elif action == 'ink:clear':
        state['strokes'] = []
        changed = True

    elif action == 'jsxgraph:create':
        b_data = delta.get('boardData', {})
        if b_data and b_data.get('id'):
            boards = state.setdefault('jsxgraphBoards', [])
            idx = next((i for i, b in enumerate(boards) if b.get('id') == b_data.get('id')), -1)
            new_board = {
                'id': b_data.get('id'),
                'spec': b_data.get('spec', {}),
                'originX': int(b_data.get('stageCenterX', 400) - 280),
                'originY': int(b_data.get('stageCenterY', 300) - 210),
                'width': 560,
                'height': 420
            }
            if idx >= 0:
                boards[idx] = new_board
            else:
                boards.append(new_board)
            changed = True

    elif action == 'jsxgraph:update':
        b_id = delta.get('id')
        new_spec = delta.get('spec')
        if b_id and new_spec:
            boards = state.setdefault('jsxgraphBoards', [])
            for b in boards:
                if b.get('id') == b_id:
                    b['spec'] = new_spec
                    changed = True
                    break

    elif action == 'jsxgraph:move':
        b_id = delta.get('id')
        x, y = delta.get('x'), delta.get('y')
        if b_id and x is not None and y is not None:
            boards = state.setdefault('jsxgraphBoards', [])
            for b in boards:
                if b.get('id') == b_id:
                    b['originX'] = x
                    b['originY'] = y
                    changed = True
                    break

    elif action == 'jsxgraph:delete':
        b_id = delta.get('id')
        if b_id:
            state['jsxgraphBoards'] = [b for b in state.get('jsxgraphBoards', []) if b.get('id') != b_id]
            changed = True

    elif action == 'text:upsert':
        item = delta.get('item')
        if item and item.get('id'):
            texts = state.setdefault('padletTexts', [])
            idx = next((i for i, t in enumerate(texts) if t.get('id') == item.get('id')), -1)
            if idx >= 0:
                texts[idx] = item
            else:
                texts.append(item)
            changed = True

    elif action == 'text:delete':
        text_id = delta.get('textId')
        if text_id:
            state['padletTexts'] = [t for t in state.get('padletTexts', []) if t.get('id') != text_id]
            changed = True

    elif action == 'card:upsert':
        card = delta.get('card')
        if card and card.get('id'):
            cards = state.setdefault('cards', [])
            idx = next((i for i, c in enumerate(cards) if c.get('id') == card.get('id')), -1)
            if idx >= 0:
                cards[idx] = card
            else:
                cards.append(card)
            changed = True

    elif action == 'card:move':
        c_id = delta.get('cardId')
        x, y = delta.get('x'), delta.get('y')
        if c_id and x is not None and y is not None:
            cards = state.setdefault('cards', [])
            for c in cards:
                if c.get('id') == c_id:
                    c['x'] = x
                    c['y'] = y
                    changed = True
                    break

    elif action == 'card:delete':
        c_id = delta.get('cardId')
        if c_id:
            state['cards'] = [c for c in state.get('cards', []) if c.get('id') != c_id]
            changed = True

    elif action == 'board:clear_all':
        state['strokes'] = []
        state['padletTexts'] = []
        state['cards'] = []
        state['geometryObjects'] = []
        state['jsxgraphBoards'] = []
        changed = True

    if changed:
        db_save_canvas_state(room_id, state)

# ================= REAL-TIME IN-MEMORY STATE =================
# active_rooms[room_id] = { ws_response: { 'userId': ..., 'userName': ..., 'role': ..., 'color': ... } }
active_rooms = {}

async def broadcast_to_room(room_id, message_dict, exclude_ws=None):
    if room_id not in active_rooms:
        return
    msg_str = json.dumps(message_dict)
    disconnected = []
    for ws in list(active_rooms[room_id].keys()):
        if ws != exclude_ws and not ws.closed:
            try:
                await ws.send_str(msg_str)
            except Exception:
                disconnected.append(ws)
    for ws in disconnected:
        if ws in active_rooms[room_id]:
            del active_rooms[room_id][ws]

def get_room_users(room_id):
    if room_id not in active_rooms:
        return []
    users = []
    seen = set()
    for ws, info in active_rooms[room_id].items():
        if ws.closed:
            continue
        uid = info.get('userId')
        if uid not in seen:
            seen.add(uid)
            users.append({
                'userId': uid,
                'userName': info.get('userName'),
                'email': info.get('email', ''),
                'avatar': info.get('avatar', ''),
                'role': info.get('role'),
                'color': info.get('color')
            })
    return users


# ================= HTTP REST API HANDLERS =================
def load_dotenv_file(filepath=".env"):
    """Simple parser for .env file if present"""
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v
        except Exception as e:
            print(f"[Env] Note: Could not parse .env: {e}")

load_dotenv_file()

async def serve_env_js(request):
    """
    Dynamically generates runtime env.js from environment variables or .env.
    Eliminates hardcoded credentials from public GitHub repo!
    """
    google_client_id = (
        os.environ.get("VITE_GOOGLE_CLIENT_ID") or 
        os.environ.get("REACT_APP_GOOGLE_CLIENT_ID") or 
        os.environ.get("GOOGLE_CLIENT_ID") or 
        "867845907918-8mt3p30up2f9hhrfs8o2rmmbr7f86gu3.apps.googleusercontent.com"
    )
    gemini_api_key = (
        os.environ.get("VITE_GEMINI_API_KEY") or 
        os.environ.get("REACT_APP_GEMINI_API_KEY") or 
        os.environ.get("GEMINI_API_KEY") or 
        ""
    )

    js_content = f"""// Runtime Environment Configuration dynamically generated by Server
window.ENV = window.ENV || {{}};
window.ENV.VITE_GOOGLE_CLIENT_ID = {json.dumps(google_client_id)};
window.ENV.REACT_APP_GOOGLE_CLIENT_ID = {json.dumps(google_client_id)};
window.ENV.VITE_GEMINI_API_KEY = (typeof localStorage !== 'undefined' && localStorage.getItem('padlet_gemini_api_key')) || {json.dumps(gemini_api_key)};
window.ENV.REACT_APP_GEMINI_API_KEY = window.ENV.VITE_GEMINI_API_KEY;
"""
    return web.Response(text=js_content, content_type="application/javascript", charset="utf-8")

async def api_health(request):
    return web.json_response({
        "status": "ok",
        "service": "Padlet AI MathBoard Realtime & Persistence Server",
        "timestamp": datetime.now().isoformat()
    })

async def api_get_room(request):
    """
    GET /api/room?id=<roomId>
    Fast Hydration: returns the complete room state and metadata directly from SQLite.
    Allows guests and hosts to immediately see the canvas in <100ms.
    """
    room_id = request.query.get('id', 'default-room').strip()
    actual_role, is_locked, room_name, host_id = db_get_or_create_room(room_id)
    canvas_state = db_get_canvas_state(room_id)
    
    return web.json_response({
        "status": "ok",
        "roomId": room_id,
        "name": room_name,
        "hostId": host_id,
        "isLocked": is_locked,
        "state": canvas_state,
        "onlineUsers": get_room_users(room_id)
    })

async def api_save_room(request):
    """
    POST /api/room
    Body: { "roomId": ..., "state": {...}, "name": ... }
    Saves canvas snapshot to SQLite.
    """
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"status": "error", "message": "Invalid JSON"}, status=400)
        
    room_id = data.get('roomId')
    if not room_id:
        return web.json_response({"status": "error", "message": "Missing roomId"}, status=400)
        
    state = data.get('state', {})
    room_name = data.get('name')
    db_save_canvas_state(room_id, state, room_name)
    
    return web.json_response({
        "status": "ok",
        "roomId": room_id,
        "savedAt": datetime.now().isoformat()
    })

async def api_list_rooms(request):
    """
    GET /api/rooms
    Returns list of all rooms for the Google Docs dashboard.
    """
    rooms = db_list_rooms()
    return web.json_response({
        "status": "ok",
        "rooms": rooms
    })

async def api_rename_room(request):
    """
    POST /api/room/rename
    Body: { "roomId": ..., "name": ... }
    """
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"status": "error", "message": "Invalid JSON"}, status=400)
        
    room_id = data.get('roomId')
    new_name = data.get('name')
    if room_id and new_name:
        db_rename_room(room_id, new_name)
        # Notify connected users in that room
        await broadcast_to_room(room_id, {
            'type': 'room:name_updated',
            'roomId': room_id,
            'name': new_name
        })
        return web.json_response({"status": "ok", "roomId": room_id, "name": new_name})
    return web.json_response({"status": "error", "message": "Missing fields"}, status=400)

async def api_delete_room(request):
    """
    POST /api/room/delete
    Body: { "roomId": ... }
    """
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"status": "error", "message": "Invalid JSON"}, status=400)
        
    room_id = data.get('roomId')
    if room_id:
        db_delete_room(room_id)
        return web.json_response({"status": "ok", "roomId": room_id})
    return web.json_response({"status": "error", "message": "Missing roomId"}, status=400)

async def api_duplicate_room(request):
    """
    POST /api/room/duplicate
    Body: { "sourceRoomId": ..., "targetRoomId": ..., "name": ..., "userId": ... }
    """
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"status": "error", "message": "Invalid JSON"}, status=400)
        
    src = data.get('sourceRoomId')
    tgt = data.get('targetRoomId')
    name = data.get('name', 'Bản sao Padlet')
    uid = data.get('userId', 'u_host')
    if src and tgt:
        db_duplicate_room(src, tgt, name, uid)
        return web.json_response({"status": "ok", "roomId": tgt, "name": name})
    return web.json_response({"status": "error", "message": "Missing room IDs"}, status=400)


# ================= WEBSOCKET HANDLER =================
async def websocket_handler(request):
    """
    WebSocket endpoint on /ws (and /ws/).
    Upgrades incoming HTTP connection to full-duplex WebSocket.
    """
    ws = web.WebSocketResponse(heartbeat=25.0)
    await ws.prepare(request)

    client_info = {}
    current_room = None

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except Exception:
                    continue

                msg_type = data.get('type')

                # 1. User joins a room
                if msg_type == 'join':
                    room_id = data.get('roomId', 'default-room')
                    user_id = data.get('userId', f"u_{int(time.time()*1000)}")
                    user_name = data.get('userName', f"User {user_id[-4:]}")
                    requested_role = data.get('role', 'editor')
                    color = data.get('color', '#3b82f6')

                    current_room = room_id
                    actual_role, is_locked, room_name, _ = db_get_or_create_room(room_id, user_id, user_name, requested_role)

                    client_info = {
                        'userId': user_id,
                        'userName': user_name,
                        'email': data.get('email', ''),
                        'avatar': data.get('avatar', ''),
                        'role': actual_role,
                        'color': color
                    }

                    if room_id not in active_rooms:
                        active_rooms[room_id] = {}
                    active_rooms[room_id][ws] = client_info

                    # Canvas state from SQLite
                    canvas_state = db_get_canvas_state(room_id)

                    # Send initial room state to joining client
                    await ws.send_str(json.dumps({
                        'type': 'room:init',
                        'roomId': room_id,
                        'roomName': room_name,
                        'role': actual_role,
                        'isLocked': is_locked,
                        'state': canvas_state,
                        'users': get_room_users(room_id)
                    }))

                    # Broadcast new joiner to other clients
                    await broadcast_to_room(room_id, {
                        'type': 'user:joined',
                        'user': client_info,
                        'users': get_room_users(room_id)
                    }, exclude_ws=ws)

                    print(f"[WS] Client {user_name} ({actual_role}) joined room {room_id}")

                # 2. Canvas Real-time Delta (Strokes, Texts, Cards, Geometries)
                elif msg_type == 'canvas:delta':
                    if not current_room or client_info.get('role') == 'viewer':
                        continue
                    delta = data.get('delta', {})
                    # Update SQLite database in real time for instant hydration
                    try:
                        db_apply_canvas_delta(current_room, delta)
                    except Exception as e:
                        print(f"[DB Delta] Error: {e}")
                    # Broadcast immediately to all other users
                    await broadcast_to_room(current_room, {
                        'type': 'canvas:delta',
                        'senderId': client_info.get('userId'),
                        'senderName': client_info.get('userName'),
                        'delta': delta
                    }, exclude_ws=ws)

                # 3. Canvas Auto-Save Snapshot (Persistent SQLite save)
                elif msg_type == 'canvas:save_snapshot':
                    if not current_room or client_info.get('role') == 'viewer':
                        continue
                    full_state = data.get('state', {})
                    room_name = data.get('name')
                    db_save_canvas_state(current_room, full_state, room_name)

                    await ws.send_str(json.dumps({
                        'type': 'save:ack',
                        'status': 'saved',
                        'timestamp': datetime.now().isoformat()
                    }))

                # 4. Live Cursor Movement
                elif msg_type == 'cursor:move':
                    if not current_room:
                        continue
                    await broadcast_to_room(current_room, {
                        'type': 'cursor:move',
                        'userId': client_info.get('userId'),
                        'userName': client_info.get('userName'),
                        'color': client_info.get('color'),
                        'x': data.get('x', 0),
                        'y': data.get('y', 0)
                    }, exclude_ws=ws)

                # 5. Cursor Leave
                elif msg_type == 'cursor:leave':
                    if not current_room:
                        continue
                    await broadcast_to_room(current_room, {
                        'type': 'cursor:leave',
                        'userId': client_info.get('userId')
                    }, exclude_ws=ws)

                # 6. Host toggles room lock
                elif msg_type == 'room:set_lock':
                    if not current_room or client_info.get('role') != 'host':
                        continue
                    is_locked = bool(data.get('isLocked', False))
                    db_set_room_lock(current_room, is_locked)
                    await broadcast_to_room(current_room, {
                        'type': 'room:lock_changed',
                        'isLocked': is_locked,
                        'by': client_info.get('userName')
                    })

                # 7. Host changes user role
                elif msg_type == 'room:change_role':
                    if not current_room or client_info.get('role') != 'host':
                        continue
                    target_uid = data.get('targetUserId')
                    new_role = data.get('newRole', 'viewer')
                    for target_ws, info in active_rooms.get(current_room, {}).items():
                        if info.get('userId') == target_uid:
                            info['role'] = new_role
                            if not target_ws.closed:
                                await target_ws.send_str(json.dumps({
                                    'type': 'role:updated',
                                    'role': new_role
                                }))
                    await broadcast_to_room(current_room, {
                        'type': 'users:updated',
                        'users': get_room_users(current_room)
                    })

                # 8. User profile update (Google name, avatar)
                elif msg_type == 'user:profile_update':
                    if current_room and ws in active_rooms.get(current_room, {}):
                        if data.get('userId'): client_info['userId'] = data.get('userId')
                        if data.get('userName'): client_info['userName'] = data.get('userName')
                        if data.get('email'): client_info['email'] = data.get('email')
                        if data.get('avatar'): client_info['avatar'] = data.get('avatar')
                        active_rooms[current_room][ws] = client_info
                        await broadcast_to_room(current_room, {
                            'type': 'users:updated',
                            'users': get_room_users(current_room)
                        })

                # 9. Rooms list for Google Docs Dashboard
                elif msg_type == 'rooms:list':
                    rooms = db_list_rooms()
                    await ws.send_str(json.dumps({
                        'type': 'rooms:list_response',
                        'rooms': rooms
                    }))

                # 10. Room Create
                elif msg_type == 'room:create':
                    new_room_id = data.get('roomId')
                    new_name = data.get('name', 'Padlet Toán học chưa đặt tên')
                    host_id = data.get('userId', 'u_host')
                    state = data.get('state')
                    if new_room_id:
                        db_create_room_with_state(new_room_id, new_name, host_id, state)
                        await ws.send_str(json.dumps({
                            'type': 'room:created',
                            'roomId': new_room_id,
                            'name': new_name
                        }))

                # 11. Room Rename
                elif msg_type == 'room:rename':
                    target_room = data.get('roomId')
                    new_name = data.get('name')
                    if target_room and new_name:
                        db_rename_room(target_room, new_name)
                        await ws.send_str(json.dumps({
                            'type': 'room:renamed',
                            'roomId': target_room,
                            'name': new_name
                        }))
                        await broadcast_to_room(target_room, {
                            'type': 'room:name_updated',
                            'roomId': target_room,
                            'name': new_name
                        })

                # 12. Room Delete
                elif msg_type == 'room:delete':
                    target_room = data.get('roomId')
                    if target_room:
                        db_delete_room(target_room)
                        await ws.send_str(json.dumps({
                            'type': 'room:deleted',
                            'roomId': target_room
                        }))

                # 13. Room Duplicate
                elif msg_type == 'room:duplicate':
                    src_room = data.get('sourceRoomId')
                    tgt_room = data.get('targetRoomId')
                    new_name = data.get('name', 'Bản sao Padlet')
                    uid = data.get('userId', 'u_host')
                    if src_room and tgt_room:
                        db_duplicate_room(src_room, tgt_room, new_name, uid)
                        await ws.send_str(json.dumps({
                            'type': 'room:duplicated',
                            'roomId': tgt_room,
                            'name': new_name
                        }))

            elif msg.type == WSMsgType.ERROR:
                print(f"[WS] WebSocket error: {ws.exception()}")

    except Exception as e:
        print(f"[WS] Connection exception: {e}")
    finally:
        if current_room and current_room in active_rooms:
            if ws in active_rooms[current_room]:
                del active_rooms[current_room][ws]
            print(f"[WS] Client {client_info.get('userName', 'Unknown')} left room {current_room}")
            await broadcast_to_room(current_room, {
                'type': 'user:left',
                'userId': client_info.get('userId'),
                'users': get_room_users(current_room)
            })

    return ws


# ================= CORS MIDDLEWARE =================
@web.middleware
async def cors_middleware(request, handler):
    if request.method == 'OPTIONS':
        response = web.Response(status=204)
    else:
        try:
            response = await handler(request)
        except web.HTTPException as ex:
            response = ex

    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    return response


# ================= ROOT HANDLER =================
async def index_handler(request):
    # Default route: serve padlet_ai_mathboard.html
    padlet_path = BASE_DIR / 'padlet_ai_mathboard.html'
    if padlet_path.exists():
        return web.FileResponse(padlet_path)
    return web.Response(text="MathBoard Padlet Server Ready", content_type="text/plain")


# ================= SERVER INITIALIZATION =================
def create_app():
    init_db()
    app = web.Application(middlewares=[cors_middleware])

    # REST APIs
    app.router.add_get('/health', api_health)
    app.router.add_get('/api/health', api_health)
    app.router.add_get('/env.js', serve_env_js)
    app.router.add_get('/api/room', api_get_room)
    app.router.add_post('/api/room', api_save_room)
    app.router.add_get('/api/rooms', api_list_rooms)
    app.router.add_post('/api/room/rename', api_rename_room)
    app.router.add_post('/api/room/delete', api_delete_room)
    app.router.add_post('/api/room/duplicate', api_duplicate_room)

    # WebSockets (support both /ws and /ws/)
    app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/ws/', websocket_handler)

    # Root route
    app.router.add_get('/', index_handler)

    # Static files serving for all project assets
    app.router.add_static('/', path=str(BASE_DIR), show_index=True)

    return app

def main():
    port = int(os.environ.get("PORT", 8080))
    host = "0.0.0.0"
    app = create_app()

    print("============================================================")
    print("🚀 Padlet AI MathBoard - Unified Web & Collaboration Server")
    print(f"🌐 Serving on: http://{host}:{port}")
    print(f"🔄 WebSockets:  ws://{host}:{port}/ws")
    print(f"💾 SQLite DB:   {DB_PATH}")
    print("============================================================")

    web.run_app(app, host=host, port=port)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down.")
