import { forwardRef, type SVGAttributes } from 'react'

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

export interface KuroAssistantIconProps extends SVGAttributes<SVGSVGElement> {
  size?: number | string
  /**
   * Background variant:
   * - 'black' / 'dark': Use accent green fill (#a9b665) on dark background
   * - 'light' / 'accent': Use dark/black fill (#111314) on light or accent background
   */
  variant?: 'black' | 'dark' | 'light' | 'accent'
  /**
   * Animation mode:
   * - 'none': static SVG
   * - 'wave': Gentle Harmonic Wave (Radial Ripple) - calm breathing wave on nodes with subtle float
   * - 'thinking-vortex': Quantum Vortex (Refined Orbit & Snap)
   * - 'thinking-pulsar': Quantum Pulsar (Burst & Regroup)
   * - 'loading': Tachyon Acceleration Cycle
   */
  animation?: 'none' | 'wave' | 'thinking-vortex' | 'thinking-pulsar' | 'loading'
}

export const KuroAssistantIcon = forwardRef<SVGSVGElement, KuroAssistantIconProps>(
  ({ size = 24, variant = 'black', animation = 'wave', style, color, ...props }, ref) => {
    const isLightOrAccent = variant === 'light' || variant === 'accent'
    const defaultFill = isLightOrAccent ? '#111314' : '#a9b665'
    const fill = color || defaultFill

    // Styles for animations
    let svgAnimation: string | undefined
    let nodeAnimation: string | undefined
    let nodeDuration = '3s'

    if (animation === 'wave') {
      svgAnimation = 'kuroGentleFloat 5s ease-in-out infinite'
      nodeAnimation = 'kuroGentleWaveNode 3s ease-in-out infinite'
      nodeDuration = '3s'
    } else if (animation === 'thinking-vortex') {
      svgAnimation = 'kuroQVortexPro 3.2s cubic-bezier(0.65, 0, 0.35, 1) infinite'
      nodeAnimation = 'kuroQNodeGlow 1.8s ease-in-out infinite'
      nodeDuration = '1.8s'
    } else if (animation === 'thinking-pulsar') {
      svgAnimation = 'kuroPulsarBurst 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite'
      nodeAnimation = 'kuroPulsarSpark 2.8s ease-in-out infinite'
      nodeDuration = '2.8s'
    } else if (animation === 'loading') {
      svgAnimation = 'kuroTachyonCycle 2.4s cubic-bezier(0.7, 0, 0.3, 1) infinite'
      nodeAnimation = 'kuroTachyonFlash 2.4s ease-in-out infinite'
      nodeDuration = '2.4s'
    }

    return (
      <svg
        ref={ref}
        viewBox="0 0 3000 3000"
        width={size}
        height={size}
        style={{
          display: 'block',
          width: size,
          height: size,
          flexShrink: 0,
          transformOrigin: '50% 50%',
          animation: svgAnimation,
          ...style,
        }}
        {...props}
      >
        <style>{`
          @keyframes kuroGentleWaveNode {
            0%, 100% { transform: scale(1); opacity: 0.75; }
            50% { transform: scale(1.08); opacity: 1; }
          }
          @keyframes kuroGentleFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-2px); }
          }
          @keyframes kuroQVortexPro {
            0% { transform: rotate(0deg) scale(0.94); }
            30% { transform: rotate(140deg) scale(1.06); }
            60% { transform: rotate(240deg) scale(0.96); }
            85% { transform: rotate(330deg) scale(1.04); }
            100% { transform: rotate(360deg) scale(0.94); }
          }
          @keyframes kuroQNodeGlow {
            0%, 100% { opacity: 0.35; transform: scale(0.92); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes kuroPulsarBurst {
            0% { transform: scale(0.9) rotate(0deg); opacity: 0.6; }
            35% { transform: scale(1.14) rotate(160deg); opacity: 1; }
            70% { transform: scale(0.96) rotate(300deg); opacity: 0.8; }
            100% { transform: scale(0.9) rotate(360deg); opacity: 0.6; }
          }
          @keyframes kuroPulsarSpark {
            0%, 100% { opacity: 0.4; }
            40% { opacity: 1; }
          }
          @keyframes kuroTachyonCycle {
            0% { transform: rotate(0deg) scale(0.92); }
            40% { transform: rotate(90deg) scale(1.02); }
            70% { transform: rotate(450deg) scale(1.12); }
            100% { transform: rotate(720deg) scale(0.92); }
          }
          @keyframes kuroTachyonFlash {
            0%, 100% { opacity: 0.4; }
            70% { opacity: 1; }
          }
        `}</style>
        <g style={{ transformOrigin: '50% 50%' }}>
          {PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={fill}
              style={{
                transformOrigin: '50% 50%',
                animation: nodeAnimation,
                animationDelay: nodeAnimation
                  ? `${(i * 125) % (parseFloat(nodeDuration) * 1000)}ms`
                  : undefined,
              }}
            />
          ))}
        </g>
      </svg>
    )
  }
)

KuroAssistantIcon.displayName = 'KuroAssistantIcon'
export default KuroAssistantIcon
