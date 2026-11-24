// 全屏三角形顶点着色器
export const FULLSCREEN_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

// 距离场片元：逐段求点到线段最短距离，取 min 输出 R32F
// segments 纹理每个像素编码一条线段：rg=起点 ba，ba=终点
export const DISTANCE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_segments;
uniform int u_segCount;
uniform vec2 u_worldSize;
out float outDistance;

float pointSegmentDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float lenSq = dot(ab, ab);
  float t = lenSq < 1e-8 ? 0.0 : clamp(dot(p - a, ab) / lenSq, 0.0, 1.0);
  return distance(p, a + ab * t);
}

void main() {
  vec2 world = vec2(v_uv.x, 1.0 - v_uv.y) * u_worldSize;
  float minDist = 1e9;
  for (int i = 0; i < 4096; i++) {
    if (i >= u_segCount) break;
    ivec2 texel = ivec2(i % 2048, i / 2048);
    vec4 s = texelFetch(u_segments, texel, 0);
    float d = pointSegmentDist(world, s.rg, s.ba);
    minDist = min(minDist, d);
  }
  outDistance = minDist;
}
`

// 釉面烧制效果：距离场 -> 弯月面高度 -> 光照 + 砂眼 + 镀金丝
export const FIRING_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;

uniform sampler2D u_distance;
uniform sampler2D u_cellColor;
uniform vec2 u_worldSize;
uniform float u_wireWidth;
uniform float u_wireHeight;
uniform int u_firings;
uniform int u_requiredCoats;
uniform int u_pinholeSeed;
uniform float u_pinholeDensity;
uniform bool u_gilded;
uniform bool u_polished;
uniform bool u_groundPattern;

out vec4 outColor;

float hash11(int n) {
  uint x = uint(n) * 747796405u + 2891336453u;
  uint w = (x >> 16) ^ x;
  w = (w * (w * w * 3266489909u + 3624360693u)) >> 16;
  return float(w & 0xffffu) / 65535.0;
}

// 弯月面：贴丝毛细拉高 + 格心塌陷，高度单位毫米
float meniscusHeight(float d, float coatScale) {
  float capillary = exp(-d / 0.9) * 0.22;
  float sag = -0.18 * (1.0 - exp(-d / 2.4));
  return (0.35 + capillary + sag) * coatScale;
}

void main() {
  float d = texture(u_distance, v_uv).r;
  vec3 baseColor = texture(u_cellColor, v_uv).rgb;

  // 丝宽内按铜丝渲染（磨光后丝顶找平，镀金显金色）
  if (d < u_wireWidth * 0.5) {
    vec3 copper = u_gilded
      ? vec3(0.83, 0.65, 0.25)
      : vec3(0.72, 0.42, 0.22);
    float sheen = 0.85 + 0.15 * sin((v_uv.x + v_uv.y) * 220.0);
    outColor = vec4(copper * sheen, 1.0);
    return;
  }

  float coatScale = float(u_firings) / float(max(1, u_requiredCoats));
  float h = meniscusHeight(d, coatScale);
  float wireTop = u_wireHeight;

  // 遍数不足：格心釉面低于丝顶，凹坑处压暗
  bool pit = h < wireTop * 0.55 && coatScale < 1.0;

  // 砂眼：按格子内距离与厚度撒种，同种子结果一致
  ivec2 px = ivec2(gl_FragCoord.xy);
  int cellKey = px.x * 73856093 ^ px.y * 19349663 ^ u_pinholeSeed;
  float rnd = hash11(cellKey);
  float thicknessFactor = clamp(1.4 - coatScale, 0.2, 1.0);
  bool pinhole = rnd < u_pinholeDensity * thicknessFactor * 0.02;

  // 法线由高度场差分得到
  float e = 1.5 / u_worldSize.x;
  float dL = texture(u_distance, v_uv - vec2(e, 0.0)).r;
  float dR = texture(u_distance, v_uv + vec2(e, 0.0)).r;
  float dD = texture(u_distance, v_uv - vec2(0.0, e)).r;
  float dU = texture(u_distance, v_uv + vec2(0.0, e)).r;
  vec3 normal = normalize(vec3(
    (meniscusHeight(dL, coatScale) - meniscusHeight(dR, coatScale)) * 8.0,
    (meniscusHeight(dD, coatScale) - meniscusHeight(dU, coatScale)) * 8.0,
    1.0
  ));
  vec3 lightDir = normalize(vec3(0.4, 0.5, 0.85));
  float diffuse = 0.55 + 0.45 * max(dot(normal, lightDir), 0.0);
  float spec = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);

  vec3 color = baseColor * diffuse + vec3(spec * 0.35);

  // 透明釉下地纹反光
  if (u_groundPattern) {
    float pattern = 0.5 + 0.5 * sin(v_uv.x * 160.0) * sin(v_uv.y * 160.0);
    color += vec3(0.06, 0.05, 0.03) * pattern;
  }
  if (pit) color *= 0.62;
  if (pinhole) color = vec3(0.05, 0.04, 0.03);

  outColor = vec4(color, 1.0);
}
`
