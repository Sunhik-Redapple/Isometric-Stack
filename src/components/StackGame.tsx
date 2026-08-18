import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameManager } from '../game/GameManager';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCw, Play, Github } from 'lucide-react';

export const StackGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<GameManager | null>(null);
  const [score, setScore] = useState(0);
  const [population, setPopulation] = useState(0);
  const [weatherTransition, setWeatherTransition] = useState(0);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'TOWER_REVEAL'>('START');
  const [showPerfect, setShowPerfect] = useState(false);
  const [showSlip, setShowSlip] = useState(false);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [isExecActive, setIsExecActive] = useState(false);
  const [execTimeLeft, setExecTimeLeft] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('stack-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    if (containerRef.current) {
      const manager = new GameManager(
        containerRef.current,
        (s) => {
          setScore(s);
          if (s === 0) {
            setPopulation(0);
          }
        },
        (s) => {
          setGameState('GAMEOVER');
          if (s > highScore) {
            setHighScore(s);
            localStorage.setItem('stack-high-score', s.toString());
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
        },
        () => {
          setShowPerfect(true);
          setTimeout(() => setShowPerfect(false), 1500);
        },
        (t) => setWeatherTransition(t),
        () => {
          setShowSlip(true);
          setTimeout(() => setShowSlip(false), 1500);
        },
        (streak) => setPerfectStreak(streak),
        (active, durationMs) => {
          setIsExecActive(active);
          setExecTimeLeft(durationMs);
          if (active) {
            confetti({
              particleCount: 85,
              spread: 60,
              origin: { y: 0.75 }
            });
          }
        },
        (remainingMs) => {
          setExecTimeLeft(remainingMs);
        },
        () => {
          setPopulation((prev) => prev + 1);
        },
        () => {
          setGameState('TOWER_REVEAL');
        }
      );
      managerRef.current = manager;
      return () => manager.dispose();
    }
  }, []);

  const handleInteraction = () => {
    if (managerRef.current) {
      managerRef.current.handleInteraction();
      if (gameState === 'START' || gameState === 'GAMEOVER') {
        setGameState('PLAYING');
        setScore(0);
        setPopulation(0);
        setWeatherTransition(0);
        setShowPerfect(false);
        setShowSlip(false);
        setPerfectStreak(0);
        setIsExecActive(false);
        setExecTimeLeft(0);
      }
    }
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-slate-100 flex flex-col font-sans select-none touch-none"
      onClick={handleInteraction}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* HUD */}
      <div className="absolute top-12 left-0 right-0 flex flex-col items-center pointer-events-none z-10">
        <motion.div 
          initial={{ opacity: 1 }}
          animate={{ 
            color: weatherTransition > 0.4 ? '#ffffff' : '#1e293b' 
          }}
          className="text-8xl font-black drop-shadow-md transition-colors duration-500"
        >
          {score}
        </motion.div>
        <div className={`text-xs font-bold tracking-[0.2em] uppercase mt-2 transition-colors duration-500 ${weatherTransition > 0.4 ? 'text-slate-300' : 'text-slate-500'}`}>
          Current Height
        </div>
      </div>

      <div className="absolute top-12 right-6 flex flex-col items-end pointer-events-none z-10">
        <div className={`text-lg font-bold flex items-center gap-1.5 transition-colors duration-500 ${weatherTransition > 0.4 ? 'text-white' : 'text-slate-700'}`}>
          <Trophy size={18} className="text-amber-500" />
          {highScore}
        </div>
        <div className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-500 ${weatherTransition > 0.4 ? 'text-slate-300' : 'text-slate-400'}`}>
          Best
        </div>
        <div className="mt-4 flex flex-col items-end">
          <div className={`text-[10px] font-bold tracking-widest uppercase mb-1 transition-colors duration-500 ${weatherTransition > 0.4 ? 'text-slate-300' : 'text-slate-400'}`}>
            Population
          </div>
          <motion.div 
            initial={{ opacity: 1 }}
            animate={{ 
              color: weatherTransition > 0.4 ? '#FFF2AE' : '#CC4933' // warm yellow vs rust orange-red (palette anchors)
            }}
            className="text-xl font-black leading-tight transition-colors duration-500"
          >
            {population.toLocaleString()}
          </motion.div>
        </div>
      </div>

      {/* Perfect Placement Notification */}
      <AnimatePresence>
        {showPerfect && (
          <motion.div
            id="perfect-placement-text"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <div className="bg-black px-10 py-4 rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 border border-white/10">
              <span className="text-white font-black text-3xl uppercase tracking-[0.2em] whitespace-nowrap">
                Perfect!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slippery Slip Notification */}
      <AnimatePresence>
        {showSlip && (
          <motion.div
            id="slippery-slip-text"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <div className="bg-slate-900 px-10 py-4 rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 border border-sky-500/30">
              <span className="text-sky-400 font-black text-3xl uppercase tracking-[0.2em] whitespace-nowrap">
                Slipped!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay Screens */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-md z-20 pointer-events-none px-6"
          >
            <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-100 pointer-events-auto w-full max-w-sm">
              <div className="w-20 h-20 bg-[#fffbeb] text-[#CC4933] rounded-3xl flex items-center justify-center mb-8 rotate-12 border border-[#FDCF70]">
                {/* Visual of autumn leaf using elegant overlapping geometry */}
                <span className="text-4xl">🍁</span>
              </div>
              <h1 className="text-4xl font-black text-[#750704] mb-3 tracking-tight">HARVEST TOWER</h1>
              <p className="text-slate-500 text-center mb-10 font-medium text-sm leading-relaxed">
                Cozy, colorful autumn architecture. <br/>
                Tap to drop and stack your tower!
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); handleInteraction(); }}
                className="w-full py-5 bg-[#CC4933] hover:bg-[#750704] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-[#CC4933]/20"
              >
                <Play fill="currentColor" size={20} />
                START
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'TOWER_REVEAL' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-end pb-16 bg-black/10 pointer-events-none z-20"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="pointer-events-auto flex flex-col items-center gap-2"
            >
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="bg-slate-900/95 text-white border border-white/25 backdrop-blur-md px-8 py-4 rounded-full shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                onClick={(e) => { e.stopPropagation(); handleInteraction(); }}
              >
                <span className="text-xs font-black tracking-[0.3em] uppercase pl-1">
                  TAP TO CONTINUE
                </span>
              </motion.div>
              <span className="text-[10px] text-slate-100/90 font-bold tracking-widest uppercase drop-shadow-md">
                Viewing Complete Tower ({score} Floors)
              </span>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-lg z-20 pointer-events-none px-6"
          >
            <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-100 pointer-events-auto w-full max-w-sm">
              <div className="w-20 h-20 bg-[#fffbeb] text-[#CC4933] rounded-3xl flex items-center justify-center mb-8">
                <RefreshCw size={40} className="animate-spin-slow text-[#CC4933]" />
              </div>
              <h1 className="text-3xl font-black text-[#750704] mb-2 uppercase tracking-tight text-center">Tower Collapsed</h1>
              <div className="flex flex-col items-center mb-10 bg-[#fff9e6] w-full py-6 rounded-2xl border border-[#FDCF70]/30">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Total Floors</span>
                <span className="text-6xl font-black text-[#CC4933]">{score}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleInteraction(); }}
                className="w-full py-5 bg-[#CC4933] hover:bg-[#750704] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xl"
              >
                REBUILD
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions / Footer */}
      {score === 0 && gameState === 'PLAYING' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-24 left-0 right-0 z-10 flex justify-center pointer-events-none"
        >
          <div className={`px-6 py-2 rounded-full transition-colors duration-500 ${weatherTransition > 0.4 ? 'bg-white/10' : 'bg-slate-800/10'} backdrop-blur-sm`}>
            <div className={`text-[10px] font-bold tracking-[0.2em] uppercase transition-colors duration-500 ${weatherTransition > 0.4 ? 'text-slate-200' : 'text-slate-500'}`}>
              Tap anywhere to drop
            </div>
          </div>
        </motion.div>
      )}

      {/* Executive Floor Streak Meter HUD */}
      {gameState === 'PLAYING' && (
        <motion.div
          id="executive-streak-meter"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-64 max-w-sm flex flex-col items-center pointer-events-none font-sans"
        >
          {/* Label with dynamic color based on mode and background brightness */}
          <div className="flex items-center justify-between w-full mb-1.5 px-1 select-none">
            <span className={`text-[10px] font-black tracking-widest uppercase transition-colors duration-300 ${
              isExecActive 
                ? 'text-amber-400 animate-pulse font-extrabold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' 
                : weatherTransition > 0.4 ? 'text-slate-300' : 'text-slate-600'
            }`}>
              {isExecActive ? '👑 Executive Mode' : 'Perfect Streak'}
            </span>
            <span className={`text-[10px] font-mono font-black transition-colors duration-300 ${
              isExecActive 
                ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                : weatherTransition > 0.4 ? 'text-slate-300' : 'text-slate-600'
            }`}>
              {isExecActive ? `${(execTimeLeft / 1000).toFixed(1)}s` : `${perfectStreak}/5`}
            </span>
          </div>

          {/* Bar track */}
          <div className={`w-full h-3.5 rounded-full overflow-hidden p-0.5 backdrop-blur-md transition-all duration-500 ${
            isExecActive 
              ? 'bg-amber-950/45 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-102 font-bold' 
              : 'bg-black/20 border border-white/10'
          }`}>
            {/* Slide container bar */}
            <motion.div 
              className={`h-full rounded-full transition-all duration-75 ${
                isExecActive 
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.9)]' 
                  : 'bg-[#F8A257] shadow-[0_0_5px_rgba(248,162,87,0.5)]'
              }`}
              initial={{ width: '0%' }}
              animate={{ 
                width: isExecActive 
                  ? `${(execTimeLeft / 10000) * 100}%` 
                  : `${(perfectStreak / 5) * 100}%` 
              }}
              transition={{ type: 'tween', ease: isExecActive ? 'linear' : 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
};
