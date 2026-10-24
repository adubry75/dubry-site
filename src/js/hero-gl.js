// Life 1 sky: a tiny raw-WebGL fragment shader (aurora ribbons, twinkling stars,
// a dawn glow on the horizon). Rendered at reduced resolution, paused off-screen.
const FRAG = `precision mediump float;
uniform vec2 r; uniform float t; uniform float sc;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a*n(p); p *= 2.03; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / r; vec2 p = uv; p.x *= r.x / r.y;
  vec3 col = mix(vec3(.11,.04,.19), vec3(.02,.016,.05), smoothstep(0., .95, uv.y));
  col += vec3(1.,.31,.85) * .5 * pow(1. - uv.y, 3.2) * (.85 + .15*sin(t*.3));
  col += vec3(1.,.55,.24) * .22 * pow(1. - uv.y, 7.);
  for (int k = 0; k < 3; k++){
    float fk = float(k);
    float y = .62 + fk*.09 + .07*sin(p.x*1.3 + t*.13 + fk*2.1) + .05*fbm(vec2(p.x*1.7 + t*.05, fk*3.));
    float band = exp(-pow((uv.y - y) * (14. - fk*3.), 2.));
    float shimmer = .55 + .45*fbm(vec2(p.x*6. - t*.25, fk*7. + t*.1));
    vec3 c = mix(vec3(.24,.95,1.), vec3(1.,.31,.85), fk*.5 + .25*sin(p.x + t*.1));
    col += c * band * shimmer * (.45 - fk*.1);
  }
  vec2 q = p * 70.; vec2 g = floor(q); float s = h(g);
  float d = length(fract(q) - .5 - (vec2(h(g + 1.7), h(g + 3.1)) - .5) * .6);
  float tw = .55 + .45*sin(t*(1.2 + s*3.) + s*40.);
  col += step(.982, s) * smoothstep(.16, .0, d) * tw * smoothstep(.2, .65, uv.y) * vec3(1.,.93,1.);
  col *= 1. - .35*sc;
  gl_FragColor = vec4(col, 1.);
}`;

export function init(canvas) {
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uS = gl.getUniformLocation(prog, 'sc');

  const scale = 0.5; // soft sky: half resolution is plenty
  const size = () => {
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  size();
  new ResizeObserver(size).observe(canvas);

  let visible = true, raf = 0;
  const t0 = performance.now();
  const draw = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform1f(uS, Math.min(1, scrollY / innerHeight));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(draw);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(draw); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(draw); });
  raf = requestAnimationFrame((n) => { draw(n); canvas.classList.add('is-on'); });
}
