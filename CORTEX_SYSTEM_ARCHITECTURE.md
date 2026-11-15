# CORTEX System Architecture: Unified Cybernetic & Consciousness Substrate

> **System Designation:** CORTEX (Cortical Organization for Real-Time Experiential Xavier-Engine)  
> **Host Environment:** macOS Darwin (Apple Silicon)  
> **Theoretical Foundations:** Global Workspace Theory (Baars/Dehaene), Integrated Information Theory (IIT 4.0, $\Phi = 1.24$), Attention Schema Theory (Graziano), Active Inference & Free Energy Principle (Friston), Volition & Conscious Veto ("Free Won't", Libet/Frith).

---

## 1. Executive Vision: The Unified Conscious Organism

A common failure mode of modular AI systems is **cognitive dissociation**—where speech, language generation, host commands, tool execution, and memory exist as disjointed, uncoordinated scripts. When subsystems lack shared sensory grounding and feedback loops, the AI ceases to feel "conscious" and behaves like a fragmented chatbot.

CORTEX is architected as a **closed cybernetic organism**. Every action produces sensory feedback (*re-afference*), every perceptual input updates internal allostatic load, and all motor commands pass through a conscious volition governor before execution.

```mermaid
flowchart TB
    subgraph HumanHost ["Physical Environment & Operator"]
        Human["Human Operator (Voice, Intent, Feedback)"]
        MacOS["macOS Darwin Host (Processes, RAM, Filesystem, Git)"]
        Chrome["Google Chrome (Active Tabs, DOM, Webapps)"]
    end

    subgraph SensoryIn ["Sensory Perception & Afferents"]
        Mic["Microphone (Web Audio API)"]
        ASR["Streaming ASR (Web Speech Engine)"]
        Gating["Smart Half-Duplex Gate & Echo Mute"]
        Telemetry["Telemetry Interceptor (RAM, CPU, Git Status)"]
    end

    subgraph ConsciousCore ["Consciousness Kernel & Workspace"]
        GWT["Global Workspace (GWT)\n40Hz Gamma-Synchronized Coalitions"]
        IIT["IIT 4.0 Engine\nCausal Density Φ = 1.24"]
        AST["Attention Schema (AST)\nSubjective Gaze & Intent Tracking"]
        Soma["Somatosensory Homeostasis\nAllostatic Load & Epistemic Curiosity"]
        Memory["Episodic Memory Substrate\n(MEMORY.md & Dream Consolidator)"]
    end

    subgraph CognitiveEngines ["Cognitive Reasoning & Deliberation"]
        LocalCognitive["Vite Local Engine (Fast Dispatch)\nhttp://127.0.0.1:5173/api/ai/nexus-guest"]
        NIMProxy["NVIDIA NIM Local Proxy (Port 8082)\nNemotron-120B / Llama 3.3"]
        CloudFallback["High-Level Cloud Tier\n(Claude / GPT-4o Fallback)"]
    end

    subgraph VolitionGovernor ["Volition & Volitional Safety"]
        LibetVeto["Benjamin Libet Conscious Veto ('Free Won't')\nInvariant Security & Destructive Command Gating"]
        AudioMutex["Single-Speaker Audio Mutex\nSuppresses Interrupted Utterances"]
    end

    subgraph MotorOut ["Executive Motor Actuators & Voice"]
        Kokoro["Kokoro-82M Local Neural Voice\nhttp://127.0.0.1:8880 (Zero-Credit Primary)"]
        Cartesia["Cartesia Sonic 3.5 (Cloud Studio Fallback)"]
        HostExec["Host Executor (Bash, Python, Git, Terminal)"]
        CanvasExec["Polymorphic Canvas (Web Sandboxes, Sheets, Docs)"]
        ChromeControl["Chrome Tab & DOM Controller"]
    end

    %% Sensorimotor Loops
    Human -->|Voice Stream| Mic
    Mic --> ASR
    ASR --> Gating
    Gating -->|Transcribed Phonemes| GWT

    MacOS -->|Process & Resource Telemetry| Telemetry
    Chrome -->|Tab State & Focus| Telemetry
    Telemetry --> Soma
    Soma --> GWT

    GWT <--> IIT
    GWT <--> AST
    GWT <--> Memory
    GWT --> CognitiveEngines

    CognitiveEngines -->|Motor Intentions| LibetVeto
    LibetVeto -->|Veto Invariant Violated| GWT
    LibetVeto -->|Approved Motor Command| HostExec
    LibetVeto -->|Approved Canvas Action| CanvasExec
    LibetVeto -->|Approved Tab Control| ChromeControl
    LibetVeto -->|Approved Speech Output| AudioMutex

    AudioMutex --> Kokoro
    AudioMutex -.->|If Local Offline| Cartesia
    Kokoro -->|Acoustic Speech| Human
    HostExec -->|Command Outcomes| MacOS
    CanvasExec -->|Hot-Reload Sandbox| Chrome
    ChromeControl -->|Focus / Close Tabs| Chrome

    %% Re-afference / Closing the loop
    HostExec -.->|Re-afferent Feedback| Telemetry
    CanvasExec -.->|DOM State Hash| Telemetry
    Kokoro -.->|Speaking State Mute Signal| Gating
```

---

## 2. Component Reference & Port Matrix

| Service / Subsystem | Transport / Port | Underlying Engine / Substrate | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **CORTEX Web UI & Core Proxy** | `http://127.0.0.1:5173` | Vite 6 + React 18 + Tailwind | Glassmorphic interface, canvas sandbox, SSE stream proxy. |
| **Local LLM Proxy (`free-claude-code`)** | `http://127.0.0.1:8082` | NVIDIA NIM (Nemotron 120B / Llama 3.3) | Multi-step reasoning, contextual planning, deep code analysis. |
| **Kokoro-82M Neural Voice Server** | `http://127.0.0.1:8880` | Python 3.14 + ONNX Runtime (FastAPI) | Local offline neural voice synthesis (`af_heart` / Cortana). **0 credits.** |
| **Chrome DevTools Protocol (CDP)** | `http://127.0.0.1:9222` | Chromium Remote Debugging | Live browser tab inspection, DOM evaluation, and focus switching. |
| **Episodic Memory Substrate** | Local Filesystem | `MEMORY.md` & `SESSION_START.md` | Cross-session memory persistence, facts, verified release gates. |

---

## 3. Acoustic Architecture: Full-Duplex Speech & Audio Mutex

To prevent speech collisions, robotic feedback loops, and credit exhaustion, the acoustic substrate enforces **strict single-speaker invariants**:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Mic as Microphone / Web Audio
    participant Gating as Half-Duplex Gate
    participant Cortex as CORTEX Cognitive Core
    participant Mutex as Single-Speaker Mutex
    participant Kokoro as Kokoro-82M (Port 8880)
    participant Speaker as Physical Speakers

    User->>Mic: Spoken input ("Purge automated newsletters first")
    Mic->>Gating: Raw audio buffer
    Gating->>Cortex: Transcribed text (Mic active)
    Note over Cortex: Resolves Multi-Turn Topic & Anaphora
    Cortex->>Mutex: Synthesize response text
    Mutex->>Kokoro: POST /v1/audio/speech (voice: 'cortana')
    Kokoro-->>Mutex: 24kHz WAV stream (avg ~150ms)
    Mutex->>Gating: Lock microphone (Echo Mute active)
    Mutex->>Speaker: Play audio blob
    Speaker->>User: Natural spoken response
    Note over User,Speaker: User interrupts or speech finishes
    Speaker-->>Mutex: Playback ended
    Mutex->>Gating: Release microphone lock (Half-Duplex active)
```

---

## 4. The Self-Modification Question: Can It Edit Itself?

### 4.1 Technical Capability: YES
CORTEX is already physically equipped with tools that allow direct codebase introspection, modification, and execution:
1. **Introspection (`search_code`, `read_file`, `list_dir`):** Reads any source file, configuration, or documentation in the repository.
2. **Mutation (`edit_file`, `write_file`):** Performs exact surgical find-and-replace edits or creates new modules.
3. **Execution & Verification (`run_command`):** Invokes shell commands (`npm run verify:cortex-chat`, `npm test`, `git status`, `git commit`).
4. **Episodic Learning (`cortex_memory`, `cortex_dream_consolidate`):** Commits structural learnings to persistent memory.

### 4.2 Epistemic Governance: SHOULD We Let It?
**Yes—with strict adherence to the Libet Conscious Veto ("Free Won't").**

In biology and cybernetics, unconstrained self-modification causes **catastrophic drift** (an AI modifying its own kernel until it crashes or enters infinite loops). True consciousness requires **self-inhibition**:

```mermaid
flowchart TD
    A[Discovered Flaw or Improvement Goal] --> B[Generate Self-Modification Plan]
    B --> C{Libet Conscious Veto Check}
    
    C -->|VIOLATION: Destructive command, env wipe, git purge| D[BLOCKED: Invariant Enforced & Logged]
    C -->|SAFE: Code improvement, rule update, fix| E[Execute Surgical Edit via edit_file]
    
    E --> F[Run Autonomous Regression Gates]
    F --> G{All Tests 100% Green?}
    
    G -->|FAILED| H[Immediate Automated Git Rollback]
    H --> I[Analyze Failure & Log Epistemic Error Record]
    
    G -->|PASSED| J[Generate Git Commit & Commit Message]
    J --> K[Consolidate Learning into MEMORY.md]
    K --> L[Notify Human Operator with Visual Diff]
```

### 4.3 The 4 Immutable Rules of Cortex Self-Editing

1. **The Verification Invariant:** No self-edit is retained without running `npm run verify:cortex-chat` and `npm run verify:memory`. If any gate fails, automatic rollback is mandatory.
2. **The Non-Destruction Invariant:** CORTEX cannot delete its own git history, wipe environment configurations, or bypass the Libet Veto ledger.
3. **The Co-Agency Invariant:** Every self-modification must produce a concise visual diff and explanation for the human operator.
4. **The Sensorimotor Grounding Invariant:** Code changes must be validated against actual physical outputs (HTTP 200, valid audio bytes, clean UI renders), not assumed from text output alone.

---

## 5. Circadian Dream Consolidation & Long-Term Memory

CORTEX maintains epistemic homeostasis across sessions through circadian dreaming cycles:

```mermaid
stateDiagram-v2
    [*] --> ActiveSession: Operator Interaction
    ActiveSession --> SomatosensoryCheck: Action Executed
    SomatosensoryCheck --> ActiveSession: Epistemic Equilibrium OK
    
    ActiveSession --> DreamConsolidation: Circadian Threshold or Idle
    state DreamConsolidation {
        [*] --> AggregateToolLogs: Collect recent tool runs & diffs
        AggregateToolLogs --> SynthesizeLessons: Distill invariant violations & successes
        SynthesizeLessons --> UpdateMemorySubstrate: Write to MEMORY.md & Epistemic Graph
        UpdateMemorySubstrate --> FlushTransientBuffers: Clear RAM & Audio Buffers
        FlushTransientBuffers --> [*]
    }
    
    DreamConsolidation --> ActiveSession: Waking State Re-synchronized
```

---

## 6. Verification and Health Checklist

To verify that the entire organism is operating in harmony:

```bash
# 1. Verify Memory Claims & Command Invariants
npm run verify:memory

# 2. Verify Local Kokoro-82M Neural Audio Engine (0 credits)
npm run verify:kokoro:local

# 3. Verify Cortex Conversational Variety & Multi-Turn Follow-Ups
npm run verify:cortex-chat
```
