import asyncio
import random
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set

import bcrypt
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials as firebase_creds
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from pydantic import BaseModel

# =========================
#     MONGODB CONFIG
# =========================
MONGO_URI = "mongodb+srv://Atharva:IEEE-20-26@ieeebuzz.fftlcg5.mongodb.net/?appName=IEEEBUZZ"
DB_NAME = "BuzzIT"
MONGO_TIMEOUT_MS = 5000

_mongo_client: Optional[MongoClient] = None
_db = None
_users_collection = None
_rounds_collection = None
db_available: bool = False


def get_users_collection():
    return _users_collection if db_available else None


def get_rounds_collection():
    return _rounds_collection if db_available else None


# =========================
#     FIREBASE INIT
# =========================
_firebase_app = None


def _init_firebase():
    global _firebase_app
    try:
        cred = firebase_creds.Certificate("firebase_key.json")
        _firebase_app = firebase_admin.initialize_app(cred)
        print("[Firebase] [OK] Initialized")
    except Exception as e:
        print(f"[Firebase] [WARN] Init failed: {e}")


# =========================
#     STARTUP / SHUTDOWN
# =========================

def _probe_mongo():
    global _mongo_client, _db, _users_collection, _rounds_collection, db_available

    _mongo_client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=MONGO_TIMEOUT_MS,
        connectTimeoutMS=MONGO_TIMEOUT_MS,
        socketTimeoutMS=MONGO_TIMEOUT_MS,
    )
    _db = _mongo_client[DB_NAME]
    _users_collection = _db["users"]
    _rounds_collection = _db["rounds"]

    _mongo_client.admin.command("ping")
    db_available = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("  BuzzerVerse -- starting up")
    print("=" * 50)

    # Init Firebase
    _init_firebase()

    # Probe MongoDB
    try:
        await asyncio.to_thread(_probe_mongo)
        print(f"[DB] [OK] MongoDB connected -> {DB_NAME}")

        # Load existing users into memory on startup
        await asyncio.to_thread(_load_users_from_db)
    except Exception as e:
        print(f"[DB] [WARN] MongoDB unavailable: {e}")

    yield

    # Persist users on shutdown
    if db_available:
        try:
            await asyncio.to_thread(_persist_all_users)
            print("[DB] [OK] Users persisted on shutdown")
        except Exception as exc:
            print(f"[DB] [WARN] Shutdown persist failed: {exc}")

    if _mongo_client:
        _mongo_client.close()


def _load_users_from_db():
    """Load all users from MongoDB into in-memory state on startup."""
    col = _users_collection
    if col is None:
        return
    try:
        for doc in col.find():
            email = doc.get("email")
            username = doc.get("username")
            points = doc.get("points", 0)
            if email and username:
                users_store[email] = {"username": username}
                state.users[username] = points
        print(f"[DB] Loaded {len(state.users)} users from database")
    except Exception as e:
        print(f"[DB] [WARN] Failed to load users: {e}")


def _persist_all_users():
    """Persist all user data to MongoDB."""
    col = _users_collection
    if col is None:
        return
    for email, data in users_store.items():
        username = data["username"]
        points = state.users.get(username, 0)
        col.update_one(
            {"email": email},
            {"$set": {"email": email, "username": username, "points": points}},
            upsert=True,
        )


# =========================
#        FAST API APP
# =========================

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
#       AUTH CONFIG
# =========================

ADMIN_HASH = "$2b$12$9iX825JtWSAX0qEkL9.JAuJe74uwB3W2wrn8bR6YtHl1uKG.9SX62"
SECRET_KEY = "a9f83j29fj39f8j29fj2f9j2f9j2f9j2f9j2f9j"
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 120

security = HTTPBearer()

# =========================
#   PASSWORD VERIFY
# =========================

def verify_password(password: str) -> bool:
    return bcrypt.checkpw(password.encode(), ADMIN_HASH.encode())


def create_token() -> str:
    payload = {"exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# =========================
#   TOKEN VERIFY
# =========================

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return True
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid or expired token")


# =========================
#   ADMIN LOGIN
# =========================

class LoginRequest(BaseModel):
    password: str


@app.post("/admin/login")
async def login(data: LoginRequest):
    if not verify_password(data.password):
        raise HTTPException(status_code=401, detail="Wrong password")
    return {"token": create_token()}


# =========================
#   USER AUTH (FIREBASE GOOGLE)
# =========================

class GoogleAuthRequest(BaseModel):
    id_token: str


users_store: Dict[str, Dict] = {}  # email -> {"username": str}


@app.post("/auth/google")
async def google_auth(data: GoogleAuthRequest):
    """
    Step 1: Frontend sends Firebase ID token.
    Backend verifies it, extracts email.
    If user exists -> return username.
    If not -> ask for username.
    """
    try:
        decoded = firebase_auth.verify_id_token(data.id_token)
        email = decoded.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="No email in token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")

    user = users_store.get(email)
    if not user:
        return {"requires_username": True, "email": email}

    return {"username": user["username"], "email": email}


class UsernameRequest(BaseModel):
    email: str
    username: str


@app.post("/auth/username")
async def set_username(data: UsernameRequest):
    """
    Step 2: New user provides username.
    Username is stored as-is (string, e.g. Atharva3566).
    """
    if data.email in users_store:
        raise HTTPException(status_code=400, detail="User already registered")

    users_store[data.email] = {"username": data.username}

    # Initialize user points to 0
    if data.username not in state.users:
        state.users[data.username] = 0

    # Persist to DB (non-blocking)
    if db_available:
        asyncio.create_task(asyncio.to_thread(
            _db_upsert_user, data.email, data.username, 0
        ))

    return {"username": data.username, "email": data.email}


def _db_upsert_user(email: str, username: str, points: int):
    col = _users_collection
    if col is None:
        return
    try:
        col.update_one(
            {"email": email},
            {"$set": {"email": email, "username": username, "points": points}},
            upsert=True,
        )
    except Exception as e:
        print(f"[DB] [WARN] Upsert user failed: {e}")


# =========================
#        GAME STATE
# =========================

class GameState:
    def __init__(self):
        self.is_active: bool = False
        self.current_question: str = "q1"
        self.round_type: str = "frontend"  # "frontend" | "backend" | "mystery"
        self.responses: List[Dict] = []      # list of {"name": str, "timestamp": float}
        self.clicked_users: Set[str] = set()
        self.evaluated_users: Dict[str, str] = {}  # username -> "correct" | "wrong"
        self.users: Dict[str, int] = {}      # username -> points
        self.lock = asyncio.Lock()

    def _next_question(self):
        """Increment question: q1 -> q2 -> q3 ..."""
        num = int(self.current_question[1:])
        self.current_question = f"q{num + 1}"

    def reset_for_new_round(self):
        """Reset question counter to q1 for a new round type."""
        self.current_question = "q1"


state = GameState()

# =========================
#    CONNECTION MANAGER
#    (Role-separated)
# =========================

class ConnectionManager:
    def __init__(self):
        self.user_connections: Set[WebSocket] = set()
        self.admin_connections: Set[WebSocket] = set()
        self.spectator_connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket, role: str):
        await ws.accept()
        if role == "admin":
            self.admin_connections.add(ws)
        elif role == "spectator":
            self.spectator_connections.add(ws)
        else:
            self.user_connections.add(ws)

    def disconnect(self, ws: WebSocket, role: str):
        if role == "admin":
            self.admin_connections.discard(ws)
        elif role == "spectator":
            self.spectator_connections.discard(ws)
        else:
            self.user_connections.discard(ws)

    @property
    def all_connections(self) -> Set[WebSocket]:
        return self.user_connections | self.admin_connections | self.spectator_connections

    async def broadcast_all(self, message: dict):
        """Broadcast to ALL connected clients."""
        tasks = [ws.send_json(message) for ws in self.all_connections]
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            # Clean up dead connections
            for ws, result in zip(list(self.all_connections), results):
                if isinstance(result, Exception):
                    self.user_connections.discard(ws)
                    self.admin_connections.discard(ws)
                    self.spectator_connections.discard(ws)

    async def broadcast_to_users(self, message: dict):
        """Broadcast ONLY to user connections."""
        tasks = [ws.send_json(message) for ws in self.user_connections]
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for ws, result in zip(list(self.user_connections), results):
                if isinstance(result, Exception):
                    self.user_connections.discard(ws)

    async def broadcast_to_admins_and_spectators(self, message: dict):
        """Broadcast to ADMIN + SPECTATOR only (not users)."""
        targets = self.admin_connections | self.spectator_connections
        tasks = [ws.send_json(message) for ws in targets]
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for ws, result in zip(list(targets), results):
                if isinstance(result, Exception):
                    self.admin_connections.discard(ws)
                    self.spectator_connections.discard(ws)


manager = ConnectionManager()

# =========================
#   SCORING ENGINE
# =========================

def compute_scores():
    """
    Apply the FULL scoring logic as specified.
    Called during RESET before clearing state.

    STEP 1: Rank responses by timestamp (top 5 get speed bonus)
    STEP 2: Speed bonus: rank 1->+5, 2->+4, 3->+3, 4->+2, 5->+1
    STEP 3: Answer result: correct->+10, wrong->-3, buzzed-not-evaluated->-3
    STEP 4: No-buzz penalty: random(0,5) deducted
    STEP 5: Apply to each user
    """
    sorted_responses = sorted(state.responses, key=lambda r: r["timestamp"])

    # Build speed bonus map
    speed_bonus_map: Dict[str, int] = {}
    bonuses = [5, 4, 3, 2, 1]
    for i, resp in enumerate(sorted_responses):
        if i < 5:
            speed_bonus_map[resp["name"]] = bonuses[i]
        else:
            speed_bonus_map[resp["name"]] = 0

    # Set of users who buzzed
    buzzed_users = {resp["name"] for resp in sorted_responses}

    # Process ALL registered users
    for username in state.users:
        answer_score = 0
        speed_bonus = 0
        penalty = 0

        if username in buzzed_users:
            # User DID buzz
            speed_bonus = speed_bonus_map.get(username, 0)

            if username in state.evaluated_users:
                # Admin already evaluated this user
                verdict = state.evaluated_users[username]
                if verdict == "correct":
                    answer_score = 10
                elif verdict == "wrong":
                    answer_score = -3
            else:
                # Buzzed but NOT evaluated -> -3
                answer_score = -3
        else:
            # User DID NOT buzz -> random penalty 0-5
            penalty = random.randint(0, 5)

        # STEP 5: Apply
        state.users[username] += answer_score + speed_bonus - penalty


# =========================
#   ADMIN ROUTES
# =========================

@app.post("/admin/enable")
async def enable(auth=Depends(verify_token)):
    state.is_active = True
    await manager.broadcast_all({"type": "state", "is_active": True})
    return {"status": "enabled"}


@app.post("/admin/disable")
async def disable(auth=Depends(verify_token)):
    state.is_active = False
    await manager.broadcast_all({"type": "state", "is_active": False})
    return {"status": "disabled"}


@app.post("/admin/reset")
async def reset(auth=Depends(verify_token)):
    """
    RESET LOGIC:
    1. Apply scoring to ALL users
    2. Persist updated points (DB write only here)
    3. Increment question: q1 -> q2 -> q3 ...
    4. Clear: responses, clicked_users, evaluated_users
    5. Disable buzzer
    6. Broadcast new question
    """
    # Step 1: Apply scoring
    compute_scores()

    # Step 2: Persist to DB (non-blocking background)
    if db_available:
        users_snapshot = dict(state.users)
        store_snapshot = dict(users_store)
        asyncio.create_task(asyncio.to_thread(
            _db_persist_scores, users_snapshot, store_snapshot
        ))

    # Step 3: Increment question
    state._next_question()

    # Step 4: Clear transient state
    state.responses.clear()
    state.clicked_users.clear()
    state.evaluated_users.clear()

    # Step 5: Disable buzzer
    state.is_active = False

    # Step 6: Broadcast new question to all
    await manager.broadcast_all({
        "type": "reset",
        "question": state.current_question,
    })

    # Broadcast updated points to all clients
    await manager.broadcast_all({
        "type": "points_update",
        "users": dict(state.users)
    })

    return {
        "status": "reset",
        "question": state.current_question,
        "scores": dict(state.users),
    }


def _db_persist_scores(users_snapshot: dict, store_snapshot: dict):
    """Persist user scores to MongoDB. Called only on RESET."""
    col = _users_collection
    if col is None:
        return
    try:
        # Build email->username reverse map
        email_map = {v["username"]: k for k, v in store_snapshot.items()}
        for username, points in users_snapshot.items():
            email = email_map.get(username)
            if email:
                col.update_one(
                    {"email": email},
                    {"$set": {"points": points}},
                    upsert=True,
                )
        print(f"[DB] [OK] Scores persisted for {len(users_snapshot)} users")
    except Exception as e:
        print(f"[DB] [WARN] Score persist failed: {e}")


@app.post("/admin/conclude")
async def conclude(auth=Depends(verify_token)):
    """
    CONCLUDE LOGIC:
    1. End current round
    2. Disable buzzer
    3. Generate leaderboard (sorted by points descending)
    4. Broadcast leaderboard to ADMIN + SPECTATOR only
    5. Send point updates (not leaderboard) to USERS
    """
    state.is_active = False

    # Generate leaderboard sorted by points descending
    leaderboard = sorted(
        [{"username": u, "points": p} for u, p in state.users.items()],
        key=lambda x: x["points"],
        reverse=True,
    )

    # Add rank
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1

    # Broadcast leaderboard to ALL clients
    await manager.broadcast_all({
        "type": "conclude",
        "leaderboard": leaderboard,
    })

    # Persist final scores
    if db_available:
        users_snapshot = dict(state.users)
        store_snapshot = dict(users_store)
        asyncio.create_task(asyncio.to_thread(
            _db_persist_scores, users_snapshot, store_snapshot
        ))

    return {
        "status": "concluded",
        "leaderboard": leaderboard,
    }


# =========================
#   ROUND TYPE SELECTION
# =========================

class RoundTypeRequest(BaseModel):
    round_type: str  # "frontend" | "backend" | "mystery"


@app.post("/admin/round")
async def set_round_type(data: RoundTypeRequest, auth=Depends(verify_token)):
    """
    When admin selects a round:
    1. Update round_type
    2. Reset question counter to q1
    3. Clear transient state
    4. Broadcast round_type change
    """
    valid_types = {"frontend", "backend", "mystery"}
    if data.round_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid round type. Must be one of: {valid_types}")

    state.round_type = data.round_type
    state.reset_for_new_round()
    state.responses.clear()
    state.clicked_users.clear()
    state.evaluated_users.clear()
    state.is_active = False

    await manager.broadcast_all({
        "type": "round_type",
        "value": state.round_type,
    })

    return {"status": "round_changed", "round_type": state.round_type, "question": state.current_question}


# =========================
#   EVALUATE (ADMIN)
# =========================

class EvaluateRequest(BaseModel):
    username: str
    result: str  # "correct" | "wrong"


@app.post("/admin/evaluate")
async def evaluate_user(data: EvaluateRequest, auth=Depends(verify_token)):
    """
    Admin marks a user as correct or wrong.
    This is stored in evaluated_users and used during scoring.
    CRITICAL: Once evaluated, RESET will NOT override the decision.
    """
    valid_results = {"correct", "wrong"}
    if data.result not in valid_results:
        raise HTTPException(status_code=400, detail=f"Result must be one of: {valid_results}")

    if data.username not in state.clicked_users:
        raise HTTPException(status_code=400, detail="User has not buzzed this round")

    state.evaluated_users[data.username] = data.result

    # Broadcast evaluation to admin + spectator
    await manager.broadcast_to_admins_and_spectators({
        "type": "evaluation",
        "username": data.username,
        "result": data.result,
    })

    return {"status": "evaluated", "username": data.username, "result": data.result}


# =========================
#   GET CURRENT STATE (ADMIN)
# =========================

@app.get("/admin/state")
async def get_state(auth=Depends(verify_token)):
    """Return full game state for admin dashboard."""
    return {
        "is_active": state.is_active,
        "current_question": state.current_question,
        "round_type": state.round_type,
        "responses": state.responses,
        "clicked_users": list(state.clicked_users),
        "evaluated_users": dict(state.evaluated_users),
        "users": dict(state.users),
    }


# =========================
#   GET LEADERBOARD (ADMIN ONLY)
# =========================

@app.get("/admin/leaderboard")
async def get_leaderboard(auth=Depends(verify_token)):
    """Admin-only leaderboard endpoint."""
    leaderboard = sorted(
        [{"username": u, "points": p} for u, p in state.users.items()],
        key=lambda x: x["points"],
        reverse=True,
    )
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    return {"leaderboard": leaderboard}


# =========================
#    BUZZ LOGIC
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

        # Ensure user is in users dict
        if name not in state.users:
            state.users[name] = 0

        return response


# =========================
#    WEBSOCKET
# =========================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, role: str = "user"):
    """
    WebSocket endpoint with role separation.
    Connect with: /ws?role=user | /ws?role=admin | /ws?role=spectator
    """
    await manager.connect(ws, role)

    # Send INIT message
    init_message = {
        "type": "init",
        "is_active": state.is_active,
        "question": state.current_question,
        "round_type": state.round_type,
        "responses": state.responses,
    }
    await ws.send_json(init_message)

    try:
        while True:
            data = await ws.receive_json()

            if data.get("type") == "buzz" and role == "user":
                # Only users can buzz
                result = await handle_buzz(data["name"])
                if result:
                    await manager.broadcast_all({"type": "new_buzz", "data": result})

    except WebSocketDisconnect:
        manager.disconnect(ws, role)
    except Exception:
        manager.disconnect(ws, role)


# =========================
#       HEALTH CHECK
# =========================

@app.get("/")
def root():
    return {
        "status": "running",
        "db_available": db_available,
        "firebase": _firebase_app is not None,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "db": db_available,
        "firebase": _firebase_app is not None,
        "active_connections": {
            "users": len(manager.user_connections),
            "admins": len(manager.admin_connections),
            "spectators": len(manager.spectator_connections),
        },
        "game": {
            "is_active": state.is_active,
            "question": state.current_question,
            "round_type": state.round_type,
            "total_users": len(state.users),
            "buzzes_this_round": len(state.responses),
        },
    }