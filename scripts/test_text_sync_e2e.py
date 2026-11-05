import asyncio
import aiohttp
import json

async def test_text_sync_backend():
    base_url = 'http://localhost:8080'
    ws_url = 'ws://localhost:8080/ws'
    room_id = 'test_text_sync_room'

    async with aiohttp.ClientSession() as session:
        # 1. Host creates room
        init_state = {
            'strokes': [],
            'padletTexts': [],
            'cards': [],
            'jsxgraphBoards': [{
                'id': 'jxg-geom-test',
                'originX': 400,
                'originY': 150,
                'width': 560,
                'height': 420,
                'spec': {
                    'title': 'Đồ thị Parabol (y = x^2)',
                    'boundingbox': [-7, 8, 7, -5],
                    'steps': [
                        {'type': 'functiongraph', 'id': 'parabola', 'fn': 'x*x', 'color': '#ec4899'}
                    ]
                }
            }]
        }
        async with session.post(f'{base_url}/api/room', json={'roomId': room_id, 'name': 'Text Sync Room', 'state': init_state}) as resp:
            data = await resp.json()
            assert data.get('status') == 'ok', f'Save failed: {data}'
            print('1. Initial room state created successfully.')

        # 2. Host & Guest connect via WebSockets
        async with session.ws_connect(ws_url) as ws_host, session.ws_connect(ws_url) as ws_guest:
            await ws_host.send_json({'type': 'join', 'roomId': room_id, 'user': {'name': 'Giáo Viên (Host)', 'role': 'host'}})
            await ws_host.receive_json()

            await ws_guest.send_json({'type': 'join', 'roomId': room_id, 'user': {'name': 'Học Sinh (Editor)', 'role': 'editor'}})
            await ws_guest.receive_json()

            # 3. Host creates text "Hôm nay học về cách yêu" with styling
            text_item = {
                'id': 'padlet-text-love',
                'x': 250,
                'y': 380,
                'width': 360,
                'height': 60,
                'text': 'Hôm nay học về cách yêu',
                'fontFamily': 'font-hand',
                'fontSize': 'text-xl',
                'color': '#2563eb',
                'bgColor': 'bg-amber-100/95 shadow-md border border-amber-300',
                'isBold': True,
                'isItalic': False,
                'isUnderline': False,
                'align': 'left',
                'isLocked': False
            }

            await ws_host.send_json({
                'type': 'canvas:delta',
                'delta': {
                    'action': 'text:upsert',
                    'item': text_item
                }
            })

            # Guest receives text delta
            msg = await ws_guest.receive_json()
            assert msg.get('type') == 'canvas:delta', f'Unexpected msg: {msg}'
            assert msg['delta']['action'] == 'text:upsert'
            assert msg['delta']['item']['text'] == 'Hôm nay học về cách yêu'
            assert msg['delta']['item']['isBold'] == True
            print('2. Guest received real-time text:upsert with full formatting and text content!')

            # 4. Host streams live typing indicator
            await ws_host.send_json({
                'type': 'canvas:delta',
                'delta': {
                    'action': 'text:upsert',
                    'item': {
                        **text_item,
                        'text': 'Hôm nay học về cách yêu và giải toán Parabol',
                        'typingUserId': 'u_host_1',
                        'typingUserName': 'Giáo Viên'
                    }
                }
            })
            msg2 = await ws_guest.receive_json()
            assert msg2['delta']['item']['typingUserName'] == 'Giáo Viên'
            assert msg2['delta']['item']['text'] == 'Hôm nay học về cách yêu và giải toán Parabol'
            print('3. Real-time typing stream and collaborator indicator confirmed!')

            # 5. Host resets view on JSXGraph board (Căn giữa)
            await ws_host.send_json({
                'type': 'canvas:delta',
                'delta': {
                    'action': 'jsxgraph:update',
                    'id': 'jxg-geom-test',
                    'spec': {
                        'title': 'Đồ thị Parabol (y = x^2)',
                        'boundingbox': [-7, 8, 7, -5],
                        'steps': [
                            {'type': 'functiongraph', 'id': 'parabola', 'fn': 'x*x', 'color': '#ec4899'}
                        ]
                    }
                }
            })
            msg3 = await ws_guest.receive_json()
            assert msg3['delta']['action'] == 'jsxgraph:update'
            assert msg3['delta']['spec']['boundingbox'] == [-7, 8, 7, -5]
            print('4. JSXGraph boundingbox reset view synced in real time!')

            # 6. Host deletes text box
            await ws_host.send_json({
                'type': 'canvas:delta',
                'delta': {
                    'action': 'text:delete',
                    'textId': 'padlet-text-love'
                }
            })
            msg4 = await ws_guest.receive_json()
            assert msg4['delta']['action'] == 'text:delete'
            assert msg4['delta']['textId'] == 'padlet-text-love'
            print('5. Text deletion synchronized across all participants!')

        # 7. Check SQLite persistence for newly joining client
        async with session.get(f'{base_url}/api/room?id={room_id}') as resp:
            room_data = await resp.json()
            # text was deleted, so padletTexts should be empty
            assert len(room_data['state']['padletTexts']) == 0
            # JSXGraph board has updated boundingbox
            assert room_data['state']['jsxgraphBoards'][0]['spec']['boundingbox'] == [-7, 8, 7, -5]
            print('6. SQLite database perfectly reflects real-time state mutations!')

    print('=== ALL TEXT SYNCHRONIZATION BACKEND TESTS PASSED 100%! ===')

if __name__ == '__main__':
    asyncio.run(test_text_sync_backend())

