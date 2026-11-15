import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Brain, Search, X, Maximize2, Minimize2, Activity, Database, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Mock Data Generator (Fractal Topology) ---
const generateMockData = () => {
  const nodes: any[] = [];
  const links: any[] = [];
  const GROUPS = ['Memory', 'Task', 'Concept', 'File', 'Project'];
  const COLORS: Record<string, string> = {
    Memory: '#8b5cf6', // purple
    Task: '#10b981', // emerald
    Concept: '#f59e0b', // amber
    File: '#3b82f6', // blue
    Project: '#ec4899', // pink
  };

  const VOCAB: Record<string, { prefixes: string[], suffixes: string[] }> = {
    Memory: { prefixes: ['Archived', 'Deep', 'Recent', 'Core', 'Fragmented', 'Recovered', 'Verified'], suffixes: ['Session Log', 'Deploy State', 'Context', 'Graph', 'Trace', 'History', 'Snapshot'] },
    Task: { prefixes: ['Refactor', 'Deploy', 'Audit', 'Verify', 'Debug', 'Compile', 'Measure'], suffixes: ['Gate', 'Router', 'WebGL', 'API', 'Agent', 'Proxy', 'Sub-graph'] },
    Concept: { prefixes: ['Epistemic', 'Fractal', 'Resonant', 'Energy', 'Harmonic', 'Semantic', 'Cognitive'], suffixes: ['Homeostasis', 'Scale', 'Engine', 'Calculus', 'Flow', 'Topology', 'Friction'] },
    File: { prefixes: ['MEMORY', 'services', 'SecondBrainPage', 'epistemic-graph', 'global-workspace', 'SESSION', 'index'], suffixes: ['.md', '.py', '.tsx', '.ts', '.css', '.json', '.yml'] },
    Project: { prefixes: ['Antigravity', 'SyncScript', 'Cortex', 'Neural', 'Composio', 'OASIS', 'Nexus'], suffixes: ['IDE', 'Core', 'Research', 'Brain UI', 'MCP', 'Program', 'Integration'] }
  };

  const generateName = (group: string) => {
    const v = VOCAB[group];
    const prefix = v.prefixes[Math.floor(Math.random() * v.prefixes.length)];
    const suffix = v.suffixes[Math.floor(Math.random() * v.suffixes.length)];
    return group === 'File' ? `${prefix}${suffix}` : `${prefix} ${suffix}`;
  };

  let nodeIdCounter = 0;

  // L0: Singularity (Central Hub)
  const hubId = 'hub';
  nodes.push({ id: hubId, name: 'SyncScript Agent Core', group: 'Project', val: 25, color: '#06b6d4' });

  // L1: Domain Hubs
  GROUPS.forEach(group => {
    const domainHubId = `node_${nodeIdCounter++}`;
    nodes.push({ id: domainHubId, name: `${group} Domain Hub`, group, val: 15, color: COLORS[group] });
    links.push({ source: domainHubId, target: hubId, value: 5 });

    // L2: Semantic Clusters
    const clusterCount = Math.floor(Math.random() * 3) + 4; // 4 to 6 clusters per domain
    for (let i = 0; i < clusterCount; i++) {
      const clusterId = `node_${nodeIdCounter++}`;
      nodes.push({ id: clusterId, name: generateName(group), group, val: 8, color: COLORS[group] });
      links.push({ source: clusterId, target: domainHubId, value: 2 });

      // L3: Leaf Nodes
      const leafCount = Math.floor(Math.random() * 5) + 3; // 3 to 7 leaves per cluster
      for (let j = 0; j < leafCount; j++) {
        const leafId = `node_${nodeIdCounter++}`;
        nodes.push({ id: leafId, name: generateName(group), group, val: Math.random() * 2 + 2, color: COLORS[group] });
        links.push({ source: leafId, target: clusterId, value: 1 });
      }
    }
  });

  return { nodes, links };
};

export function SecondBrainPage() {
  const fgRef = useRef<ForceGraphMethods>(null);
  const [data, setData] = useState({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [activeNode, setActiveNode] = useState<any>(null);
  const [subgraphNode, setSubgraphNode] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sub-graph Filtering Engine
  const displayData = useMemo(() => {
    if (!subgraphNode) return data;
    const connectedNodeIds = new Set();
    connectedNodeIds.add(subgraphNode.id);
    
    const subLinks = data.links.filter((l: any) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      if (sourceId === subgraphNode.id || targetId === subgraphNode.id) {
        connectedNodeIds.add(sourceId);
        connectedNodeIds.add(targetId);
        return true;
      }
      return false;
    });
    
    const subNodes = data.nodes.filter((n: any) => connectedNodeIds.has(n.id));
    return { nodes: subNodes, links: subLinks };
  }, [data, subgraphNode]);

  // Focus sets logic (using displayData to respect subgraph boundaries)
  const highlightNodes = useMemo(() => new Set(), [hoverNode]);
  const highlightLinks = useMemo(() => new Set(), [hoverNode]);

  // Compute focus nodes
  useEffect(() => {
    highlightNodes.clear();
    highlightLinks.clear();
    if (hoverNode) {
      highlightNodes.add(hoverNode.id);
      displayData.links.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sourceId === hoverNode.id || targetId === hoverNode.id) {
          highlightLinks.add(link);
          highlightNodes.add(sourceId);
          highlightNodes.add(targetId);
        }
      });
    }
  }, [hoverNode, displayData.links, highlightNodes, highlightLinks]);

  // Initialize data
  useEffect(() => {
    setData(generateMockData() as any);
  }, []);

  // Post-Processing Bloom Pass
  useEffect(() => {
    if (fgRef.current && dimensions.width > 0) {
      // Access composer and inject Bloom Pass
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(dimensions.width, dimensions.height),
        1.2, // strength
        0.6, // radius
        0.6  // threshold
      );
      // Clean up previous passes if re-running
      const composer = (fgRef.current as any).postProcessingComposer();
      composer.passes = composer.passes.filter((p: any) => !(p instanceof UnrealBloomPass));
      composer.addPass(bloomPass);
    }
  }, [dimensions, data]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  // Click Handler
  const handleNodeClick = useCallback((node: any) => {
    if (fgRef.current) {
      const distance = 100;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        1500
      );
    }
    setActiveNode(node);
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoverNode(node);
  }, []);

  // Dynamic link styling (dimming non-highlighted links)
  const getLinkColor = useCallback((link: any) => {
    if (highlightNodes.size === 0) return 'rgba(255,255,255,0.15)';
    return highlightLinks.has(link) ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.02)';
  }, [highlightNodes, highlightLinks]);

  // Custom Node Object (Glowing Spheres + Text Sprites)
  const renderNode = useCallback((node: any) => {
    const isHovered = hoverNode && hoverNode.id === node.id;
    const isFocused = highlightNodes.has(node.id);
    const isDimmed = highlightNodes.size > 0 && !isFocused;

    const group = new THREE.Group();

    // Scale Bloom intensity inversely with volume to prevent blowout
    let baseIntensity = 0.8;
    if (node.val > 20) baseIntensity = 0.1;
    else if (node.val > 10) baseIntensity = 0.3;

    // Sphere
    const geometry = new THREE.SphereGeometry(node.val);
    const material = new THREE.MeshLambertMaterial({ 
      color: node.color,
      transparent: true,
      opacity: isDimmed ? 0.1 : 0.9,
      emissive: node.color,
      emissiveIntensity: isHovered ? (baseIntensity * 2.5) : (isDimmed ? 0.1 : baseIntensity)
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Text Sprite helper to avoid depth sorting issues inside Bloom
    const addCrispText = (text: string, height: number, yOffset: number, color: string) => {
      const sprite = new SpriteText(text);
      sprite.color = color;
      sprite.textHeight = height;
      sprite.position.set(0, node.val + yOffset, 0);
      sprite.material.depthTest = false;
      sprite.material.depthWrite = false;
      sprite.renderOrder = 999;
      group.add(sprite);
    };

    // Render Text
    if (isFocused || node.id === 'hub') {
      addCrispText(node.name, node.val * 0.8, 2, '#9ca3af');
    } else if (!isDimmed && node.val > 4) {
      addCrispText(node.name, node.val * 0.5, 1, 'rgba(255,255,255,0.5)');
    }

    return group;
  }, [hoverNode, highlightNodes]);

  return (
    <div className={`relative bg-[#0b0f19] overflow-hidden flex flex-col min-h-[500px] rounded-2xl border border-white/5 shadow-2xl ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'flex-1 h-full w-full'}`} ref={containerRef}>
      
      {/* 3D Canvas */}
      <div className="absolute inset-0 cursor-crosshair">
        {displayData.nodes.length > 0 && dimensions.width > 0 && (
          <ForceGraph3D
            ref={fgRef as any}
            width={dimensions.width}
            height={dimensions.height}
            graphData={displayData}
            nodeLabel={() => ''}
            nodeThreeObject={renderNode}
            linkWidth={(link: any) => highlightLinks.has(link) ? 2 : 1}
            linkColor={getLinkColor}
            linkCurvature={0.25}
            linkDirectionalParticles={(link: any) => highlightLinks.has(link) ? 4 : 2}
            linkDirectionalParticleWidth={(link: any) => highlightLinks.has(link) ? 2 : 1}
            linkDirectionalParticleSpeed={0.005}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            backgroundColor="#0b0f19"
            enableNodeDrag={false}
          />
        )}
      </div>

      {/* Top Bar UI */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start pointer-events-none z-10">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4 pointer-events-auto">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
            <Brain className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">Neural Brain</h1>
            <p className="text-teal-400/80 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              {subgraphNode ? `Sub-graph: ${subgraphNode.name}` : 'Knowledge Graph Active'}
            </p>
          </div>
          {subgraphNode && (
            <button 
              onClick={() => { setSubgraphNode(null); setActiveNode(null); }}
              className="ml-4 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all border border-white/10 shadow-lg"
            >
              Back to Full Brain
            </button>
          )}
        </div>

        <div className="flex gap-3 pointer-events-auto">
          <button className="bg-black/40 backdrop-blur-md border border-white/10 hover:border-white/30 text-white/70 hover:text-white p-3 rounded-xl transition-all">
            <Search className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-black/40 backdrop-blur-md border border-white/10 hover:border-white/30 text-white/70 hover:text-white p-3 rounded-xl transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Stats Overlay (Bottom Left) */}
      <div className="absolute bottom-6 left-6 pointer-events-none z-10 hidden md:block">
        <div className="flex gap-4">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-3 px-4 flex flex-col gap-1 pointer-events-auto">
            <span className="text-white/50 text-[10px] uppercase font-bold tracking-wider">Total Nodes</span>
            <span className="text-white font-mono text-lg">{displayData.nodes.length}</span>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-3 px-4 flex flex-col gap-1 pointer-events-auto">
            <span className="text-white/50 text-[10px] uppercase font-bold tracking-wider">Synapses</span>
            <span className="text-white font-mono text-lg">{displayData.links.length}</span>
          </div>
        </div>
      </div>

      {/* Node Inspector Sidebar */}
      <AnimatePresence>
        {activeNode && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute top-24 right-6 bottom-6 w-80 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 pointer-events-auto z-20 flex flex-col shadow-2xl"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center border"
                  style={{ backgroundColor: `${activeNode.color}20`, borderColor: `${activeNode.color}50` }}
                >
                  <Network className="w-4 h-4" style={{ color: activeNode.color }} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: activeNode.color }}>
                    {activeNode.group}
                  </div>
                  <h3 className="text-white font-medium truncate max-w-[200px]" title={activeNode.name}>{activeNode.name}</h3>
                </div>
              </div>
              <button 
                onClick={() => setActiveNode(null)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto ambient-scrollbar space-y-6">
              <div>
                <h4 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Database className="w-3 h-3" /> Node Metadata
                </h4>
                <div className="bg-white/5 rounded-xl p-3 space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-white/40">ID</span>
                    <span className="text-white/80">{activeNode.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Weight</span>
                    <span className="text-white/80">{activeNode.val.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Connections</span>
                    <span className="text-white/80">
                      {displayData.links.filter((l: any) => 
                        l.source === activeNode || l.target === activeNode || 
                        (l.source && l.source.id === activeNode.id) || 
                        (l.target && l.target.id === activeNode.id)
                      ).length}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-3 h-3" /> Recent Activity
                </h4>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 items-start border-l border-white/10 pl-3 relative">
                      <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-black border-2" style={{ borderColor: activeNode.color }}></div>
                      <div>
                        <p className="text-white/80 text-sm">Accessed by Agent</p>
                        <p className="text-white/40 text-xs">{(i * 12)} mins ago</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {(!subgraphNode || subgraphNode.id !== activeNode.id) && (
              <button 
                onClick={() => {
                  setSubgraphNode(activeNode);
                  setActiveNode(null);
                }}
                className="w-full mt-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium transition-all shadow-lg"
              >
                Explore Sub-graph
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

