// src/shared/syncEngine.jsx
const STORAGE_KEY = 'buzzerverse_tournament_state';

class SyncEngine {
  constructor() {
    this.listeners = [];

    this.defaultState = {
      rounds: [
        { clicks: [], startTime: 0, status: 'pending' },
        { clicks: [], startTime: 0, status: 'pending' },
        { clicks: [], startTime: 0, status: 'pending' }
      ],
      currentRoundIndex: 0,
      participants: {}, // sapId -> { name }
      tournamentStatus: 'registration', // registration, ongoing, finished
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.notify(this.getState());
        }
      });

      if (!localStorage.getItem(STORAGE_KEY)) {
        this.saveState(this.defaultState);
      }
    }
  }

  getState() {
    if (typeof window === 'undefined') return this.defaultState;
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || this.defaultState;
    } catch {
      return this.defaultState;
    }
  }

  saveState(state) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    this.notify(state);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify(state) {
    this.listeners.forEach(l => l(state));
  }

  // --- REGISTRATION ---
  registerParticipant(name, sapId) {
    let state = this.getState();
    state.participants[sapId] = { name };
    this.saveState(state);
  }

  // --- ADMIN ACTIONS ---
  adminStartRound(index) {
    let state = this.getState();
    state.currentRoundIndex = index;
    state.rounds[index].status = 'active';
    state.rounds[index].startTime = Date.now();
    state.rounds[index].clicks = [];
    state.tournamentStatus = 'ongoing';
    this.saveState(state);
  }

  adminEndRound(index) {
    let state = this.getState();
    state.rounds[index].status = 'finished';
    this.saveState(state);
  }

  adminResetTournament() {
    this.saveState(this.defaultState);
  }

  // --- USER ACTIONS ---
  userBuzz(name, sapId, roundIndex) {
    let state = this.getState();
    const round = state.rounds[roundIndex];

    if (!round || round.status !== 'active') return false;
    
    // Prevent double clicking in the same round
    if (round.clicks.find(c => c.sapId === sapId)) return false;

    const now = Date.now();
    const msDelta = now - round.startTime;

    round.clicks.push({
      name: name,
      sapId: sapId,
      time: now,
      msDelta: msDelta
    });

    this.saveState(state);
    return true;
  }
}

export const syncEngine = new SyncEngine();
