
import React from 'react';
import { Theme } from '../../types';
import { RAW_COLOR_VALUES } from '../../constants';

interface FuturisticBackgroundProps {
  theme: Theme;
  reduceMotion: boolean;
}

const FuturisticBackground: React.FC<FuturisticBackgroundProps> = ({ theme, reduceMotion }) => {
  const bgAccent1 = RAW_COLOR_VALUES[theme.accent1] || '#00D4FF';
  const bgAccent2 = RAW_COLOR_VALUES[theme.accent2] || '#8B5CF6';
  const bgAccent3 = RAW_COLOR_VALUES[theme.accent3] || '#00FF88';
  const bgAccent4 = RAW_COLOR_VALUES[theme.accent4] || '#FF6B35';
  const darkBgColor = RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E';

  return (
    <>
      <div 
        className="absolute inset-0 z-0 overflow-hidden" // Changed from futuristic-background to direct styling here
        style={{ backgroundColor: darkBgColor }}
      >
        {!reduceMotion && (
          <>
            {/* Solar System Elements */}
            <div className="sun"></div>
            {/* Existing 3 Planets */}
            <div className="planet-orbit" style={{'--orbit-duration': '30s', '--planet-size': '10px', '--orbit-radius-x': '200px', '--orbit-radius-y': '100px', '--initial-angle': '0deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': bgAccent1} as React.CSSProperties}></div>
            </div>
            <div className="planet-orbit" style={{'--orbit-duration': '45s', '--planet-size': '15px', '--orbit-radius-x': '300px', '--orbit-radius-y': '150px', '--initial-angle': '90deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': bgAccent2} as React.CSSProperties}></div>
            </div>
            <div className="planet-orbit" style={{'--orbit-duration': '60s', '--planet-size': '12px', '--orbit-radius-x': '400px', '--orbit-radius-y': '200px', '--initial-angle': '180deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': bgAccent3} as React.CSSProperties}></div>
            </div>

            {/* 6 New Planets */}
            <div className="planet-orbit" style={{'--orbit-duration': '70s', '--planet-size': '8px', '--orbit-radius-x': '250px', '--orbit-radius-y': '120px', '--initial-angle': '30deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': bgAccent4} as React.CSSProperties}></div>
            </div>
            <div className="planet-orbit" style={{'--orbit-duration': '85s', '--planet-size': '18px', '--orbit-radius-x': '350px', '--orbit-radius-y': '170px', '--initial-angle': '120deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': RAW_COLOR_VALUES['pink-500'] || '#ec4899'} as React.CSSProperties}></div>
            </div>
            <div className="planet-orbit" style={{'--orbit-duration': '50s', '--planet-size': '6px', '--orbit-radius-x': '150px', '--orbit-radius-y': '80px', '--initial-angle': '210deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': RAW_COLOR_VALUES['cyan-400'] || '#22d3ee'} as React.CSSProperties}></div>
            </div>
            <div className="planet-orbit" style={{'--orbit-duration': '100s', '--planet-size': '14px', '--orbit-radius-x': '450px', '--orbit-radius-y': '220px', '--initial-angle': '60deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': RAW_COLOR_VALUES['amber-500'] || '#f59e0b'} as React.CSSProperties}></div>
            </div>
            <div className="planet-orbit" style={{'--orbit-duration': '40s', '--planet-size': '5px', '--orbit-radius-x': '120px', '--orbit-radius-y': '60px', '--initial-angle': '270deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': RAW_COLOR_VALUES['lime-500'] || '#84cc16'} as React.CSSProperties}></div>
            </div>
            <div className="planet-orbit" style={{'--orbit-duration': '75s', '--planet-size': '16px', '--orbit-radius-x': '380px', '--orbit-radius-y': '190px', '--initial-angle': '150deg', '--z-index': '1' } as React.CSSProperties}>
              <div className="planet" style={{'--planet-color': RAW_COLOR_VALUES['violet-500'] || '#8b5cf6'} as React.CSSProperties}></div>
            </div>
            
            <div className="stars-layer"></div>
            <div className="twinkling-stars-layer"></div>
            <div className="aurora-layer">
                <div className="aurora-shape aurora-shape-1" style={{ '--aurora-color-1': `${bgAccent1}33`, '--aurora-color-2': `${bgAccent2}22` } as React.CSSProperties}></div>
                <div className="aurora-shape aurora-shape-2" style={{ '--aurora-color-1': `${bgAccent3}22`, '--aurora-color-2': `${bgAccent4}11` } as React.CSSProperties}></div>
                <div className="aurora-shape aurora-shape-3" style={{ '--aurora-color-1': `${bgAccent2}1A`, '--aurora-color-2': `${bgAccent3}0D` } as React.CSSProperties}></div>
            </div>
            <div className="grid-overlay"></div>
          </>
        )}
        <div 
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, ${darkBgColor}00 0%, ${darkBgColor}FF 70%)`
          }}
        />
      </div>
      <style>{`
        ${!reduceMotion ? `
        .sun {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100px; /* Sun size */
          height: 100px;
          background: radial-gradient(ellipse at center, ${bgAccent4} 0%, ${bgAccent4}AA 40%, ${bgAccent4}55 70%, transparent 100%);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 30px ${bgAccent4}, 0 0 60px ${bgAccent4};
          animation: pulseSun 5s infinite alternate ease-in-out;
          z-index: 0; /* Behind planets */
        }
        @keyframes pulseSun {
          0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 30px ${bgAccent4}, 0 0 60px ${bgAccent4}; }
          100% { transform: translate(-50%, -50%) scale(1.1); box-shadow: 0 0 40px ${bgAccent4}, 0 0 80px ${bgAccent4}AA; }
        }
        .planet-orbit {
          position: absolute;
          top: 50%;
          left: 50%;
          width: calc(var(--orbit-radius-x) * 2); /* Diameter X */
          height: calc(var(--orbit-radius-y) * 2); /* Diameter Y */
          border-radius: 50%;
          animation: orbit var(--orbit-duration) linear infinite;
          transform-origin: center center; 
          transform: translate(-50%, -50%) rotate(var(--initial-angle)); 
          z-index: var(--z-index);
        }
        .planet {
          position: absolute;
          top: calc(50% - (var(--planet-size) / 2) + (var(--orbit-radius-y) * cos(0deg)) ); /* Start at one edge of Y ellipse */
          left: calc(50% - (var(--planet-size) / 2) + (var(--orbit-radius-x) * sin(0deg)) ); /* Start at one edge of X ellipse */
          width: var(--planet-size);
          height: var(--planet-size);
          background-color: var(--planet-color);
          border-radius: 50%;
          /* The animation on .planet-orbit handles the rotation. This just places the planet on the path */
          /* We need to ensure the planet itself doesn't counter-rotate, if orbit applies to planet directly */
          transform-origin: calc(-1 * var(--orbit-radius-x)) calc(-1 * var(--orbit-radius-y)); /* This might need adjustment based on how orbit animation works */
          box-shadow: 0 0 10px var(--planet-color), 0 0 5px var(--planet-color);
        }

        @keyframes orbit { /* This keyframe is applied to .planet-orbit */
          0% { transform: translate(-50%, -50%) rotate(var(--initial-angle)); }
          100% { transform: translate(-50%, -50%) rotate(calc(var(--initial-angle) + 360deg)); }
        }


        .stars-layer {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;
          background-image: 
            radial-gradient(1px 1px at 20px 30px, #eee, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 40px 70px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 50px 160px, #ddd, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 160px 120px, #ddd, rgba(0,0,0,0));
          background-repeat: repeat; background-size: 200px 200px;
          animation: zoomStars 20s infinite alternate ease-in-out; opacity: 0.7; z-index: -2;
        }
        @keyframes zoomStars { 0% { transform: scale(1); } 100% { transform: scale(1.2); } }
        .twinkling-stars-layer {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;
          background: transparent url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="10" cy="10" r="0.5" fill="%23fff"/><circle cx="30" cy="40" r="0.3" fill="%23eee"/><circle cx="70" cy="20" r="0.4" fill="%23fff"/><circle cx="50" cy="80" r="0.2" fill="%23ddd"/><circle cx="90" cy="60" r="0.3" fill="%23eee"/></svg>') repeat;
          background-size: 100px 100px; animation: twinkle 5s infinite linear; opacity: 0.5; z-index: -2;
        }
        @keyframes twinkle { 0% { opacity: 0.3; } 50% { opacity: 0.7; } 100% { opacity: 0.3; } }
        .aurora-layer {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;
          overflow: hidden; mix-blend-mode: screen; z-index: -1;
        }
        .aurora-shape { position: absolute; border-radius: 50%; filter: blur(50px); opacity: 0.4; }
        .aurora-shape-1 {
          width: 60%; height: 60%; top: -20%; left: -20%;
          background: radial-gradient(circle, var(--aurora-color-1) 0%, var(--aurora-color-2) 70%, transparent 100%);
          animation: moveAurora1 25s infinite alternate ease-in-out;
        }
        .aurora-shape-2 {
          width: 50%; height: 50%; top: 30%; right: -15%;
          background: radial-gradient(circle, var(--aurora-color-1) 0%, var(--aurora-color-2) 70%, transparent 100%);
          animation: moveAurora2 30s infinite alternate ease-in-out;
        }
        .aurora-shape-3 {
          width: 40%; height: 40%; bottom: -10%; left: 20%;
          background: radial-gradient(circle, var(--aurora-color-1) 0%, var(--aurora-color-2) 70%, transparent 100%);
          animation: moveAurora3 20s infinite alternate ease-in-out;
        }
        @keyframes moveAurora1 { 0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.3; } 100% { transform: translate(20px, 30px) rotate(20deg) scale(1.3); opacity: 0.5; } }
        @keyframes moveAurora2 { 0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.4; } 100% { transform: translate(-25px, -15px) rotate(-15deg) scale(1.2); opacity: 0.6; } }
        @keyframes moveAurora3 { 0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.2; } 100% { transform: translate(10px, -20px) rotate(10deg) scale(1.1); opacity: 0.4; } }
        .grid-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;
          background-image:
            linear-gradient(to right, ${RAW_COLOR_VALUES[theme.accent1]}11 1px, transparent 1px),
            linear-gradient(to bottom, ${RAW_COLOR_VALUES[theme.accent1]}11 1px, transparent 1px);
          background-size: 50px 50px; animation: panGrid 30s linear infinite; opacity: 0.3; z-index: -1;
        }
        @keyframes panGrid { 0% { background-position: 0 0; } 100% { background-position: 100px 100px; } }
        ` : `
        .sun, .planet-orbit, .planet, .stars-layer, .twinkling-stars-layer, .aurora-layer, .grid-overlay { animation: none !important; }
        .futuristic-background .sun { /* Static sun for reduced motion */
          position: absolute; top: 50%; left: 50%; width: 80px; height: 80px;
          background: radial-gradient(ellipse at center, ${bgAccent4} 0%, ${bgAccent4}AA 40%, transparent 70%);
          border-radius: 50%; transform: translate(-50%, -50%);
          box-shadow: 0 0 20px ${bgAccent4}; z-index:0;
        }
        .futuristic-background .planet-orbit { display: none; } /* Hide orbits to prevent static planets */
        .futuristic-background .grid-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;
          background-image:
            linear-gradient(to right, ${RAW_COLOR_VALUES[theme.accent1]}0A 1px, transparent 1px),
            linear-gradient(to bottom, ${RAW_COLOR_VALUES[theme.accent1]}0A 1px, transparent 1px);
          background-size: 50px 50px; opacity: 0.2; z-index: -1;
        }
        `}
      `}</style>
    </>
  );
};

export default FuturisticBackground;
