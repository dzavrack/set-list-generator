"use client";
import { useState } from "react";
import { NoirShader } from "./NoirShader";

/**
 * The street behind the app. A WebGL shader paints smoke, neon tubes, bokeh and rain;
 * the CSS layers below are the fallback when WebGL isn't available.
 */
/** `tubes` draws the two neon tubes that frame the sidebar; pages without a sidebar turn them off. */
export function NoirBackdrop({ tubes = true }: { tubes?: boolean }) {
  const [shaderOn, setShaderOn] = useState(false);
  return (
    <>
      {!shaderOn && <CssBackdrop tubes={tubes} />}
      <NoirShader tubes={tubes} onReady={() => setShaderOn(true)} />
    </>
  );
}

function CssBackdrop({ tubes }: { tubes: boolean }) {
  return (
    <div aria-hidden className="grain pointer-events-none fixed inset-0 -z-0 overflow-hidden bg-bg">
      {/* smoke: layered haze + turbulence texture */}
      <div className="smoke-drift absolute -top-[20%] -left-[15%] h-[85%] w-[70%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_32%,transparent),color-mix(in_srgb,var(--neon-deep)_14%,transparent)_55%,transparent)] blur-3xl" />
      <div className="absolute top-[35%] -left-[10%] h-[50%] w-[40%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_12%,transparent),transparent)] blur-3xl" />
      <div className="absolute -top-[10%] right-[-10%] h-[45%] w-[45%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_10%,transparent),transparent)] blur-3xl" />
      <svg className="smoke-drift absolute -top-[10%] -left-[10%] h-[90%] w-[60%] opacity-[0.55] mix-blend-screen [animation-duration:60s] [mask-image:radial-gradient(closest-side,black,transparent)]">
        <filter id="noir-smoke">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="4" seed="7" />
          <feColorMatrix values="0 0 0 0 1   0 0 0 0 0.16   0 0 0 0 0.24   0 0 0 1.1 -0.45" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noir-smoke)" />
      </svg>

      {tubes && (
        <>
          {/* two vertical tubes, as in the smoke photograph */}
          <div className="absolute top-[7%] left-[255px] hidden h-[52%] lg:block">
            <div className="tube-v h-full opacity-90" />
          </div>
          <div className="absolute top-[12%] left-[261px] hidden h-[30%] lg:block">
            <div className="tube-v h-full opacity-60" />
          </div>
          {/* their reflection on wet pavement */}
          <div className="absolute bottom-0 left-[238px] hidden h-[26%] w-10 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--accent)_22%,transparent),transparent)] blur-md [mask-image:repeating-linear-gradient(to_bottom,black_0_3px,transparent_3px_7px)] lg:block" />
        </>
      )}

      {/* bokeh: street lamps down the block */}
      <div className="absolute bottom-[9%] left-[4%] h-16 w-16 rounded-full bg-[rgb(233_161_90/0.35)] blur-xl" />
      <div className="absolute bottom-[16%] left-[18%] h-9 w-9 rounded-full bg-[rgb(233_161_90/0.28)] blur-lg" />
      <div className="absolute bottom-[4%] left-[26%] h-12 w-12 rounded-full bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] blur-xl" />
      <div className="absolute bottom-[22%] left-[9%] h-5 w-5 rounded-full bg-[rgb(255_210_170/0.35)] blur-md" />
      <div className="absolute right-[6%] bottom-[-4%] h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] blur-3xl" />

      {/* rain */}
      <div className="absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(103deg,transparent_0_22px,rgb(255_255_255/0.9)_22px_23px,transparent_23px_61px)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      {/* vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_220px_rgb(0_0_0/0.9)]" />
    </div>
  );
}
