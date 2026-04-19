import asyncio
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set

import bcrypt
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from jose import JWTError, jwt
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from pydantic import BaseModel

# =========================
#     MONGODB CONFIG
# =========================
# Single global client — created once, reused for all requests.
MONGO_URI = "mongodb://localhost:27017"
MONGO_TIMEOUT_MS = 2500  # fail fast on startup probe

_mongo_client: Optional[MongoClient] = None
_db = None
_rounds_collection = None
db_available: bool = False   # global flag; set by startup probe


def get_collection():
    """Return the rounds collection (or None if DB is unavailable)."""
    return _rounds_collection if db_available else None


# =========================
#     STARTUP / SHUTDOWN
# =========================

def _probe_mongo():
    """Synchronous ping — run in a thread to avoid blocking the event loop."""
    global _mongo_client, _db, _rounds_collection, db_available

    _mongo_client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=MONGO_TIMEOUT_MS,
        connectTimeoutMS=MONGO_TIMEOUT_MS,
        socketTimeoutMS=MONGO_TIMEOUT_MS,
    )
    _db = _mongo_client["buzzer_app"]
    _rounds_collection = _db["rounds"]

    # ping is the lightest possible connectivity check
    _mongo_client.admin.command("ping")
    db_available = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Probe MongoDB once at startup. App starts regardless of result."""
    global db_available

    print("=" * 50)
    print("  BuzzerVerse — starting up")
    print("=" * 50)

    try:
        await asyncio.to_thread(_probe_mongo)
        print(f"[DB] ✅  MongoDB connected → {MONGO_URI}")
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        db_available = False
        print(f"[DB] ⚠️  MongoDB UNAVAILABLE — round history disabled.")
        print(f"[DB]     Reason: {e}")
        print(f"[DB]     Buzzer game will run normally without persistence.")
    print("=" * 50)

    yield  # app runs here

    # Graceful shutdown
    if _mongo_client:
        _mongo_client.close()
        print("[DB] MongoDB client closed.")


# =========================
#        FAST API APP
# =========================

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
#       AUTH CONFIG
# =========================

ADMIN_HASH = "$2b$12$TlPEKe6gJfPakBtgfoj5Cuwf1dGQSTaNdVYpOwn9MjNi/fBiAgMa2"
SECRET_KEY = "super_secret_key_change_this"
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 120

security = HTTPBearer()


def verify_password(password: str) -> bool:
    return bcrypt.checkpw(password.encode(), ADMIN_HASH.encode())


def create_token() -> str:
    payload = {"exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# =========================
#     TOKEN VERIFICATION
# =========================

def verify_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization format")
    token = auth_header.split(" ")[1]
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return True
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid or expired token")


# =========================
#     AUTH ROUTES
# =========================

class LoginRequest(BaseModel):
    password: str


@app.post("/admin/login")
async def login(data: LoginRequest):
    if not verify_password(data.password):
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"token": create_token()}


# =========================
#        GAME STATE
# =========================

class GameState:
    def __init__(self):
        self.is_active: bool = False
        self.current_round: int = 1
        self.responses: List[Dict] = []
        self.clicked_users: Set[str] = set()
        self.lock = asyncio.Lock()


state = GameState()

# =========================
#    CONNECTION MANAGER
#    (Optimized for 100+ users)
# =========================

class ConnectionManager:
    def __init__(self):
        self.connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.add(ws)

    def disconnect(self, ws: WebSocket):
        self.connections.discard(ws)

    async def broadcast(self, message: dict):
        """Broadcast to all clients concurrently — O(n) with asyncio.gather."""
        if not self.connections:
            return

        dead = []

        async def _send(ws):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        await asyncio.gather(*[_send(ws) for ws in self.connections])

        for ws in dead:
            self.connections.discard(ws)


manager = ConnectionManager()

# =========================
#   ADMIN CONTROL ROUTES
# =========================

@app.post("/admin/enable")
async def enable(auth=Depends(verify_token)):
    state.is_active = True
    await manager.broadcast({"type": "state", "is_active": True})
    return {"status": "enabled"}


@app.post("/admin/disable")
async def disable(auth=Depends(verify_token)):
    state.is_active = False
    await manager.broadcast({"type": "state", "is_active": False})
    return {"status": "disabled"}


# =========================
#   DB WRITE — BACKGROUND
# =========================

def _do_insert(round_num: int, top10: list):
    """
    Synchronous pymongo insert — runs in a thread pool.
    Raises on failure so the caller can log the error.
    """
    collection = get_collection()
    sorted_top10 = sorted(top10, key=lambda x: x["timestamp"])
    collection.insert_one({
        "round": round_num,
        "top_users": sorted_top10,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return len(sorted_top10)


async def _save_round(round_num: int, top10: list):
    """
    Fire-and-forget: persist round data to MongoDB.
    Called via asyncio.create_task — never blocks the reset response.
    Silently skips if DB is unavailable.
    """
    if not db_available:
        print(f"[DB] ⚠️  Round {round_num} NOT saved — MongoDB unavailable.")
        return

    try:
        count = await asyncio.to_thread(_do_insert, round_num, top10)
        print(f"[DB] ✅  Round {round_num} saved — {count} user(s).")
    except Exception as e:
        print(f"[DB] ❌  Insert failed for round {round_num}: {e}")


# =========================
#      RESET ROUTE
# =========================

@app.post("/admin/reset")
async def reset(auth=Depends(verify_token)):
    # 1. Snapshot top-10 BEFORE clearing (sorted fastest first)
    top10 = sorted(state.responses, key=lambda x: x["timestamp"])[:10]
    round_num = state.current_round

    # 2. Clear state instantly
    state.responses.clear()
    state.clicked_users.clear()
    state.current_round += 1
    state.is_active = False

    # 3. Broadcast to all clients immediately (no DB wait)
    await manager.broadcast({
        "type": "reset",
        "round": state.current_round,
    })

    # 4. Persist in background — does NOT block the response above
    if top10:
        asyncio.create_task(_save_round(round_num, top10))

    return {"status": "reset"}


# =========================
#   ROUND HISTORY (Admin)
# =========================

def _fetch_history():
    """Synchronous pymongo query — runs in a thread pool."""
    collection = get_collection()
    cursor = collection.find({}, {"_id": 0}).sort("round", ASCENDING)
    return list(cursor)


@app.get("/admin/history")
async def get_history(auth=Depends(verify_token)):
    """Return all completed rounds with full top-10 lists."""
    if not db_available:
        return {"history": [], "db_available": False}

    try:
        rounds = await asyncio.to_thread(_fetch_history)
    except Exception as e:
        print(f"[DB] ❌  History fetch failed: {e}")
        return {"history": [], "db_available": False}

    history = []
    for r in rounds:
        # Backward-compat: support old 'responses' key alongside new 'top_users'
        users = r.get("top_users") or r.get("responses") or []
        history.append({
            "round": r["round"],
            "top_users": [
                {"position": i + 1, "name": u["name"], "timestamp": u["timestamp"]}
                for i, u in enumerate(users)
            ],
            "total_buzzes": len(users),
            "created_at": r.get("created_at", ""),
        })

    return {"history": history, "db_available": True}


# =========================
#     DB STATUS ROUTE
# =========================

def _ping_mongo():
    """Synchronous ping — runs in a thread pool."""
    _mongo_client.admin.command("ping")


@app.get("/db-status")
async def db_status():
    """Lightweight DB health check — does NOT require auth."""
    if not db_available:
        return {"status": "disconnected", "uri": MONGO_URI}

    # Re-probe live to catch cases where DB went down after startup
    try:
        await asyncio.to_thread(_ping_mongo)
        return {"status": "connected", "uri": MONGO_URI}
    except Exception as e:
        return {"status": "disconnected", "uri": MONGO_URI, "error": str(e)}


# =========================
#    CORE BUZZER LOGIC
# =========================

async def handle_buzz(name: str):
    async with state.lock:
        if not state.is_active:
            return None
        if name in state.clicked_users:
            return None

        response = {"name": name, "timestamp": time.time()}
        state.responses.append(response)
        state.clicked_users.add(name)
        return response


# =========================
#    WEBSOCKET ENDPOINT
# =========================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)

    # Send full initial state so late-joiners are in sync
    await ws.send_json({
        "type": "init",
        "is_active": state.is_active,
        "round": state.current_round,
        "responses": state.responses,
    })

    try:
        while True:
            data = await ws.receive_json()
            if data["type"] == "buzz":
                result = await handle_buzz(data["name"])
                if result:
                    await manager.broadcast({"type": "new_buzz", "data": result})
    except WebSocketDisconnect:
        manager.disconnect(ws)


# =========================
#       HEALTH CHECK
# =========================

@app.get("/")
def root():
    return {"status": "running", "db": "connected" if db_available else "disconnected"}