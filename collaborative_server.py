# -*- coding: utf-8 -*-
"""
Padlet AI MathBoard - Real-Time Collaboration & State Persistence Server
========================================================================
- WebSockets Real-Time Sync on Port 8765
- Room-based Two-Way Data Streaming (Strokes, Texts, Cards, 3D Geometries, Cursors)
- Role-based Access Control (Host, Editor, Viewer)
- SQLite Database Auto-Save & State Recovery (Google Docs style)
"""

import asyncio
import json
import sqlite3
import time
from datetime import datetime
import websockets
from websockets.asyncio.server import serve

DB_PATH = 'padlet_collab.sqlite'

# Initialize SQLite Database
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
    print("[DB] SQLite database initialized successfully at", DB_PATH)

def db_get_or_create_room(room_id, user_id, user_name, requested_role):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('SELECT host_id, is_locked, name FROM rooms WHERE room_id = ?', (room_id,))
    row = cur.fetchone()
    
    if not row:
        # First user is Host by default
        actual_role = 'host'
        room_name = f"Phòng {room_id}"
        cur.execute('INSERT INTO rooms (room_id, name, host_id, is_locked) VALUES (?, ?, ?, ?)',
                    (room_id, room_name, user_id, 0))
        # Initialize empty canvas state
        empty_state = json.dumps({
            "strokes": [],
            "padletTexts": [],
            "cards": [],
            "geometryObjects": [],
            "settings": {"panX": 40, "panY": 40, "zoom": 1}
        })
        cur.execute('INSERT INTO canvas_states (room_id, version, state_json) VALUES (?, 1, ?)',
                    (room_id, empty_state))
        conn.commit()
        is_locked = 0
    else:
        host_id, is_locked, room_name = row
        if user_id == host_id:
            actual_role = 'host'
        elif is_locked and requested_role != 'host':
            actual_role = 'viewer'
        else:
            actual_role = requested_role if requested_role in ('editor', 'viewer') else 'editor'
            
    conn.close()
    return actual_role, bool(is_locked), (room_name or f"Phòng {room_id}")

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
        "settings": {"panX": 40, "panY": 40, "zoom": 1}
    }

def db_save_canvas_state(room_id, state_dict):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    state_json = json.dumps(state_dict)
    cur.execute('''
        INSERT INTO canvas_states (room_id, version, state_json, updated_at)
        VALUES (?, 1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(room_id) DO UPDATE SET
            state_json = excluded.state_json,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
    ''', (room_id, state_json))
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
        "strokes": [], "padletTexts": [], "cards": [], "geometryObjects": [], "settings": {"panX": 40, "panY": 40, "zoom": 1}
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
            "strokes": [], "padletTexts": [], "cards": [], "geometryObjects": [], "settings": {"panX": 40, "panY": 40, "zoom": 1}
        }
    cur.execute('INSERT OR REPLACE INTO canvas_states (room_id, version, state_json) VALUES (?, 1, ?)',
                (room_id, json.dumps(state_dict)))
    conn.commit()
    conn.close()

# In-Memory Active Rooms & Connected Clients
# rooms[room_id] = { client_ws: { 'userId': ..., 'userName': ..., 'role': ..., 'color': ... } }
active_rooms = {}

async def broadcast_to_room(room_id, message_dict, exclude_ws=None):
    if room_id not in active_rooms:
        return
    msg_str = json.dumps(message_dict)
    disconnected = []
    for ws in list(active_rooms[room_id].keys()):
        if ws != exclude_ws:
            try:
                await ws.send(msg_str)
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

async def handle_connection(websocket):
    client_info = {}
    current_room = None
    
    try:
        async for raw_msg in websocket:
            try:
                data = json.loads(raw_msg)
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
                actual_role, is_locked, room_name = db_get_or_create_room(room_id, user_id, user_name, requested_role)
                
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
                active_rooms[room_id][websocket] = client_info

                # Fetch persisted state from SQLite
                canvas_state = db_get_canvas_state(room_id)

                # Send initial state, room name, and confirmed role to joining client
                await websocket.send(json.dumps({
                    'type': 'room:init',
                    'roomId': room_id,
                    'roomName': room_name,
                    'role': actual_role,
                    'isLocked': is_locked,
                    'state': canvas_state,
                    'users': get_room_users(room_id)
                }))

                # Notify other users in room
                await broadcast_to_room(room_id, {
                    'type': 'user:joined',
                    'user': client_info,
                    'users': get_room_users(room_id)
                }, exclude_ws=websocket)

                print(f"[WS] User {user_name} ({actual_role}) joined room {room_id}")

            # 2. Canvas Real-time Delta (Strokes, Texts, Cards, Geometries)
            elif msg_type == 'canvas:delta':
                if not current_room or client_info.get('role') == 'viewer':
                    # Viewers cannot mutate canvas
                    continue

                delta = data.get('delta', {})
                # Broadcast delta to all other online users
                await broadcast_to_room(current_room, {
                    'type': 'canvas:delta',
                    'senderId': client_info.get('userId'),
                    'senderName': client_info.get('userName'),
                    'delta': delta
                }, exclude_ws=websocket)

            # 3. Canvas Auto-Save Snapshot (Google Docs style)
            elif msg_type == 'canvas:save_snapshot':
                if not current_room or client_info.get('role') == 'viewer':
                    continue

                full_state = data.get('state', {})
                db_save_canvas_state(current_room, full_state)

                await websocket.send(json.dumps({
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
                }, exclude_ws=websocket)

            # 5. Host toggles room lock
            elif msg_type == 'room:set_lock':
                if not current_room or client_info.get('role') != 'host':
                    continue

                is_locked = bool(data.get('isLocked', False))
                db_set_room_lock(current_room, is_locked)

                # Broadcast lock state
                await broadcast_to_room(current_room, {
                    'type': 'room:lock_changed',
                    'isLocked': is_locked,
                    'by': client_info.get('userName')
                })

            # 6. Host changes user role
            elif msg_type == 'room:change_role':
                if not current_room or client_info.get('role') != 'host':
                    continue
                target_uid = data.get('targetUserId')
                new_role = data.get('newRole', 'viewer')
                for ws, info in active_rooms.get(current_room, {}).items():
                    if info.get('userId') == target_uid:
                        info['role'] = new_role
                        await ws.send(json.dumps({
                            'type': 'role:updated',
                            'role': new_role
                        }))
                await broadcast_to_room(current_room, {
                    'type': 'users:updated',
                    'users': get_room_users(current_room)
                })

            # 7. User updates Google profile (name, email, avatar)
            elif msg_type == 'user:profile_update':
                if current_room and websocket in active_rooms.get(current_room, {}):
                    if data.get('userId'): client_info['userId'] = data.get('userId')
                    if data.get('userName'): client_info['userName'] = data.get('userName')
                    if data.get('email'): client_info['email'] = data.get('email')
                    if data.get('avatar'): client_info['avatar'] = data.get('avatar')
                    active_rooms[current_room][websocket] = client_info
                    await broadcast_to_room(current_room, {
                        'type': 'users:updated',
                        'users': get_room_users(current_room)
                    })

            # 8. Request list of all rooms/padlets (Google Docs dashboard)
            elif msg_type == 'rooms:list':
                rooms = db_list_rooms()
                await websocket.send(json.dumps({
                    'type': 'rooms:list_response',
                    'rooms': rooms
                }))

            # 9. Create a new room
            elif msg_type == 'room:create':
                new_room_id = data.get('roomId')
                new_name = data.get('name', 'Padlet Toán học chưa đặt tên')
                host_id = data.get('userId', 'u_host')
                state = data.get('state')
                if new_room_id:
                    db_create_room_with_state(new_room_id, new_name, host_id, state)
                    await websocket.send(json.dumps({
                        'type': 'room:created',
                        'roomId': new_room_id,
                        'name': new_name
                    }))

            # 10. Rename room
            elif msg_type == 'room:rename':
                target_room = data.get('roomId')
                new_name = data.get('name')
                if target_room and new_name:
                    db_rename_room(target_room, new_name)
                    await websocket.send(json.dumps({
                        'type': 'room:renamed',
                        'roomId': target_room,
                        'name': new_name
                    }))
                    await broadcast_to_room(target_room, {
                        'type': 'room:name_updated',
                        'roomId': target_room,
                        'name': new_name
                    })

            # 11. Delete room
            elif msg_type == 'room:delete':
                target_room = data.get('roomId')
                if target_room:
                    db_delete_room(target_room)
                    await websocket.send(json.dumps({
                        'type': 'room:deleted',
                        'roomId': target_room
                    }))

            # 12. Duplicate room
            elif msg_type == 'room:duplicate':
                src_room = data.get('sourceRoomId')
                tgt_room = data.get('targetRoomId')
                new_name = data.get('name', 'Bản sao Padlet')
                uid = data.get('userId', 'u_host')
                if src_room and tgt_room:
                    db_duplicate_room(src_room, tgt_room, new_name, uid)
                    await websocket.send(json.dumps({
                        'type': 'room:duplicated',
                        'roomId': tgt_room,
                        'name': new_name
                    }))

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if current_room and current_room in active_rooms:
            if websocket in active_rooms[current_room]:
                del active_rooms[current_room][websocket]
            print(f"[WS] Client {client_info.get('userName')} disconnected from {current_room}")
            await broadcast_to_room(current_room, {
                'type': 'user:left',
                'userId': client_info.get('userId'),
                'users': get_room_users(current_room)
            })

async def main():
    init_db()
    port = 8765
    print(f"============================================================")
    print(f"🚀 Padlet Real-Time Collaboration Server running on ws://0.0.0.0:{port}")
    print(f"💾 SQLite Database: {DB_PATH}")
    print(f"============================================================")
    async with serve(handle_connection, "0.0.0.0", port):
        await asyncio.Future() # run forever

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Server] Shutting down.")
