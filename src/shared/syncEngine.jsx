// src/shared/syncEngine.jsx
const STORAGE_KEY = 'buzzerverse_tournament_state';

const ANIMALS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🦭'];

class SyncEngine {
  constructor() {
    this.listeners = [];

    this.defaultState = {
      rounds: [
        { name: 'Frontend', status: 'pending', currentQuestionIndex: 0, questions: [{ status: 'pending', clicks: [], evaluations: {} }] },
        { name: 'Backend', status: 'pending', currentQuestionIndex: 0, questions: [{ status: 'pending', clicks: [], evaluations: {} }] },
        { name: 'Mystery', status: 'pending', currentQuestionIndex: 0, questions: [{ status: 'pending', clicks: [], evaluations: {} }] }
      ],
      currentRoundIndex: 0,
      participants: {}, // sapId -> { name, profilePic, points }
      tournamentStatus: 'registration', // registration, ongoing, finished
      showPointsOnLeaderboard: true,
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.notify(this.getState());
        }
      });

      if (!localStorage.getItem(STORAGE_KEY)) {
        this.saveState(this.defaultState);
      } else {
        const state = this.getState();
        if (!state.rounds[0].questions) {
          this.saveState(this.defaultState);
        }
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

  registerParticipant(name, sapId) {
    let state = this.getState();
    if (!state.participants[sapId]) {
      const profilePic = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      state.participants[sapId] = { name, profilePic, points: 0 };
      this.saveState(state);
    }
  }

  adminStartRound(index) {
    let state = this.getState();
    state.currentRoundIndex = index;
    state.rounds[index].status = 'active';
    state.rounds[index].currentQuestionIndex = 0;
    state.rounds[index].questions = [{ 
      status: 'active', 
      clicks: [], 
      evaluations: {},
      startTime: Date.now() 
    }];
    state.tournamentStatus = 'ongoing';
    this.saveState(state);
  }

  adminNextQuestion(index) {
    let state = this.getState();
    const round = state.rounds[index];
    if (round.status === 'active') {
       if (round.questions[round.currentQuestionIndex]) {
           round.questions[round.currentQuestionIndex].status = 'finished';
       }
       round.questions.push({
           status: 'active',
           clicks: [],
           evaluations: {},
           startTime: Date.now()
       });
       round.currentQuestionIndex = round.questions.length - 1;
       this.saveState(state);
    }
  }

  adminEvaluateUser(sapId, roundIndex, qIndex, isCorrect) {
      let state = this.getState();
      const question = state.rounds[roundIndex].questions[qIndex];
      if (!question) return;

      const prevEval = question.evaluations[sapId];
      let pointChange = 0;

      if (prevEval !== undefined) {
          if (prevEval === true) pointChange -= 10;
          if (prevEval === false) pointChange += 5;
      }

      if (isCorrect === true) pointChange += 10;
      if (isCorrect === false) pointChange -= 5;
      
      question.evaluations[sapId] = isCorrect;
      
      if (state.participants[sapId]) {
          if (typeof state.participants[sapId].points !== 'number') {
              state.participants[sapId].points = 0;
          }
          state.participants[sapId].points += pointChange;
      }

      this.saveState(state);
  }

  adminConcludeRound(index) {
    let state = this.getState();
    state.rounds[index].status = 'concluded';
    const qIndex = state.rounds[index].currentQuestionIndex;
    if (state.rounds[index].questions[qIndex]) {
         state.rounds[index].questions[qIndex].status = 'finished';
    }
    this.saveState(state);
  }

  toggleLeaderboardPoints() {
      let state = this.getState();
      state.showPointsOnLeaderboard = !state.showPointsOnLeaderboard;
      this.saveState(state);
  }

  adminResetTournament() {
    this.saveState(this.defaultState);
  }

  userBuzz(sapId, roundIndex) {
    let state = this.getState();
    const round = state.rounds[roundIndex];

    if (!round || round.status !== 'active') return false;
    
    const currQuestion = round.questions[round.currentQuestionIndex];
    if (!currQuestion || currQuestion.status !== 'active') return false;

    if (currQuestion.clicks.find(c => c.sapId === sapId)) return false;

    const now = Date.now();
    const msDelta = now - currQuestion.startTime;

    currQuestion.clicks.push({
      sapId: sapId,
      time: now,
      msDelta: msDelta
    });

    this.saveState(state);
    return true;
  }
}

export const syncEngine = new SyncEngine();
