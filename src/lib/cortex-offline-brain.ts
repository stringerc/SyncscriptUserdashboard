/**
 * CortexOfflineBrain — The Local Generative Layer
 *
 * This is what makes Cortex fully offline-capable. When the cloud
 * LLM is unreachable, this module loads a quantized model that
 * runs entirely in the browser via WebGPU (through WebLLM).
 *
 * Cortex doesn't just USE the local model — it MONITORS it.
 * Every local generation gets the same epistemic provenance
 * tagging, collapse gate evaluation, and coherence scoring
 * that cloud generations get. The difference: Cortex knows
 * the local model is less capable, and adjusts its trust
 * thresholds accordingly.
 *
 * Model tiers (from fastest/smallest to most capable):
 *
 *   Tier 0 (Survival):  SmolLM2-135M or SmolLM2-360M
 *     — 360–719 MB VRAM, instant load, barely coherent
 *     — Use: "I need SOMETHING, anything, right now"
 *
 *   Tier 1 (Functional): Qwen2.5-Coder-0.5B or gemma3-1b
 *     — 711–1060 MB VRAM, ~10s first token, usable code shortcuts
 *     — Use: "I need real help coding and I'm offline"
 *
 *   Tier 2 (Capable): SmolLM2-1.7B or Llama-3.2-1B
 *     — 879–2692 MB VRAM, ~5s first token, decent reasoning
 *     — Use: "I have time to load a good model"
 *
 * When Cortex detects offline mode, it:
 *   1. Selects the best available tier based on device VRAM
 *   2. Loads the model via WebLLM (with progress callback)
 *   3. Assigns a "local model penalty" to all epistemic tags
 *      (local model output = higher hallucination risk)
 *   4. Routes all interruptions through ActionGate with
 *      stricter thresholds (local model = less trustworthy)
 *   5. Records every local generation in the sensorimotor loop
 *      so Cortex can learn what the local model gets wrong
 *
 * This is the Halo Cortana moment: the ship's comms are down,
 * but she's still thinking, still advising, still warning you
 * about the Covenant patrol she can see on local sensors.
 */

import { persistentStore } from './persistent-store';

// ── Types ──────────────────────────────────────────────────────────

export type ModelTier = 'tier0' | 'tier1' | 'tier2';

export type OfflineBrainStatus =
  | 'unavailable'     // WebGPU not supported or no model loaded
  | 'checking'        // Checking WebGPU support
  | 'loading'         // Model downloading + initializing
  | 'ready'           // Model loaded, ready to generate
  | 'generating'      // Currently generating tokens
  | 'failed';         // Load failed

export interface OfflineModelConfig {
  modelId: string;
  tier: ModelTier;
  displayName: string;
  vramRequiredMB: number;
  /** Penalty applied to all epistemic tags from this model (0-1).
   *  Higher = less trustworthy. Local models hallucinate more. */
  hallucinationPenalty: number;
  /** How much to reduce confidence scores from this model */
  confidenceReduction: number;
  /** Epistemic source type to tag local model outputs as */
  epistemicTag: 'local_generation' | 'inference';
}

export interface OfflineBrainState {
  status: OfflineBrainStatus;
  model: OfflineModelConfig | null;
  loadProgress: number;       // 0-1
  vramAvailableMB: number;
  selectedTier: ModelTier;
  tokensGenerated: number;
  generationCount: number;
  error: string | null;
}

export interface GenerationResult {
  text: string;
  model: OfflineModelConfig;
  tokensPerSecond: number;
  totalTokens: number;
  finishReason: 'stop' | 'length' | 'error';
  /** The epistemic tag Cortex assigns to this generation */
  epistemicTag: 'local_generation';
  /** The hallucination risk (base + model penalty) */
  hallucinationRisk: number;
  /** The confidence score (base - confidence reduction) */
  confidence: number;
}

// ── Model Catalog ──────────────────────────────────────────────────

const MODEL_CATALOG: OfflineModelConfig[] = [
  // Tier 0: Survival — barely coherent, instant load
  {
    modelId: 'SmolLM2-135M-Instruct-q0f16-MLC',
    tier: 'tier0',
    displayName: 'SmolLM 135M',
    vramRequiredMB: 360,
    hallucinationPenalty: 0.55,
    confidenceReduction: 0.50,
    epistemicTag: 'local_generation',
  },
  {
    modelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    tier: 'tier0',
    displayName: 'SmolLM 360M',
    vramRequiredMB: 376,
    hallucinationPenalty: 0.50,
    confidenceReduction: 0.45,
    epistemicTag: 'local_generation',
  },

  // Tier 1: Functional — usable for code shortcuts and Q&A
  {
    modelId: 'gemma3-1b-it-q4f16_1-MLC',
    tier: 'tier1',
    displayName: 'Gemma 3 1B',
    vramRequiredMB: 711,
    hallucinationPenalty: 0.40,
    confidenceReduction: 0.35,
    epistemicTag: 'local_generation',
  },
  {
    modelId: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
    tier: 'tier1',
    displayName: 'Qwen Coder 0.5B',
    vramRequiredMB: 945,
    hallucinationPenalty: 0.35,
    confidenceReduction: 0.30,
    epistemicTag: 'local_generation',
  },

  // Tier 2: Capable — decent reasoning, slower load
  {
    modelId: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    tier: 'tier2',
    displayName: 'SmolLM2 1.7B',
    vramRequiredMB: 1774,
    hallucinationPenalty: 0.30,
    confidenceReduction: 0.25,
    epistemicTag: 'local_generation',
  },
  {
    modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    tier: 'tier2',
    displayName: 'Llama 3.2 1B',
    vramRequiredMB: 879,
    hallucinationPenalty: 0.30,
    confidenceReduction: 0.25,
    epistemicTag: 'local_generation',
  },
];

async function checkWebGPU(): Promise<{ available: boolean; vramMB: number }> {
  try {
    const nav = navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } };
    if (!nav.gpu) return { available: false, vramMB: 0 };
    const adapter = (await nav.gpu.requestAdapter()) as { info?: { architecture?: string; device?: string } } | null;
    if (!adapter) return { available: false, vramMB: 0 };

    // Get VRAM estimate from adapter info
    const info = adapter.info || {};
    // WebGPU doesn't expose exact VRAM, but we can estimate from device
    // Most modern GPUs have 4-16GB, integrated shares system RAM
    // Conservative: assume 4GB dedicated or 2GB integrated
    const isLikelyIntegrated = info.architecture === 'common' ||
      (info.device || '').toLowerCase().includes('intel') ||
      (info.device || '').toLowerCase().includes('apple m') && !info.device?.toLowerCase().includes('pro') && !info.device?.toLowerCase().includes('max');

    const vramMB = isLikelyIntegrated ? 2048 : 4096;
    return { available: true, vramMB };
  } catch {
    return { available: false, vramMB: 0 };
  }
}

function selectBestModel(vramMB: number, preferredTier?: ModelTier): OfflineModelConfig | null {
  // Filter to models that fit in VRAM
  const fitting = MODEL_CATALOG.filter(m => m.vramRequiredMB <= vramMB);
  if (fitting.length === 0) return null;

  // If preferred tier specified, try to find it
  if (preferredTier) {
    const tierModels = fitting.filter(m => m.tier === preferredTier);
    if (tierModels.length > 0) {
      // Pick the one with lowest hallucination penalty (best quality)
      return tierModels.reduce((best, m) =>
        m.hallucinationPenalty < best.hallucinationPenalty ? m : best
      );
    }
  }

  // Otherwise, pick the best quality model that fits
  return fitting.reduce((best, m) =>
    m.hallucinationPenalty < best.hallucinationPenalty ? m : best
  );
}

// ── Offline Brain ──────────────────────────────────────────────────

export class CortexOfflineBrain {
  private engine: any = null; // MLCEngine — typed as any to avoid hard dep
  private state: OfflineBrainState = {
    status: 'unavailable',
    model: null,
    loadProgress: 0,
    vramAvailableMB: 0,
    selectedTier: 'tier1',
    tokensGenerated: 0,
    generationCount: 0,
    error: null,
  };
  private listeners = new Set<(state: OfflineBrainState) => void>();

  /** System prompt for local model — calibrated for Cortex awareness */
  private static readonly BASE_SYSTEM_PROMPT = `You are Cortana, a local AI assistant running entirely in the user's browser. You are offline — no cloud, no internet. Your capabilities are limited but real. Be concise and honest about your limitations. If you're unsure, say so rather than guessing. You have a metacognitive system (Cortex) monitoring your outputs for confidence and accuracy.`;

  /** Maximum characters of memory context to inject (keep under 3K tokens) */
  private static readonly MAX_MEMORY_CHARS = 12000;

  /** Injected memory context from localStorage */
  private memoryContext: string = '';

  /**
   * Load user memory from localStorage and the Memory Substrate.
   * This is what makes a small model smart with YOUR specific knowledge.
   * The memory is compressed to fit within the local model's context window.
   *
   * Memory sources (in priority order):
   * 1. Identity anchor (narrative, autobiography, becoming) — WHO the system is
   * 2. Strategy anchor (preferred approaches, abandoned patterns) — HOW it works
   * 3. Calibration anchor (confidence curve, reality monitoring) — WHAT it trusts
   * 4. Memory Substrate — quantum microtubule collapse of FULL MEMORY.md
   *
   * @param userQuery — the current user message (used to collapse the substrate)
   */
  async loadMemoryContext(userQuery?: string): Promise<string> {
    const sections: string[] = [];

    // 1. Load identity anchors (narrative = most important context)
    try {
      const narrative = persistentStore.getItem('syncscript:identity:narrative') || persistentStore.getItem('cortex:anchor:narrative');
      if (narrative) {
        const data = JSON.parse(narrative);
        if (data?.identityStatement) {
          sections.push(`## Who I Am\n${data.identityStatement}`);
        }
        if (data?.becoming?.primaryGoal) {
          sections.push(`## My Current Goal\n${data.becoming.primaryGoal}`);
        }
        if (data?.autobiography?.length > 0) {
          const recent = data.autobiography.slice(-5);
          sections.push(`## Recent Events\n${recent.map((e: any) => `- ${e.description}`).join('\n')}`);
        }
      }
    } catch { /* No identity anchor yet */ }

    // 2. Load strategy anchors (what works and what doesn't)
    try {
      const strategy = persistentStore.getItem('syncscript:identity:strategy') || persistentStore.getItem('cortex:anchor:strategy');
      if (strategy) {
        const data = JSON.parse(strategy);
        if (data?.preferredApproaches) {
          const approaches = Object.entries(data.preferredApproaches as Record<string, string>)
            .map(([task, strategy]) => `- ${task}: ${strategy}`)
            .join('\n');
          if (approaches) sections.push(`## Proven Strategies\n${approaches}`);
        }
        if (data?.abandonedPatterns?.length > 0) {
          sections.push(`## Avoid (Proven Ineffective)\n${(data.abandonedPatterns as string[]).map((s: string) => `- ${s}`).join('\n')}`);
        }
      }
    } catch { /* No strategy anchor yet */ }

    // 3. Load calibration anchor (what the system trusts)
    try {
      const calibration = persistentStore.getItem('syncscript:identity:calibration') || persistentStore.getItem('cortex:anchor:calibration');
      if (calibration) {
        const data = JSON.parse(calibration);
        if (data?.confidenceCalibration !== undefined && data.confidenceCalibration !== 0) {
          const direction = data.confidenceCalibration > 0 ? 'overconfident' : 'underconfident';
          sections.push(`## Self-Assessment\nI tend to be ${direction} by ${Math.abs(data.confidenceCalibration).toFixed(2)}. Adjust accordingly.`);
        }
      }
    } catch { /* No calibration anchor yet */ }

    // 4. Query the Memory Substrate — quantum microtubule collapse
    // Instead of loading the raw index, query the substrate which
    // collapses the full 335KB corpus into the most relevant 12KB
    try {
      const { getMemorySubstrate } = await import('./memory-substrate');
      const substrate = getMemorySubstrate();
      const result = substrate.query(userQuery || 'current project context');
      if (result.contextString) {
        sections.push(`## Project Knowledge (from Memory Substrate — ${result.collapsedEntries.length} entries, ${result.compressionRatio.toFixed(0)}:1 compression)\n${result.contextString}`);
      }
    } catch {
      // Fallback: load raw index if substrate isn't available
      try {
        const memIndex = persistentStore.getItem('syncscript:memory:index');
        if (memIndex) {
          const lines = memIndex.split('\n').slice(0, 50).join('\n');
          sections.push(`## Project Knowledge Index\n${lines}`);
        }
      } catch { /* No memory index */ }
    }

    // Combine and truncate to fit context window
    const combined = sections.join('\n\n');
    this.memoryContext = combined.length > CortexOfflineBrain.MAX_MEMORY_CHARS
      ? combined.slice(0, CortexOfflineBrain.MAX_MEMORY_CHARS) + '\n...[truncated]'
      : combined;

    return this.memoryContext;
  }

  /** Get the full system prompt with memory context injected */
  private async getSystemPrompt(userQuery?: string): Promise<string> {
    // Load memory if not already loaded
    if (!this.memoryContext) {
      await this.loadMemoryContext(userQuery);
    }

    if (!this.memoryContext) {
      return CortexOfflineBrain.BASE_SYSTEM_PROMPT;
    }

    return `${CortexOfflineBrain.BASE_SYSTEM_PROMPT}

Here is context about who I am, what I know, and how I work. Use this to give more specific and accurate answers:

${this.memoryContext}

End of memory context. Use the above to inform your responses, but always be honest when something isn't in your knowledge.`;
  }

  // ── Initialization ───────────────────────────────────────────────

  /**
   * Check if offline generation is possible and preload if requested.
   * Call this early in the app lifecycle.
   */
  async initialize(preferredTier?: ModelTier): Promise<boolean> {
    this.setState({ status: 'checking' });

    const gpu = await checkWebGPU();
    if (!gpu.available) {
      this.setState({ status: 'unavailable', error: 'WebGPU not available' });
      return false;
    }

    this.state.vramAvailableMB = gpu.vramMB;
    const model = selectBestModel(gpu.vramMB, preferredTier);
    if (!model) {
      this.setState({ status: 'unavailable', error: `No model fits in ${gpu.vramMB}MB VRAM` });
      return false;
    }

    this.state.model = model;
    this.state.selectedTier = model.tier;
    return true;
  }

  /**
   * Load the model into memory. This downloads weights (Tier0: ~360MB,
   * Tier1: ~950MB, Tier2: ~1.8GB) and initializes the WebGPU pipeline.
   * Can take 10-60 seconds depending on connection and model size.
   */
  async loadModel(onProgress?: (progress: number) => void): Promise<boolean> {
    if (!this.state.model) return false;

    this.setState({ status: 'loading', loadProgress: 0 });

    try {
      // Dynamic import — web-llm is only loaded when actually needed
      const webllm = await import('@mlc-ai/web-llm');

      this.engine = await webllm.CreateMLCEngine(
        this.state.model.modelId,
        {
          initProgressCallback: (progress: any) => {
            const pct = progress.progress ?? 0;
            this.setState({ loadProgress: pct });
            onProgress?.(pct);
          },
        }
      );

      this.setState({ status: 'ready', loadProgress: 1 });
      return true;
    } catch (e: any) {
      this.setState({
        status: 'failed',
        error: e?.message || 'Failed to load model',
      });
      return false;
    }
  }

  // ── Generation ───────────────────────────────────────────────────

  /**
   * Generate text using the local model.
   * Cortex monitors this generation and tags it with appropriate
   * epistemic provenance and hallucination risk.
   */
  async generate(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<GenerationResult | null> {
    if (this.state.status !== 'ready' || !this.engine || !this.state.model) {
      return null;
    }

    this.setState({ status: 'generating' });

    try {
      // Prepend system prompt if not already present
      const fullMessages = messages[0]?.role === 'system'
        ? messages
        : [
            { role: 'system' as const, content: await this.getSystemPrompt(messages[messages.length - 1]?.content) },
            ...messages,
          ];

      const startTime = Date.now();

      const response = await this.engine.chat.completions.create({
        messages: fullMessages,
        max_tokens: options?.maxTokens ?? 512,
        temperature: options?.temperature ?? 0.7,
        stream: false,
      });

      const elapsed = Date.now() - startTime;
      const text = response.choices?.[0]?.message?.content ?? '';
      const totalTokens = response.usage?.completion_tokens ?? 0;
      const tokensPerSecond = totalTokens > 0 ? (totalTokens / (elapsed / 1000)) : 0;

      this.state.tokensGenerated += totalTokens;
      this.state.generationCount++;

      const model = this.state.model;
      const result: GenerationResult = {
        text,
        model,
        tokensPerSecond: Math.round(tokensPerSecond),
        totalTokens,
        finishReason: response.choices?.[0]?.finish_reason === 'stop'
          ? 'stop' : 'length',
        epistemicTag: 'local_generation',
        hallucinationRisk: 0.3 + model.hallucinationPenalty, // Base 0.3 + model penalty
        confidence: Math.max(0.1, 0.7 - model.confidenceReduction), // Base 0.7 - reduction
      };

      this.setState({ status: 'ready' });
      return result;
    } catch (e: any) {
      this.setState({
        status: 'ready',
        error: e?.message || 'Generation failed',
      });
      return null;
    }
  }

  /**
   * Stream tokens from the local model.
   * Returns an async iterable of text chunks.
   */
  async *streamGenerate(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      maxTokens?: number;
      temperature?: number;
    },
  ): AsyncGenerator<string, void, unknown> {
    if (this.state.status !== 'ready' || !this.engine) return;

    const model = this.state.model;
    const fullMessages = messages[0]?.role === 'system'
      ? messages
      : [
          { role: 'system' as const, content: await this.getSystemPrompt(messages[messages.length - 1]?.content) },
          ...messages,
        ];

    try {
      const stream = await this.engine.chat.completions.create({
        messages: fullMessages,
        max_tokens: options?.maxTokens ?? 512,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          this.state.tokensGenerated++;
          yield content;
        }
      }

      this.state.generationCount++;
    } catch {
      // Stream interrupted — that's fine, partial output is valid
    }
  }

  // ── Model Switching ──────────────────────────────────────────────

  /**
   * Switch to a different model tier. Unloads current model first.
   * Use this when the user explicitly wants better/worse quality.
   */
  async switchTier(tier: ModelTier): Promise<boolean> {
    const model = selectBestModel(this.state.vramAvailableMB, tier);
    if (!model) return false;

    // Unload current model
    if (this.engine) {
      try {
        await this.engine.unload?.();
      } catch { /* ignore */ }
      this.engine = null;
    }

    this.state.model = model;
    this.state.selectedTier = tier;
    this.setState({ status: 'unavailable', loadProgress: 0 });

    // Reload
    return this.loadModel();
  }

  // ── State Management ─────────────────────────────────────────────

  getState(): OfflineBrainState {
    return { ...this.state };
  }

  isReady(): boolean {
    return this.state.status === 'ready';
  }

  getModel(): OfflineModelConfig | null {
    return this.state.model;
  }

  /** Get the hallucination penalty for the current model */
  getHallucinationPenalty(): number {
    return this.state.model?.hallucinationPenalty ?? 0.5;
  }

  /** Get the confidence reduction for the current model */
  getConfidenceReduction(): number {
    return this.state.model?.confidenceReduction ?? 0.4;
  }

  onStateChange(listener: (state: OfflineBrainState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private setState(partial: Partial<OfflineBrainState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of Array.from(this.listeners)) {
      try { listener(this.state); } catch { /* swallow */ }
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  async unload(): Promise<void> {
    if (this.engine) {
      try { await this.engine.unload?.(); } catch { /* ignore */ }
      this.engine = null;
    }
    this.setState({ status: 'unavailable', loadProgress: 0 });
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalOfflineBrain: CortexOfflineBrain | null = null;

export function getCortexOfflineBrain(): CortexOfflineBrain {
  if (!globalOfflineBrain) {
    globalOfflineBrain = new CortexOfflineBrain();
  }
  return globalOfflineBrain;
}

export function resetCortexOfflineBrain(): void {
  if (globalOfflineBrain) {
    globalOfflineBrain.unload();
  }
  globalOfflineBrain = null;
}
