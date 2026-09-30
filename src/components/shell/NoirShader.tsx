"use client";
import { useEffect, useRef, useState } from "react";
import { FRAG, VERT } from "./noir.glsl";

const TUBE_X = 255; // CSS px: the gap between the sidebar and the panel
const FPS = 30;

/** Full-screen WebGL backdrop. Renders at reduced resolution, 30fps, pauses when hidden. */
export function NoirShader({ onReady }: { onReady?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn("Backdrop shader:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uScale = gl.getUniformLocation(prog, "uScale");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uTubeX = gl.getUniformLocation(prog, "uTubeX");


    // Smoke is soft: render well under device resolution and let the browser upscale.
    let scale = 0.5;
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      scale = Math.min(window.devicePixelRatio || 1, 2) * (w * h > 1_600_000 ? 0.4 : 0.5);
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now() - 40_000; // start mid-drift so the smoke is already rolling
    let raf = 0, last = 0, shown = false;

    const draw = (now: number) => {
      const w = window.innerWidth;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uScale, scale);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1f(uTubeX, w >= 1024 ? TUBE_X : -1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) {
        shown = true;
        setVisible(true);
        onReady?.();
      }
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 1000 / FPS) return;
      last = now;
      draw(now);
    };
    const kick = () => {
      cancelAnimationFrame(raf);
      draw(performance.now()); // always paint a first frame, even in a background tab
      if (!still.matches) raf = requestAnimationFrame(loop);
    };
    kick();
    still.addEventListener("change", kick);
    const onResize = () => still.matches && draw(performance.now());
    window.addEventListener("resize", onResize);

    const lost = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", lost);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", onResize);
      still.removeEventListener("change", kick);
      canvas.removeEventListener("webglcontextlost", lost);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
    // onReady is a one-shot notification; re-running the GL setup for a new callback identity isn't wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-0 h-full w-full transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
