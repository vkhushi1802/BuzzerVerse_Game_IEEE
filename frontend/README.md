Project Overview
BuzzerVerse is designed for up to 100 concurrent users. It features a "Tension Engine" that uses biometric-inspired visual feedback (heartbeat pulses, screen shakes) to engage users before the buzzer even activates.

Tech Stack
Frontend: React.js, Vite

Animations: Framer Motion, CSS3 Keyframes

Icons/UI: Lucide React, Tailwind CSS

State Management: React Context API (GameContext)



frontend/
├── src/
│   ├── components/
│   │   ├── Arena/         # High-level screens (Entry, Waiting, Buzzer, Result)
│   │   ├── UI/            # Atomic elements (BuzzerOrb, NeonButton, GlassCard)
│   │   └── Shared/        # Global elements (LivingBackground)
│   ├── context/           # Game Logic & State (GameContext.jsx)
│   ├── hooks/             # Custom logic (useAudio, useTension)
│   ├── styles/            # Global & Cinematic CSS (index.css, effects.css)
│   └── App.jsx            # Screen Orchestrator
└── public/                # High-fidelity SFX and static assets


Getting Started
1. Installation
Clone the repository and install the dependencies:

Bash
git clone https://github.com/vkhushi1802/Buzzer_Game_IEEE.git
cd Buzzer_Game_IEEE/frontend
npm install

Dependencies
Ensure you have the following installed to handle the cinematic animations:

Bash
npm install framer-motion lucide-react
3. Development Server
Launch the arena:

Bash
npm run dev

