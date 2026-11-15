/**
 * SyncScript Elite WebGL Effects System
 * Awwwards-level interactive backgrounds, particle fields, and shaders
 * Zero-dependency, tree-shakable, performance-optimized
 */

// ============================================
// WEBGL UTILITIES & SHADER COMPILATION
// ============================================

export interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  attributes: Map<string, number>;
}

export function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error('Shader compilation failed');
  }
  return shader;
}

export function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): ShaderProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    throw new Error('Program linking failed');
  }
  
  // Cache uniform locations
  const uniforms = new Map<string, WebGLUniformLocation>();
  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < numUniforms; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms.set(info.name, gl.getUniformLocation(program, info.name)!);
  }
  
  // Cache attribute locations
  const attributes = new Map<string, number>();
  const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < numAttribs; i++) {
    const info = gl.getActiveAttrib(program, i);
    if (info) attributes.set(info.name, gl.getAttribLocation(program, info.name));
  }
  
  return { program, uniforms, attributes };
}

export function resizeCanvas(canvas: HTMLCanvasContext): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
}

// ============================================
// PARTICLE FIELD SYSTEM
// ============================================

const PARTICLE_VS = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute vec3 a_color;
  attribute float a_opacity;
  attribute float a_speed;
  attribute float a_angle;
  
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_mouseInfluence;
  uniform vec2 u_mousePos;
  uniform float u_scrollProgress;
  
  varying vec3 v_color;
  varying float v_opacity;
  varying float v_size;
  
  void main() {
    vec2 pos = a_position;
    
    // Subtle drift based on time and particle properties
    float driftX = sin(u_time * a_speed + a_angle) * 0.02;
    float driftY = cos(u_time * a_speed * 0.7 + a_angle) * 0.015;
    pos.x += driftX;
    pos.y += driftY;
    
    // Mouse influence - gentle attraction/repulsion
    vec2 toMouse = u_mousePos - pos;
    float distToMouse = length(toMouse);
    if (distToMouse < 0.15) {
      float influence = (1.0 - distToMouse / 0.15) * u_mouseInfluence;
      pos += toMouse * influence * 0.3;
    }
    
    // Scroll influence - particles respond to scroll
    pos.y += u_scrollProgress * 0.1 * a_speed;
    
    // Wrap around edges
    pos = mod(pos + 1.0, 2.0) - 1.0;
    
    // Convert to clip space
    vec2 clipPos = pos;
    
    v_color = a_color;
    v_opacity = a_opacity * (0.5 + 0.5 * sin(u_time * 2.0 + a_angle));
    v_size = a_size * (1.0 + 0.3 * sin(u_time * 3.0 + a_angle));
    
    gl_Position = vec4(clipPos, 0.0, 1.0);
    gl_PointSize = v_size * u_resolution.y * 0.01;
  }
`;

const PARTICLE_FS = `
  precision highp float;
  
  varying vec3 v_color;
  varying float v_opacity;
  varying float v_size;
  
  void main() {
    // Circular particle with soft edges
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    float alpha = smoothstep(0.5, 0.0, dist) * v_opacity;
    
    // Subtle glow at center
    float glow = smoothstep(0.3, 0.0, dist) * 0.3;
    
    gl_FragColor = vec4(v_color, alpha + glow);
  }
`;

export interface ParticleFieldConfig {
  count?: number;
  colors?: string[];
  sizeRange?: [number, number];
  speedRange?: [number, number];
  opacityRange?: [number, number];
  mouseInfluence?: number;
  connectDistance?: number;
  enableConnections?: boolean;
}

export class ParticleField {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: ShaderProgram;
  private buffers: Map<string, WebGLBuffer> = new Map();
  private config: Required<ParticleFieldConfig>;
  private particleData: Float32Array;
  private animationId: number = 0;
  private startTime: number = 0;
  private mousePos: [number, number] = [0, 0];
  private scrollProgress: number = 0;
  private dpr: number = 1;
  private destroyCallbacks: (() => void)[] = [];
  
  constructor(canvas: HTMLCanvasElement, config: ParticleFieldConfig = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { 
      alpha: true, 
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    this.dpr = window.devicePixelRatio || 1;
    
    this.config = {
      count: config.count ?? 120,
      colors: config.colors ?? ['#0050FF', '#00D6FF', '#10B981', '#A855F7'],
      sizeRange: config.sizeRange ?? [0.5, 2.5],
      speedRange: config.speedRange ?? [0.2, 1.0],
      opacityRange: config.opacityRange ?? [0.15, 0.45],
      mouseInfluence: config.mouseInfluence ?? 0.3,
      connectDistance: config.connectDistance ?? 0.15,
      enableConnections: config.enableConnections ?? false,
    };
    
    this.program = createProgram(gl, PARTICLE_VS, PARTICLE_FS);
    this.initBuffers();
    this.generateParticles();
    this.bindEvents();
    this.startTime = performance.now();
    this.render();
  }
  
  private initBuffers(): void {
    const gl = this.gl;
    const { count } = this.config;
    
    // Position buffer
    const posBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    this.buffers.set('position', posBuffer);
    
    // Size buffer
    const sizeBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    this.buffers.set('size', sizeBuffer);
    
    // Color buffer
    const colorBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    this.buffers.set('color', colorBuffer);
    
    // Opacity buffer
    const opacityBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, opacityBuffer);
    this.buffers.set('opacity', opacityBuffer);
    
    // Speed buffer
    const speedBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, speedBuffer);
    this.buffers.set('speed', speedBuffer);
    
    // Angle buffer
    const angleBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, angleBuffer);
    this.buffers.set('angle', angleBuffer);
    
    // Allocate particle data
    this.particleData = new Float32Array(count * 2); // positions
  }
  
  private generateParticles(): void {
    const { count, colors, sizeRange, speedRange, opacityRange } = this.config;
    const gl = this.gl;
    
    const positions = new Float32Array(count * 2);
    const sizes = new Float32Array(count);
    const colorData = new Float32Array(count * 3);
    const opacities = new Float32Array(count);
    const speeds = new Float32Array(count);
    const angles = new Float32Array(count);
    
    const colorPalette = colors.map(hex => this.hexToRgb(hex));
    
    for (let i = 0; i < count; i++) {
      // Random position in normalized device coordinates (-1 to 1)
      positions[i * 2] = (Math.random() - 0.5) * 2;
      positions[i * 2 + 1] = (Math.random() - 0.5) * 2;
      
      // Random size
      sizes[i] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
      
      // Random color from palette
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colorData[i * 3] = color[0];
      colorData[i * 3 + 1] = color[1];
      colorData[i * 3 + 2] = color[2];
      
      // Random opacity
      opacities[i] = opacityRange[0] + Math.random() * (opacityRange[1] - opacityRange[0]);
      
      // Random speed
      speeds[i] = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      
      // Random angle
      angles[i] = Math.random() * Math.PI * 2;
    }
    
    // Upload to GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('position')!);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('size')!);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('color')!);
    gl.bufferData(gl.ARRAY_BUFFER, colorData, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('opacity')!);
    gl.bufferData(gl.ARRAY_BUFFER, opacities, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('speed')!);
    gl.bufferData(gl.ARRAY_BUFFER, speeds, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('angle')!);
    gl.bufferData(gl.ARRAY_BUFFER, angles, gl.STATIC_DRAW);
  }
  
  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
      : [0, 0.31, 1];
  }
  
  private bindEvents(): void {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos[0] = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mousePos[1] = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    
    const handleResize = () => {
      this.resize();
    };
    
    this.canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    this.destroyCallbacks.push(
      () => this.canvas.removeEventListener('mousemove', handleMouseMove),
      () => window.removeEventListener('resize', handleResize)
    );
  }
  
  public setScrollProgress(progress: number): void {
    this.scrollProgress = Math.max(0, Math.min(1, progress));
  }
  
  public setMouseInfluence(influence: number): void {
    this.config.mouseInfluence = influence;
  }
  
  private resize(): void {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      // Re-generate particles for new DPR if needed
    }
    
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  
  private render = (): void => {
    const gl = this.gl;
    const now = performance.now();
    const time = (now - this.startTime) * 0.001;
    
    // Clear
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Use program
    gl.useProgram(this.program.program);
    
    // Set uniforms
    gl.uniform1f(this.program.uniforms.get('u_time'), time);
    gl.uniform2f(this.program.uniforms.get('u_resolution'), this.canvas.width, this.canvas.height);
    gl.uniform1f(this.program.uniforms.get('u_mouseInfluence'), this.config.mouseInfluence);
    gl.uniform2f(this.program.uniforms.get('u_mousePos'), this.mousePos[0], this.mousePos[1]);
    gl.uniform1f(this.program.uniforms.get('u_scrollProgress'), this.scrollProgress);
    
    // Bind attributes
    const attrs = this.program.attributes;
    const stride = 0;
    
    // Position
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('position')!);
    gl.enableVertexAttribArray(attrs.get('a_position')!);
    gl.vertexAttribPointer(attrs.get('a_position')!, 2, gl.FLOAT, false, stride, 0);
    
    // Size
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('size')!);
    gl.enableVertexAttribArray(attrs.get('a_size')!);
    gl.vertexAttribPointer(attrs.get('a_size')!, 1, gl.FLOAT, false, stride, 0);
    
    // Color
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('color')!);
    gl.enableVertexAttribArray(attrs.get('a_color')!);
    gl.vertexAttribPointer(attrs.get('a_color')!, 3, gl.FLOAT, false, stride, 0);
    
    // Opacity
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('opacity')!);
    gl.enableVertexAttribArray(attrs.get('a_opacity')!);
    gl.vertexAttribPointer(attrs.get('a_opacity')!, 1, gl.FLOAT, false, stride, 0);
    
    // Speed
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('speed')!);
    gl.enableVertexAttribArray(attrs.get('a_speed')!);
    gl.vertexAttribPointer(attrs.get('a_speed')!, 1, gl.FLOAT, false, stride, 0);
    
    // Angle
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('angle')!);
    gl.enableVertexAttribArray(attrs.get('a_angle')!);
    gl.vertexAttribPointer(attrs.get('a_angle')!, 1, gl.FLOAT, false, stride, 0);
    
    // Draw
    gl.drawArrays(gl.POINTS, 0, this.config.count);
    
    this.animationId = requestAnimationFrame(this.render);
  };
  
  public destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.destroyCallbacks.forEach(cb => cb());
    this.destroyCallbacks = [];
    
    this.buffers.forEach(buffer => this.gl.deleteBuffer(buffer));
    this.gl.deleteProgram(this.program.program);
  }
}

// ============================================
// NOISE/SHADER BACKGROUND
// ============================================

const NOISE_VS = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const NOISE_FS = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mousePos;
  uniform float u_intensity;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  
  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.y = a0.y * x12.x + h.y * x12.y;
    g.z = a0.z * x12.z + h.z * x12.w;
    return 130.0 * dot(m, g);
  }
  
  // Fractal Brownian Motion
  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  void main() {
    vec2 uv = v_uv;
    vec2 center = vec2(0.5);
    float dist = length(uv - center);
    
    // Animated noise
    float noise = fbm(uv * 3.0 + u_time * 0.05, 4);
    float noise2 = fbm(uv * 6.0 - u_time * 0.03, 3);
    
    // Mouse influence
    vec2 mouseUv = u_mousePos * 0.5 + 0.5;
    float mouseDist = length(uv - mouseUv);
    float mouseInfluence = smoothstep(0.4, 0.0, mouseDist) * 0.3;
    
    // Combine noises
    float combined = noise * 0.6 + noise2 * 0.4 + mouseInfluence;
    
    // Radial falloff
    float vignette = smoothstep(0.8, 0.2, dist);
    combined *= vignette;
    
    // Color mixing
    vec3 color = mix(u_color1, u_color2, combined * 0.5 + 0.5);
    color = mix(color, u_color3, noise2 * 0.3);
    
    // Apply intensity
    color *= u_intensity * (0.3 + combined * 0.7);
    
    // Subtle scanlines
    float scanlines = sin(uv.y * u_resolution.y * 0.5 + u_time * 10.0) * 0.02;
    color += scanlines;
    
    gl_FragColor = vec4(color, combined * 0.15);
  }
`;

export interface NoiseBackgroundConfig {
  intensity?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  speed?: number;
}

export class NoiseBackground {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: ShaderProgram;
  private buffers: Map<string, WebGLBuffer> = new Map();
  private config: Required<NoiseBackgroundConfig>;
  private animationId: number = 0;
  private startTime: number = 0;
  private mousePos: [number, number] = [0, 0];
  private destroyCallbacks: (() => void)[] = [];
  
  constructor(canvas: HTMLCanvasElement, config: NoiseBackgroundConfig = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { 
      alpha: true, 
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    
    this.config = {
      intensity: config.intensity ?? 0.6,
      color1: config.color1 ?? '#0050FF',
      color2: config.color2 ?? '#00D6FF',
      color3: config.color3 ?? '#10B981',
      speed: config.speed ?? 1.0,
    };
    
    this.program = createProgram(gl, NOISE_VS, NOISE_FS);
    this.initBuffers();
    this.bindEvents();
    this.startTime = performance.now();
    this.render();
  }
  
  private initBuffers(): void {
    const gl = this.gl;
    
    // Full-screen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    
    const posBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    this.buffers.set('position', posBuffer);
  }
  
  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
      : [0, 0.31, 1];
  }
  
  private bindEvents(): void {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos[0] = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mousePos[1] = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    
    const handleResize = () => this.resize();
    
    this.canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    this.destroyCallbacks.push(
      () => this.canvas.removeEventListener('mousemove', handleMouseMove),
      () => window.removeEventListener('resize', handleResize)
    );
  }
  
  private resize(): void {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  
  private render = (): void => {
    const gl = this.gl;
    const now = performance.now();
    const time = (now - this.startTime) * 0.001 * this.config.speed;
    
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.useProgram(this.program.program);
    
    const c1 = this.hexToRgb(this.config.color1);
    const c2 = this.hexToRgb(this.config.color2);
    const c3 = this.hexToRgb(this.config.color3);
    
    gl.uniform1f(this.program.uniforms.get('u_time'), time);
    gl.uniform2f(this.program.uniforms.get('u_resolution'), this.canvas.width, this.canvas.height);
    gl.uniform2f(this.program.uniforms.get('u_mousePos'), this.mousePos[0], this.mousePos[1]);
    gl.uniform1f(this.program.uniforms.get('u_intensity'), this.config.intensity);
    gl.uniform3f(this.program.uniforms.get('u_color1'), c1[0], c1[1], c1[2]);
    gl.uniform3f(this.program.uniforms.get('u_color2'), c2[0], c2[1], c2[2]);
    gl.uniform3f(this.program.uniforms.get('u_color3'), c3[0], c3[1], c3[2]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('position')!);
    gl.enableVertexAttribArray(this.program.attributes.get('a_position')!);
    gl.vertexAttribPointer(this.program.attributes.get('a_position')!, 2, gl.FLOAT, false, 0, 0);
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    this.animationId = requestAnimationFrame(this.render);
  };
  
  public destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.destroyCallbacks.forEach(cb => cb());
    this.destroyCallbacks = [];
    this.buffers.forEach(buffer => this.gl.deleteBuffer(buffer));
    this.gl.deleteProgram(this.program.program);
  }
}

// ============================================
// REACT HOOKS FOR EASY INTEGRATION
// ============================================

import { useEffect, useRef, useCallback } from 'react';

export function useParticleField(config: ParticleFieldConfig = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<ParticleField | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    try {
      fieldRef.current = new ParticleField(canvasRef.current, config);
    } catch (e) {
      console.warn('ParticleField init failed:', e);
      return;
    }
    
    return () => {
      fieldRef.current?.destroy();
      fieldRef.current = null;
    };
  }, [config.count, config.colors?.join(','), config.mouseInfluence]);
  
  const setScrollProgress = useCallback((progress: number) => {
    fieldRef.current?.setScrollProgress(progress);
  }, []);
  
  return { canvasRef, setScrollProgress };
}

export function useNoiseBackground(config: NoiseBackgroundConfig = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<NoiseBackground | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    try {
      bgRef.current = new NoiseBackground(canvasRef.current, config);
    } catch (e) {
      console.warn('NoiseBackground init failed:', e);
      return;
    }
    
    return () => {
      bgRef.current?.destroy();
      bgRef.current = null;
    };
  }, [config.intensity, config.color1, config.color2, config.color3, config.speed]);
  
  return { canvasRef };
}

// ============================================
// REDUCED MOTION SUPPORT
// ============================================

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return prefersReduced;
}

// Need to import useState
import { useState } from 'react';