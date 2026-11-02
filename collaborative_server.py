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
    cur.execute('SELECT host_id, is_locked FROM rooms WHERE room_id = ?', (room_id,))
    row = cur.fetchone()
    
    if not row:
        # First user is Host by default
        actual_role = 'host'
        cur.execute('INSERT INTO rooms (room_id, name, host_id, is_locked) VALUES (?, ?, ?, ?)',
                    (room_id, f"Phòng {room_id}", user_id, 0))
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
        host_id, is_locked = row
        if user_id == host_id:
            actual_role = 'host'
        elif is_locked and requested_role != 'host':
            actual_role = 'viewer'
        else:
            actual_role = requested_role if requested_role in ('editor', 'viewer') else 'editor'
            
    conn.close()
    return actual_role, bool(is_locked)

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
                actual_role, is_locked = db_get_or_create_room(room_id, user_id, user_name, requested_role)
                
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

                # Send initial state and confirmed role to joining client
                await websocket.send(json.dumps({
                    'type': 'room:init',
                    'roomId': room_id,
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
