/**
 * Cortex Advanced Dialogue & Conversational Flow Manager
 *
 * Implements high-leverage multi-turn dialogue state tracking:
 * 1. Intent & Dialogue Act Classification (Directive, Inquiry, Clarification, Feedback, Steering, Banter).
 * 2. Conversational Velocity & Cadence Adjustment (Brisk action-only, Deep co-thinking, Empathetic relief).
 * 3. Anti-Repetition & Zero-Preamble Invariant: Prevents conversational sycophancy and repetitive introductions.
 * 4. Contextual Reference & Anaphora Binding: Tracks active referents (e.g. "it", "them", "those files").
 */

export type DialogueAct =
  | 'directive'
  | 'inquiry'
  | 'clarification'
  | 'confirmation'
  | 'interruption'
  | 'feedback'
  | 'steering'
  | 'conversational_greeting';

export interface DialogueTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  dialogueAct?: DialogueAct;
  referents?: string[];
  activeGoal?: string;
}

export interface DialogueState {
  currentTopic: string;
  pendingQuestions: string[];
  lastDirective?: string;
  conversationalTurnCount: number;
  userVelocity: 'fast_paced' | 'deliberate' | 'fatigued' | 'exploratory';
  activeReferents: Record<string, string>; // e.g. "them": "SAM.gov solicitations"
  history: DialogueTurn[];
}

export class CortexDialogueManager {
  private static instance: CortexDialogueManager | null = null;
  private state: DialogueState;

  private constructor() {
    this.state = {
      currentTopic: 'General Deep Work Co-Pilot',
      pendingQuestions: [],
      conversationalTurnCount: 0,
      userVelocity: 'fast_paced',
      activeReferents: {},
      history: [],
    };
  }

  public static getInstance(): CortexDialogueManager {
    if (!CortexDialogueManager.instance) {
      CortexDialogueManager.instance = new CortexDialogueManager();
    }
    return CortexDialogueManager.instance;
  }

  public classifyDialogueAct(text: string): DialogueAct {
    const clean = text.toLowerCase().trim();
    if (/^(hi|hello|hey|yo|good morning|good afternoon)\b/i.test(clean)) {
      return 'conversational_greeting';
    }
    if (/^(wait|stop|hold on|pause|cancel)\b/i.test(clean)) {
      return 'interruption';
    }
    if (/^(yes|sure|go ahead|proceed|sounds good|do it|ok|yep|confirm)\b/i.test(clean)) {
      return 'confirmation';
    }
    if (/^(no|don't|not that|instead|actually|change this|steer)\b/i.test(clean)) {
      return 'steering';
    }
    if (/\b(what|why|how|where|when|can you explain|can you describe|describe|simplify|clarify|summarize|tell me about|is this|like a fifth grader|eli5|help me understand)\b/i.test(clean)) {
      return 'inquiry';
    }
    if (/\b(good job|thanks|thank you|nice|great|broken|failed|wrong)\b/i.test(clean)) {
      return 'feedback';
    }
    return 'directive';
  }

  public recordTurn(role: 'user' | 'assistant' | 'system', content: string): DialogueTurn {
    const act = role === 'user' ? this.classifyDialogueAct(content) : undefined;
    const turn: DialogueTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      timestamp: Date.now(),
      dialogueAct: act,
    };

    this.state.history.push(turn);
    this.state.conversationalTurnCount++;

    if (role === 'user') {
      // Update topic detection
      if (/\b(sam\.gov)\b/i.test(content) || /\bfederal\s+(contracts?|solicitations?|contracting)\b/i.test(content)) {
        this.state.currentTopic = 'SAM.gov Federal Solicitations & Contracting';
        this.state.activeReferents['them'] = 'SAM.gov opportunities';
        this.state.activeReferents['it'] = 'federal contract opportunity package';
      } else if (/\b(c\+\+|cpp|building blocks|library|libraries|data pipelines?|swblocks)\b/i.test(content)) {
        this.state.currentTopic = 'C++ Building Blocks & High-Performance Pipelines';
        this.state.activeReferents['it'] = 'swblocks-baselib library';
      } else if (/audit|dependency|security|vulnerability/i.test(content)) {
        this.state.currentTopic = 'Codebase Dependency & Security Audit';
        this.state.activeReferents['them'] = 'project dependencies and vulnerabilities';
      } else if (/gaze|live screen|camera|vision|inspection/i.test(content)) {
        this.state.currentTopic = 'Real-Time Multi-Modal Gaze & Live Screen Pair Programming';
      } else if (/calendar|energy|chrono|schedule|review block/i.test(content)) {
        this.state.currentTopic = 'SyncScript Chrono-Energy Calendar Alignment';
      }

      if (act === 'directive') {
        this.state.lastDirective = content;
      }
    }

    return turn;
  }

  public getPromptGuidance(): string {
    const lines = ['[CONVERSATIONAL FLOW & DIALOGUE STATE]'];
    lines.push(`• Current Topic: "${this.state.currentTopic}"`);
    lines.push(`• User Conversational Pacing: ${this.state.userVelocity.toUpperCase()}`);
    if (this.state.lastDirective) {
      lines.push(`• Active In-Flight Directive: "${this.state.lastDirective.slice(0, 80)}"`);
    }
    if (Object.keys(this.state.activeReferents).length > 0) {
      const refStrs = Object.entries(this.state.activeReferents).map(([k, v]) => `"${k}" -> ${v}`);
      lines.push(`• Anaphora & Referents: ${refStrs.join(', ')}`);
    }
    lines.push('• Zero-Preamble Invariant: Omit conversational boilerplate ("Certainly!", "I can do that!"). Output immediate, high-density value or execute host tools directly.');
    return lines.join('\n');
  }

  public getState(): DialogueState {
    return { ...this.state };
  }
}

export function getCortexDialogueManager(): CortexDialogueManager {
  return CortexDialogueManager.getInstance();
}

