import { buildApproxUniforms, type ApproxRenderParams } from "./approxMath.js";

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec3 u_wb;
uniform float u_saturation;
uniform float u_shadow;
uniform float u_highlight;
uniform float u_dr;
uniform int u_film_sim;
uniform vec2 u_texel;
uniform float u_clarity;
uniform float u_noise_reduction;
uniform float u_sharpness;
uniform float u_chrome;
uniform float u_chrome_blue;
uniform float u_grain_amount;
uniform float u_grain_size;

in vec2 v_uv;
out vec4 out_color;

vec3 decodeLinear(vec2 uv) {
  vec3 encoded = texture(u_image, uv).rgb;
  return pow(max(encoded, vec3(0.0)), vec3(2.2));
}

float random01(vec2 seed) {
  return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 applyFilmSim(vec3 color, int filmSimId) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));

  if (filmSimId == 1) { // velvia
    color = mix(vec3(luma), color, 1.35);
    color = pow(color, vec3(0.95));
  } else if (filmSimId == 2) { // astia
    color = mix(vec3(luma), color, 1.08);
    color.r *= 1.03;
    color.b *= 0.98;
  } else if (filmSimId == 3) { // classic_chrome
    color = mix(vec3(luma), color, 0.88);
    color.b *= 0.94;
    color.r *= 0.98;
  } else if (filmSimId == 4) { // classic_neg
    color = mix(vec3(luma), color, 0.92);
    color.r *= 1.04;
    color.g *= 0.96;
  } else if (filmSimId == 5) { // eterna
    color = mix(vec3(luma), color, 0.8);
    color = pow(color, vec3(1.04));
  } else if (filmSimId == 6 || filmSimId == 7) { // acros / mono
    color = vec3(luma);
  }

  return color;
}

vec3 applyColorChrome(vec3 color, float chromeStrength, float chromeBlueStrength) {
  float maxChannel = max(color.r, max(color.g, color.b));
  float minChannel = min(color.r, min(color.g, color.b));
  float chroma = maxChannel - minChannel;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

  float saturationMask = smoothstep(0.18, 0.72, chroma);
  float toneMask = smoothstep(0.2, 0.95, luma);
  float chromeMask = saturationMask * toneMask;
  float chromeAmount = chromeStrength * chromeMask;

  color *= 1.0 - chromeAmount * 0.16;
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = gray + (color - gray) * (1.0 + chromeAmount * 0.24);

  float blueDominance = clamp(color.b - max(color.r, color.g), 0.0, 1.0);
  float blueMask = smoothstep(0.05, 0.35, blueDominance) * saturationMask;
  float blueAmount = chromeBlueStrength * blueMask;

  color.b *= 1.0 + blueAmount * 0.25;
  color.r *= 1.0 - blueAmount * 0.07;
  color.g *= 1.0 - blueAmount * 0.04;
  color *= 1.0 - blueAmount * 0.08;

  return color;
}

void main() {
  vec3 center = decodeLinear(v_uv);
  vec3 north = decodeLinear(v_uv + vec2(0.0, u_texel.y));
  vec3 south = decodeLinear(v_uv - vec2(0.0, u_texel.y));
  vec3 east = decodeLinear(v_uv + vec2(u_texel.x, 0.0));
  vec3 west = decodeLinear(v_uv - vec2(u_texel.x, 0.0));
  vec3 blur = (center + north + south + east + west) / 5.0;

  vec3 color = mix(center, blur, u_noise_reduction);
  vec3 detail = color - blur;
  color += detail * u_clarity;
  color += detail * u_sharpness * 0.75;

  color *= u_wb;
  color = clamp(color, 0.0, 1.0);

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float shadowZone = 1.0 - smoothstep(0.0, 0.5, luma);
  float highlightZone = smoothstep(0.5, 1.0, luma);

  color -= shadowZone * u_shadow * 0.12;
  color -= highlightZone * u_highlight * 0.12;

  color = color / (1.0 + u_dr * color);

  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, u_saturation);

  color = applyFilmSim(color, u_film_sim);
  color = applyColorChrome(color, u_chrome, u_chrome_blue);

  float lumaAfterFilm = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float grainScale = mix(900.0, 450.0, u_grain_size);
  float grain = random01(v_uv * grainScale + vec2(u_shadow, u_highlight)) - 0.5;
  float grainWeight = u_grain_amount * (0.35 + 0.65 * (1.0 - lumaAfterFilm));
  color += vec3(grain * grainWeight);

  color = clamp(color, 0.0, 1.0);
  color = pow(color, vec3(1.0 / 2.2));

  out_color = vec4(color, 1.0);
}
`;

export type ApproxRenderOptions = {
  resolutionScale?: number;
};

function assertNonNull<T>(value: T | null, message: string): T {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type SourceSizeCandidate = Partial<{
  naturalWidth: number;
  naturalHeight: number;
  videoWidth: number;
  videoHeight: number;
  width: number;
  height: number;
}>;

function getValidDimension(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function resolveSourceSize(
  image: TexImageSource,
  fallbackWidth: number,
  fallbackHeight: number,
): { width: number; height: number } {
  const source = image as SourceSizeCandidate;

  const width = getValidDimension(
    source.naturalWidth,
    getValidDimension(source.videoWidth, getValidDimension(source.width, fallbackWidth)),
  );
  const height = getValidDimension(
    source.naturalHeight,
    getValidDimension(source.videoHeight, getValidDimension(source.height, fallbackHeight)),
  );

  return { width, height };
}

export function computeRenderDimensions(
  sourceWidth: number,
  sourceHeight: number,
  resolutionScale: number,
): { width: number; height: number } {
  const normalizedScale = clamp(resolutionScale, 0.1, 1);

  return {
    width: Math.max(1, Math.round(sourceWidth * normalizedScale)),
    height: Math.max(1, Math.round(sourceHeight * normalizedScale)),
  };
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = assertNonNull(gl.createShader(type), "Unable to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }

  const info = gl.getShaderInfoLog(shader) ?? "unknown compile error";
  gl.deleteShader(shader);
  throw new Error(`Shader compile failed: ${info}`);
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

  const program = assertNonNull(gl.createProgram(), "Unable to create program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return program;
  }

  const info = gl.getProgramInfoLog(program) ?? "unknown link error";
  gl.deleteProgram(program);
  throw new Error(`Program link failed: ${info}`);
}

export class ApproxWebglRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private readonly positionLocation: number;
  private readonly wbLocation: WebGLUniformLocation;
  private readonly saturationLocation: WebGLUniformLocation;
  private readonly shadowLocation: WebGLUniformLocation;
  private readonly highlightLocation: WebGLUniformLocation;
  private readonly dynamicRangeLocation: WebGLUniformLocation;
  private readonly filmSimLocation: WebGLUniformLocation;
  private readonly imageLocation: WebGLUniformLocation;
  private readonly texelLocation: WebGLUniformLocation;
  private readonly clarityLocation: WebGLUniformLocation;
  private readonly noiseReductionLocation: WebGLUniformLocation;
  private readonly sharpnessLocation: WebGLUniformLocation;
  private readonly chromeLocation: WebGLUniformLocation;
  private readonly chromeBlueLocation: WebGLUniformLocation;
  private readonly grainAmountLocation: WebGLUniformLocation;
  private readonly grainSizeLocation: WebGLUniformLocation;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 is not available");
    }

    this.gl = gl;
    this.program = createProgram(gl);
    this.positionBuffer = assertNonNull(gl.createBuffer(), "Unable to create position buffer");
    this.texture = assertNonNull(gl.createTexture(), "Unable to create texture");

    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.wbLocation = assertNonNull(gl.getUniformLocation(this.program, "u_wb"), "u_wb missing");
    this.saturationLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_saturation"),
      "u_saturation missing",
    );
    this.shadowLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_shadow"),
      "u_shadow missing",
    );
    this.highlightLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_highlight"),
      "u_highlight missing",
    );
    this.dynamicRangeLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_dr"),
      "u_dr missing",
    );
    this.filmSimLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_film_sim"),
      "u_film_sim missing",
    );
    this.imageLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_image"),
      "u_image missing",
    );
    this.texelLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_texel"),
      "u_texel missing",
    );
    this.clarityLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_clarity"),
      "u_clarity missing",
    );
    this.noiseReductionLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_noise_reduction"),
      "u_noise_reduction missing",
    );
    this.sharpnessLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_sharpness"),
      "u_sharpness missing",
    );
    this.chromeLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_chrome"),
      "u_chrome missing",
    );
    this.chromeBlueLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_chrome_blue"),
      "u_chrome_blue missing",
    );
    this.grainAmountLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_grain_amount"),
      "u_grain_amount missing",
    );
    this.grainSizeLocation = assertNonNull(
      gl.getUniformLocation(this.program, "u_grain_size"),
      "u_grain_size missing",
    );

    this.initBuffers();
  }

  private initBuffers(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(
    image: TexImageSource,
    params: ApproxRenderParams,
    options: ApproxRenderOptions = {},
  ): void {
    const gl = this.gl;
    const uniforms = buildApproxUniforms(params);
    const sourceSize = resolveSourceSize(image, this.canvas.width, this.canvas.height);
    const renderSize = computeRenderDimensions(
      sourceSize.width,
      sourceSize.height,
      options.resolutionScale ?? 1,
    );

    this.canvas.width = renderSize.width;
    this.canvas.height = renderSize.height;
    gl.viewport(0, 0, renderSize.width, renderSize.height);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(this.imageLocation, 0);

    gl.uniform3f(
      this.wbLocation,
      uniforms.wbMultipliers[0],
      uniforms.wbMultipliers[1],
      uniforms.wbMultipliers[2],
    );
    gl.uniform1f(this.saturationLocation, uniforms.saturation);
    gl.uniform1f(this.shadowLocation, uniforms.shadow);
    gl.uniform1f(this.highlightLocation, uniforms.highlight);
    gl.uniform1f(this.dynamicRangeLocation, uniforms.dynamicRangeCompression);
    gl.uniform1i(this.filmSimLocation, uniforms.filmSimId);
    gl.uniform2f(this.texelLocation, 1 / renderSize.width, 1 / renderSize.height);
    gl.uniform1f(this.clarityLocation, uniforms.clarity);
    gl.uniform1f(this.noiseReductionLocation, uniforms.noiseReduction);
    gl.uniform1f(this.sharpnessLocation, uniforms.sharpness);
    gl.uniform1f(this.chromeLocation, uniforms.chromeStrength);
    gl.uniform1f(this.chromeBlueLocation, uniforms.chromeBlueStrength);
    gl.uniform1f(this.grainAmountLocation, uniforms.grainAmount);
    gl.uniform1f(this.grainSizeLocation, uniforms.grainSize);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}
