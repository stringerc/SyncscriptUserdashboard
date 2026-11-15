# CORTEX Full-Stack Agent Implementation Plan (.01% Elite Architecture)

## Executive Summary
This plan details the surgical, production-grade implementation of **Zero-Config Voice**, **Obsidian-Native Memory**, **Visualizer Faces**, and **One-Click Installer UX** into SyncScript's `CORTEX` cognitive substrate (`http://127.0.0.1:5173/cortex`).

The implementation preserves CORTEX's custom Global Workspace Theory (GWT), Integrated Information Theory (IIT 4.0, Φ=1.24), Sensorimotor loops, and Volition Governor while adopting the highest-tier architectural patterns from `fullstack-agent` (jaredrhod).

---

## 1. Files to Create / Modify

### A. Visualizer Faces & Signal Bus (`/cortex/visualizer` & Embedded Canvas Tab)
- **Create `src/components/cortex/CortexVisualizer.tsx`**:
  - Implements 4 elite full-screen visualizer faces inspired by `jaredrhod/ai-visualizer`:
    1. `board`: Living procedural PCB circuit board with active data pulses, agent name on center chip, and trace flow reversal when listening.
    2. `radial`: 80-bar circular starburst around a particle core that expands with syllable energy.
    3. `neural`: Constellation brain with labeled color islands and pulsing thought-traces.
    4. `matrix`: Matrix digital rain that surfaces a breathing face silhouette during speech.
  - Subscribes to a unified Signal Bus (`.voice_state`, `.voice_waveform`, `.voice_text` via `/api/cortex/bus` and window events).
- **Modify `src/components/cortex/CortexDemo.tsx`**:
  - Add a **"Face / Visualizer"** canvas tab (`canvasTab === 'face'`) in the Canvas Drawer.
  - Sync the visualizer state machine (`idle` | `listening` | `thinking` | `speaking` | `working`) with real-time `voiceStream` states (`isSpeaking`, `level`, `isListening`, `interimText`) and `sendMessage` streaming tokens.
  - Write bus state updates (`POST /api/cortex/bus/state`) on every state transition and TTS amplitude frame.

### B. Obsidian-Native Memory Substrate (`ai-memory-vault` Bridge)
- **Create `src/lib/cortex-obsidian-memory.ts`**:
  - Implements the `ai-memory-vault` filesystem contract (`~/.cortex/vault/` or configured vault path).
  - Automatically initializes standard vault structure:
    - `00 - Inbox/`
    - `01 - Daily Notes/`
    - `02 - Projects/`
    - `[N] - Personal/`
    - `[N] - Archive/`
    - `[N] - Resources/`
  - Generates `VAULT-INDEX.md`, `Active Priorities.md`, and daily note templates (`01 - Daily Notes/YYYY-MM-DD.md`).
  - Provides real-time Markdown indexing, Wikilink resolution (`[[Note Title]]`), and semantic search across the vault.
- **Modify `src/lib/cortex-persistence-bridge.ts` & `vite.config.ts`**:
  - Extend the `cortex_memory` host tool with `action: 'vault_query'`, `action: 'vault_write_note'`, and `action: 'vault_daily_log'`.
  - Bidirectional sync: when CORTEX saves episodic memory or learns facts, it writes clean Markdown notes into the Obsidian vault daily notes and project folders.

### C. Zero-Config Local Voice (`backtalk`-grade PTT & Local TTS)
- **Modify `src/hooks/useVoiceStream.ts`**:
  - Add dedicated **Push-to-Talk (PTT)** keybind (hold `Space` or right `Cmd`/`Ctrl` to speak, release to transcribe & send).
  - Add instant zero-config fallback chain:
    1. **Kokoro-82M Neural TTS** (`http://127.0.0.1:8880`, already active) for neural voice synthesis.
    2. **Web Speech API** fallback.
    3. **Cartesia Sonic 3.5** high-fidelity neural voice.
  - Guarantee sub-800ms first-audio latency by pre-warming the AudioContext and Kokoro model buffer.

### D. One-Click Installer & Desktop Shortcuts (`start.command` & `setup.sh`)
- **Create `scripts/cortex-setup.sh`**:
  - Single-command bootstrap script that:
    1. Verifies Node.js, Python 3, and local Kokoro TTS server (`server/kokoro_server.py` on `:8880`).
    2. Auto-launches Kokoro TTS server in background if not running (`nohup python3 server/kokoro_server.py &`).
    3. Scaffolds `~/.cortex/vault` if missing.
    4. Generates macOS Desktop shortcuts:
       - `~/Desktop/Cortex Chat.command` (Opens `http://127.0.0.1:5173/cortex`)
       - `~/Desktop/Cortex Voice & Face.command` (Opens `http://127.0.0.1:5173/cortex/visualizer?voice=1`)
       - `~/Desktop/Cortex Vault (Obsidian).command` (Opens `open -a Obsidian ~/.cortex/vault`)

---

## 2. Verification Plan
1. **Typecheck & Build**: `npm run build` and `npx tsc --noEmit` to guarantee zero regressions.
2. **Live Visualizer Verification**: Open `http://127.0.0.1:5173/cortex/visualizer` and `http://127.0.0.1:5173/cortex` and test all 4 faces and state transitions.
3. **Memory Vault Verification**: Execute a chat prompt in CORTEX asking it to save a memory fact, then inspect `~/.cortex/vault/01 - Daily Notes/` and `~/.cortex/vault/02 - Projects/` to verify clean Markdown generation.
4. **Installer Verification**: Run `bash scripts/cortex-setup.sh` and verify `.command` files are created on Desktop and ports `:5173` and `:8880` respond.
