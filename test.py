import asyncio
import websockets
import json

async def subscribe():
    uri = "wss://pumpportal.fun/api/data"
    async with websockets.connect(uri) as websocket:
        # Subscribe to new token creation events
        payload = {
            "method": "subscribeNewToken",
        }
        await websocket.send(json.dumps(payload))

        async for message in websocket:
            data = json.loads(message)
            print(data)

# Run the subscribe function
asyncio.get_event_loop().run_until_complete(subscribe())
