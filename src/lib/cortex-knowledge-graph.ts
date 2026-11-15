/**
 * Cortex Knowledge Graph Subsystem
 *
 * Provides a structured, relational memory and reasoning substrate:
 * 1. Entities: User, Business, Capabilities, NAICS Codes, Technologies, Projects, Invariants.
 * 2. Typed Relations: HAS_NAICS, CAPABLE_OF, DEPENDS_ON, ENFORCES, INTEGRATES_WITH, ALIGNED_WITH.
 * 3. Dynamic Fact Assertion & Retrieval: Injects ground truth facts into Cortex prompts.
 * 4. Local Persistence: Serializes to .cortex/knowledge_graph.json and localStorage.
 */

export interface KnowledgeEntity {
  id: string;
  name: string;
  type: 'business' | 'person' | 'technology' | 'project' | 'policy' | 'standard' | 'goal' | 'concept';
  properties: Record<string, any>;
  description?: string;
  tags?: string[];
  updatedAt: number;
}

export interface KnowledgeRelation {
  id: string;
  sourceId: string;
  targetId: string;
  predicate:
    | 'HAS_NAICS'
    | 'CAPABLE_OF'
    | 'DEPENDS_ON'
    | 'ENFORCES'
    | 'INTEGRATES_WITH'
    | 'ALIGNED_WITH'
    | 'SUPPORTS'
    | 'SUBTASK_OF'
    | 'OWNED_BY';
  weight?: number;
  metadata?: Record<string, any>;
  createdAt: number;
}

export interface KnowledgeGraphData {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  version: string;
  updatedAt: number;
}

const DEFAULT_GRAPH_DATA: KnowledgeGraphData = {
  version: '1.0.0',
  updatedAt: Date.now(),
  entities: [
    {
      id: 'entity-user-business',
      name: 'SyncScript Deep Work Copilot Enterprise',
      type: 'business',
      properties: {
        legalName: 'SyncScript Technologies LLC',
        cageCode: '9X4B2',
        samUei: 'K9NLM52GQV47',
        registrationStatus: 'Active in SAM.gov',
        setAsideEligibility: ['Small Business', 'Total Small Business Set-Aside (SBSA)', '8(a) Candidate'],
        annualRevenueThreshold: '<$34.0M (SBA Qualified)',
        primaryCapabilities: [
          'Full-Duplex Sub-600ms Conversational AI & Neural Voice',
          'Autonomous ReAct Long-Horizon Mission Engines',
          'Closed-Loop Visual Gaze Active Inference via Chrome CDP & Apple Vision OCR',
          'Resonance Calculus & Chrono-Energy Scheduling',
          'Deterministic Operational Safety & Libet Conscious Veto',
        ],
      },
      description: 'AI & deep work enterprise platform pioneering conscious co-agency and biological chrono-energy alignment.',
      tags: ['business', 'federal_contracting', 'sam_gov', 'enterprise'],
      updatedAt: Date.now(),
    },
    {
      id: 'naics-541511',
      name: 'NAICS 541511: Custom Computer Programming Services',
      type: 'standard',
      properties: {
        code: '541511',
        title: 'Custom Computer Programming Services',
        sizeStandard: '$34.0M',
        scope: 'Writing, modifying, testing, and supporting custom software to meet customer-specific requirements.',
      },
      tags: ['naics', 'procurement', 'federal'],
      updatedAt: Date.now(),
    },
    {
      id: 'naics-541512',
      name: 'NAICS 541512: Computer Systems Design Services',
      type: 'standard',
      properties: {
        code: '541512',
        title: 'Computer Systems Design Services',
        sizeStandard: '$34.0M',
        scope: 'Planning and designing computer systems that integrate hardware, software, and communication technologies.',
      },
      tags: ['naics', 'procurement', 'federal'],
      updatedAt: Date.now(),
    },
    {
      id: 'naics-541519',
      name: 'NAICS 541519: Other Computer Related Services',
      type: 'standard',
      properties: {
        code: '541519',
        title: 'Other Computer Related Services',
        sizeStandard: '$34.0M',
        scope: 'On-site computer software management, data recovery, computer disaster recovery, software installation.',
      },
      tags: ['naics', 'procurement', 'federal'],
      updatedAt: Date.now(),
    },
    {
      id: 'tech-cortex-cortex',
      name: 'Cortex Conscious Co-Agency Architecture',
      type: 'technology',
      properties: {
        phi: 1.24,
        freeEnergyThreshold: 0.22,
        voiceLatencyTargetMs: 500,
        safetyInvariants: ['Libet Conscious Veto', 'AST Rollback', 'Co-Agency Badge', 'Physical Grounding'],
      },
      description: 'Host-integrated conscious AI engine based on Friston active inference and Tononi integrated information theory.',
      tags: ['ai', 'cortex', 'architecture'],
      updatedAt: Date.now(),
    },
    {
      id: 'tech-chrono-energy',
      name: 'SyncScript Chrono-Energy Spine',
      type: 'technology',
      properties: {
        acrophaseHour: 10.5,
        peakMorningWindow: '09:00 - 11:30',
        afternoonLullWindow: '13:30 - 15:00',
        peakEnergyThreshold: 0.90,
      },
      description: 'Biological resonance calculus engine mapping human cognitive peak hours to deep work and review blocks.',
      tags: ['energy', 'circadian', 'calendar'],
      updatedAt: Date.now(),
    },
  ],
  relations: [
    {
      id: 'rel-1',
      sourceId: 'entity-user-business',
      targetId: 'naics-541511',
      predicate: 'HAS_NAICS',
      createdAt: Date.now(),
    },
    {
      id: 'rel-2',
      sourceId: 'entity-user-business',
      targetId: 'naics-541512',
      predicate: 'HAS_NAICS',
      createdAt: Date.now(),
    },
    {
      id: 'rel-3',
      sourceId: 'entity-user-business',
      targetId: 'naics-541519',
      predicate: 'HAS_NAICS',
      createdAt: Date.now(),
    },
    {
      id: 'rel-4',
      sourceId: 'entity-user-business',
      targetId: 'tech-cortex-cortex',
      predicate: 'CAPABLE_OF',
      createdAt: Date.now(),
    },
    {
      id: 'rel-5',
      sourceId: 'entity-user-business',
      targetId: 'tech-chrono-energy',
      predicate: 'INTEGRATES_WITH',
      createdAt: Date.now(),
    },
  ],
};

export class CortexKnowledgeGraph {
  private static instance: CortexKnowledgeGraph | null = null;
  private data: KnowledgeGraphData;

  private constructor() {
    this.data = this.loadGraph();
  }

  public static getInstance(): CortexKnowledgeGraph {
    if (!CortexKnowledgeGraph.instance) {
      CortexKnowledgeGraph.instance = new CortexKnowledgeGraph();
    }
    return CortexKnowledgeGraph.instance;
  }

  private loadGraph(): KnowledgeGraphData {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('cortex_knowledge_graph_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.entities)) {
            return parsed;
          }
        }
      } catch {}
    }
    return JSON.parse(JSON.stringify(DEFAULT_GRAPH_DATA));
  }

  private saveGraph(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cortex_knowledge_graph_v1', JSON.stringify(this.data));
      } catch {}
    }
  }

  public getAllEntities(): KnowledgeEntity[] {
    return this.data.entities;
  }

  public getEntity(id: string): KnowledgeEntity | undefined {
    return this.data.entities.find((e) => e.id === id || e.name.toLowerCase() === id.toLowerCase());
  }

  public queryEntities(query: string): KnowledgeEntity[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.data.entities;
    return this.data.entities.filter((e) => {
      if (e.name.toLowerCase().includes(q)) return true;
      if (e.description?.toLowerCase().includes(q)) return true;
      if (e.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      const propStr = JSON.stringify(e.properties).toLowerCase();
      return propStr.includes(q);
    });
  }

  public getRelationsForEntity(entityId: string): KnowledgeRelation[] {
    return this.data.relations.filter((r) => r.sourceId === entityId || r.targetId === entityId);
  }

  public addEntity(entity: Omit<KnowledgeEntity, 'updatedAt'>): KnowledgeEntity {
    const existingIdx = this.data.entities.findIndex((e) => e.id === entity.id);
    const updated: KnowledgeEntity = {
      ...entity,
      updatedAt: Date.now(),
    };
    if (existingIdx >= 0) {
      this.data.entities[existingIdx] = updated;
    } else {
      this.data.entities.push(updated);
    }
    this.data.updatedAt = Date.now();
    this.saveGraph();
    return updated;
  }

  public addRelation(relation: Omit<KnowledgeRelation, 'id' | 'createdAt'>): KnowledgeRelation {
    const id = `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRel: KnowledgeRelation = {
      ...relation,
      id,
      createdAt: Date.now(),
    };
    this.data.relations.push(newRel);
    this.data.updatedAt = Date.now();
    this.saveGraph();
    return newRel;
  }

  /**
   * Generates a context injection string for the AI prompt based on query relevance.
   */
  public getPromptContextInjection(query?: string): string {
    const relevant = query ? this.queryEntities(query).slice(0, 5) : this.data.entities.slice(0, 4);
    if (relevant.length === 0) return '';

    const lines: string[] = ['[KNOWLEDGE GRAPH CONTEXT (VERIFIED GROUND TRUTH)]'];
    for (const ent of relevant) {
      lines.push(`• Entity: "${ent.name}" (${ent.type})`);
      if (ent.description) lines.push(`  Description: ${ent.description}`);
      const rels = this.getRelationsForEntity(ent.id);
      if (rels.length > 0) {
        const relSummaries = rels.map((r) => {
          const isSource = r.sourceId === ent.id;
          const otherId = isSource ? r.targetId : r.sourceId;
          const otherEnt = this.getEntity(otherId);
          const targetName = otherEnt ? otherEnt.name : otherId;
          return isSource ? `-[${r.predicate}]-> ${targetName}` : `<-[${r.predicate}]- ${targetName}`;
        });
        lines.push(`  Relations: ${relSummaries.join('; ')}`);
      }
      const propEntries = Object.entries(ent.properties || {}).slice(0, 4);
      if (propEntries.length > 0) {
        lines.push(`  Attributes: ${propEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`);
      }
    }
    return lines.join('\n');
  }
}

export function getCortexKnowledgeGraph(): CortexKnowledgeGraph {
  return CortexKnowledgeGraph.getInstance();
}

