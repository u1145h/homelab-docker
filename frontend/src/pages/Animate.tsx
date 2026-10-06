import { useState } from 'react'
import { PageContainer } from '@/components/shell'

// The SVG Path Data extracted from icon.svg
const PATHS = [
  'M1501.679,1699.147c431.393,14.962 372.248,592.954 32.931,611.947c-416.466,23.311 -461.775,-590.593 -32.931,-611.947Z',
  'M1800.467,994.081c-26.949,478.626 -723.603,340.118 -598.409,-94.749c78.526,-272.765 562.959,-325.91 598.409,94.749Z',
  'M2003.5,1197.486c433.866,18.365 366.474,595.534 32.94,611.951c-418.176,20.583 -462.43,-585.932 -32.94,-611.951Z',
  'M1298.716,1495.978c-23.993,433.791 -635.868,379.513 -611.289,-32.816c19.159,-321.399 578.295,-419.552 611.289,32.816Z',
  'M1174.21,762.769c-347.543,237.566 -470.58,-126.309 -223.965,-288.169c257.869,-169.246 504.216,25.751 223.965,288.169Z',
  'M2540.612,1272.372c-246.258,191.6 -556.186,-417.883 -245.902,-443.891c168.221,-14.1 402.999,277.552 245.902,443.891Z',
  'M2111.863,544.712c253.75,391.124 -370.293,357.611 -419.674,28.96c-17.876,-118.971 157.405,-302.833 419.674,-28.96Z',
  'M2291.644,1767.074c304.923,-209.473 392.797,143.625 177.832,339.901c-225.966,206.32 -470.647,-61.409 -177.832,-339.901Z',
  'M1145.516,2588.053c-284.433,-18.477 -376.952,-309.09 -269.425,-389.117c250.447,-186.394 670.493,361.162 269.425,389.117Z',
  'M546.345,1292.321c-237.731,-27.502 -127.404,-366.261 52.604,-452.471c324.434,-155.379 316.988,424.37 -52.604,452.471Z',
  'M409.692,1852.128c20.623,-297.597 358.506,-139.182 415.056,80.068c89.274,346.124 -388.522,292.39 -415.056,-80.068Z',
  'M1705.042,2451.424c20.852,-260.78 337.372,-357.681 443.109,-242.167c192.395,210.185 -399.317,583.039 -443.109,242.167Z',
  'M1735.449,2726.308c-52.04,237.502 -649.992,47.789 -345.767,-94.026c56.725,-26.443 311.808,-61.751 345.767,94.026Z',
  'M167.412,1545.558c-34.378,-380.554 155.254,-272.158 177.176,-238.348c147.728,227.84 -100.805,590.255 -177.176,238.348Z',
  'M2836.743,1528.309c-9.995,286.091 -170.972,216.068 -205.023,114.485c-89.365,-266.602 113.886,-451.305 185.569,-245.645c22.48,64.495 15.783,64.446 19.454,131.16Z',
  'M1469.284,160.914c75.52,4.63 75.203,3.482 81.561,5.001c326.448,77.948 14.925,308.965 -223.25,189.207c-47.764,-24.016 -169.756,-177.359 141.689,-194.208Z',
  'M692.172,2428.083c9.595,1.287 62.439,-5.364 155.563,63.138c22.512,16.56 75.914,75.423 77.663,121.398c8.077,212.321 -500.956,-147.043 -233.227,-184.536Z',
  'M2589.165,2324.303c-10.571,8.574 -177.862,144.266 -169.054,-19.147c10.584,-196.358 315.476,-330.386 240.316,-98.985c-20.402,62.814 -63.792,110.007 -71.262,118.132Z',
  'M673.012,408.112c14.315,-10.666 148.033,-110.305 210.917,-72.862c68.034,40.509 2.069,126.38 -4.511,134.946c-104.19,135.631 -391.734,161.53 -206.406,-62.084Z',
  'M569.82,2305.38c-34.532,268.529 -396.365,-238.448 -184.968,-232.643c48.879,1.342 99.78,53.781 106.62,60.828c64.014,65.948 76.321,156.845 78.348,171.815Z',
  'M2433.25,686.344c19.447,-150.574 190.492,-33.707 237.921,112.285c62.719,193.059 -217.061,147.222 -237.921,-112.285Z',
  'M2149.002,2668.072c-152.582,-33.102 -23.134,-193.238 111.813,-238.747c209.941,-70.799 128.426,224.31 -111.813,238.747Z',
  'M2077.359,378.761c31.534,-130.349 208.067,-21.542 260.318,37.741c181.464,205.889 -225.244,190.951 -260.318,-37.741Z',
  'M329.225,848.639c2.781,-28.91 -2.813,-95.197 92.319,-189.825c29.445,-29.29 70.578,-47.613 92.993,-47.049c202.506,5.094 -134.813,485.323 -185.312,236.874Z',
]

export default function AnimatePage() {
  const [activeDemo, setActiveDemo] = useState<number>(0)
  const [themeMode, setThemeMode] = useState<'dark-accent' | 'light-dark' | 'accent-dark'>('dark-accent')

  const currentBg =
    themeMode === 'dark-accent' ? '#111314' : themeMode === 'light-dark' ? '#f6f4ef' : '#A9B665'

  const fillColor = themeMode === 'dark-accent' ? '#A9B665' : '#111314'

  // ONLY the 4 Shortlisted Animations
  const finalShortlist = [
    {
      id: 'shortlist-normal-gentle-wave',
      category: 'Normal / Idle State',
      name: '1. Gentle Harmonic Wave (Radial Ripple)',
      desc: 'Applied during normal/resting state. Radial low-amplitude wave propagating across outer nodes with gentle floating float.',
      badge: 'Normal / Idle',
      badgeBg: 'rgba(169, 182, 101, 0.2)',
      render: () => (
        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @keyframes gentleWaveNode {
              0%, 100% { transform: scale(1); opacity: 0.75; }
              50% { transform: scale(1.08); opacity: 1; }
            }
            @keyframes gentleFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-4px); }
            }
          `}</style>
          <svg
            viewBox="0 0 3000 3000"
            width="200"
            height="200"
            style={{
              animation: 'gentleFloat 5s ease-in-out infinite',
              transformOrigin: '50% 50%',
            }}
          >
            <g style={{ transformOrigin: '50% 50%' }}>
              {PATHS.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={fillColor}
                  style={{
                    transformOrigin: '50% 50%',
                    animation: `gentleWaveNode 3s ease-in-out infinite`,
                    animationDelay: `${(i * 125) % 3000}ms`,
                  }}
                />
              ))}
            </g>
          </svg>
        </div>
      ),
    },
    {
      id: 'shortlist-thinking-quantum-vortex',
      category: 'Thinking / Active State (Option A)',
      name: '2. Quantum Vortex (Refined Orbit & Snap)',
      desc: 'Applied when assistant is generating responses. Non-linear acceleration with elastic snap momentum and sequential glow flares.',
      badge: 'Thinking (Option A)',
      badgeBg: 'rgba(125, 174, 163, 0.25)',
      render: () => (
        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @keyframes qVortexPro {
              0% { transform: rotate(0deg) scale(0.94); }
              30% { transform: rotate(140deg) scale(1.06); }
              60% { transform: rotate(240deg) scale(0.96); }
              85% { transform: rotate(330deg) scale(1.04); }
              100% { transform: rotate(360deg) scale(0.94); }
            }
            @keyframes qNodeGlow {
              0%, 100% { opacity: 0.35; transform: scale(0.92); }
              50% { opacity: 1; transform: scale(1.1); filter: drop-shadow(0 0 6px ${fillColor}); }
            }
          `}</style>
          <svg
            viewBox="0 0 3000 3000"
            width="200"
            height="200"
            style={{
              animation: 'qVortexPro 3.2s cubic-bezier(0.65, 0, 0.35, 1) infinite',
              transformOrigin: '50% 50%',
              filter: `drop-shadow(0 0 16px ${fillColor === '#111314' ? 'rgba(0,0,0,0.2)' : 'rgba(169, 182, 101, 0.4)'})`,
            }}
          >
            <g style={{ transformOrigin: '50% 50%' }}>
              {PATHS.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={fillColor}
                  style={{
                    transformOrigin: '50% 50%',
                    animation: `qNodeGlow 1.8s ease-in-out infinite`,
                    animationDelay: `${(i * 85) % 1800}ms`,
                  }}
                />
              ))}
            </g>
          </svg>
        </div>
      ),
    },
    {
      id: 'shortlist-thinking-quantum-pulsar',
      category: 'Thinking / Active State (Option B)',
      name: '3. Quantum Pulsar (Burst & Regroup)',
      desc: 'Applied when assistant is generating responses. Outward elastic burst with a 180° twist rotation and snap return.',
      badge: 'Thinking (Option B)',
      badgeBg: 'rgba(211, 134, 155, 0.25)',
      render: () => (
        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @keyframes pulsarBurst {
              0% { transform: scale(0.9) rotate(0deg); opacity: 0.6; }
              35% { transform: scale(1.14) rotate(160deg); opacity: 1; filter: drop-shadow(0 0 16px ${fillColor}); }
              70% { transform: scale(0.96) rotate(300deg); opacity: 0.8; }
              100% { transform: scale(0.9) rotate(360deg); opacity: 0.6; }
            }
            @keyframes pulsarSpark {
              0%, 100% { opacity: 0.4; }
              40% { opacity: 1; filter: drop-shadow(0 0 8px ${fillColor}); }
            }
          `}</style>
          <svg
            viewBox="0 0 3000 3000"
            width="200"
            height="200"
            style={{
              animation: 'pulsarBurst 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite',
              transformOrigin: '50% 50%',
            }}
          >
            <g style={{ transformOrigin: '50% 50%' }}>
              {PATHS.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={fillColor}
                  style={{
                    animation: `pulsarSpark 2.8s ease-in-out infinite`,
                    animationDelay: `${(i * 50) % 2800}ms`,
                  }}
                />
              ))}
            </g>
          </svg>
        </div>
      ),
    },
    {
      id: 'shortlist-loading-tachyon-acceleration',
      category: 'Loading Screen State',
      name: '4. Tachyon Acceleration Cycle (Charge & Discharge)',
      desc: 'Applied for app loading / splash screen. Starts slow, rapidly accelerates into a motion blur spin with glowing halo, then cleanly resets in a rhythmic loop.',
      badge: 'Loading Screen',
      badgeBg: 'rgba(234, 105, 98, 0.25)',
      render: () => (
        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @keyframes tachyonCycle {
              0% { transform: rotate(0deg) scale(0.92); }
              40% { transform: rotate(90deg) scale(1.02); }
              70% { transform: rotate(450deg) scale(1.12); filter: drop-shadow(0 0 20px ${fillColor}); }
              100% { transform: rotate(720deg) scale(0.92); }
            }
            @keyframes tachyonFlash {
              0%, 100% { opacity: 0.4; }
              70% { opacity: 1; }
            }
          `}</style>
          <svg
            viewBox="0 0 3000 3000"
            width="200"
            height="200"
            style={{
              animation: 'tachyonCycle 2.4s cubic-bezier(0.7, 0, 0.3, 1) infinite',
              transformOrigin: '50% 50%',
              filter: `drop-shadow(0 0 14px ${fillColor === '#111314' ? 'rgba(0,0,0,0.2)' : 'rgba(169, 182, 101, 0.4)'})`,
            }}
          >
            <g style={{ transformOrigin: '50% 50%' }}>
              {PATHS.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={fillColor}
                  style={{
                    animation: `tachyonFlash 2.4s ease-in-out infinite`,
                    animationDelay: `${(i * 40) % 2400}ms`,
                  }}
                />
              ))}
            </g>
          </svg>
        </div>
      ),
    },
  ]

  const selectedDemo = finalShortlist[activeDemo]

  const getTextColor = () => {
    if (themeMode === 'dark-accent') return '#FFFFFF'
    return '#111314'
  }

  const getMutedColor = () => {
    if (themeMode === 'dark-accent') return '#999999'
    return 'rgba(17, 19, 20, 0.65)'
  }

  return (
    <PageContainer fullWidth padding={20}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--kuro-color-text-primary)' }}>
              Kuro Logo Final Animation Shortlist
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--kuro-color-text-secondary)' }}>
              The 4 shortlisted animations across Normal, Thinking, and Loading states.
            </p>
          </div>

          {/* Clean 3-Option Color Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--kuro-color-surface-elevated)',
              border: '1px solid var(--kuro-color-border)',
              borderRadius: 24,
              padding: '3px 4px',
              gap: 4,
            }}
          >
            {/* 1. Dark BG (#111314) + Accent Logo */}
            <button
              onClick={() => setThemeMode('dark-accent')}
              title="Dark Background (#111314) with Accent Green Logo"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: themeMode === 'dark-accent' ? 'var(--kuro-color-hover)' : 'transparent',
                color: themeMode === 'dark-accent' ? 'var(--kuro-color-primary)' : 'var(--kuro-color-text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: '#111314',
                  border: '2px solid #A9B665',
                  display: 'inline-block',
                }}
              />
              <span>#111314 (Dark)</span>
            </button>

            {/* 2. Light BG (#f6f4ef) + Black Logo */}
            <button
              onClick={() => setThemeMode('light-dark')}
              title="Light Background (#f6f4ef) with Black Logo"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: themeMode === 'light-dark' ? 'var(--kuro-color-hover)' : 'transparent',
                color: themeMode === 'light-dark' ? 'var(--kuro-color-primary)' : 'var(--kuro-color-text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: '#f6f4ef',
                  border: '2px solid #111314',
                  display: 'inline-block',
                }}
              />
              <span>#f6f4ef (Light)</span>
            </button>

            {/* 3. Accent BG (#A9B665) + Black Logo */}
            <button
              onClick={() => setThemeMode('accent-dark')}
              title="Accent Green Background (#A9B665) with Black Logo"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: themeMode === 'accent-dark' ? 'var(--kuro-color-hover)' : 'transparent',
                color: themeMode === 'accent-dark' ? 'var(--kuro-color-primary)' : 'var(--kuro-color-text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: '#A9B665',
                  border: '2px solid #111314',
                  display: 'inline-block',
                }}
              />
              <span>Accent (#A9B665)</span>
            </button>
          </div>
        </div>

        {/* Shortlist Selector Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {finalShortlist.map((d, idx) => (
            <button
              key={d.id}
              onClick={() => setActiveDemo(idx)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeDemo === idx ? 'var(--kuro-color-primary)' : 'var(--kuro-color-surface-elevated)',
                color: activeDemo === idx ? 'var(--kuro-color-background)' : 'var(--kuro-color-text-secondary)',
                border: `1px solid ${activeDemo === idx ? 'var(--kuro-color-primary)' : 'var(--kuro-color-border)'}`,
                transition: 'all 0.15s',
              }}
            >
              {d.name}
            </button>
          ))}
        </div>

        {/* Main Stage Preview */}
        <div
          style={{
            backgroundColor: currentBg,
            border: themeMode === 'dark-accent' ? '1px solid var(--kuro-color-border)' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: 16,
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 340,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            transition: 'background-color 0.3s ease',
          }}
        >
          {selectedDemo.render()}

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '3px 10px',
                borderRadius: 12,
                backgroundColor: selectedDemo.badgeBg,
                color: themeMode === 'dark-accent' ? '#fff' : '#111314',
                display: 'inline-block',
                marginBottom: 6,
              }}
            >
              {selectedDemo.badge}
            </span>
            <h3 style={{ margin: 0, fontSize: 16, color: getTextColor() }}>
              {selectedDemo.name}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: getMutedColor(), maxWidth: 560 }}>
              {selectedDemo.desc}
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 0', color: 'var(--kuro-color-text-primary)' }}>
          Side-by-Side View of All 4 Shortlisted Animations
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
            gap: 16,
          }}
        >
          {finalShortlist.map((d, idx) => (
            <div
              key={d.id}
              onClick={() => setActiveDemo(idx)}
              style={{
                backgroundColor: currentBg,
                border: `1px solid ${activeDemo === idx ? 'var(--kuro-color-primary)' : themeMode === 'dark-accent' ? 'var(--kuro-color-border)' : 'rgba(0,0,0,0.15)'}`,
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ transform: 'scale(0.7)', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {d.render()}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  backgroundColor: d.badgeBg,
                  color: themeMode === 'dark-accent' ? '#fff' : '#111314',
                  marginBottom: 4,
                }}
              >
                {d.badge}
              </span>
              <div style={{ fontSize: 13, fontWeight: 600, color: getTextColor(), textAlign: 'center' }}>
                {d.name}
              </div>
              <div style={{ fontSize: 11, color: getMutedColor(), marginTop: 4, textAlign: 'center' }}>
                {d.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
