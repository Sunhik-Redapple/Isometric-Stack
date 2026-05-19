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
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [showPerfect, setShowPerfect] = useState(false);
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
          setPopulation(s * 144); // ~144 people per floor
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
        (t) => setWeatherTransition(t)
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
              color: weatherTransition > 0.4 ? '#93c5fd' : '#6366f1' // blue-300 vs indigo-500
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
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-8 rotate-12">
                <div className="w-12 h-12 border-4 border-indigo-600 rounded-lg" />
              </div>
              <h1 className="text-4xl font-black text-slate-800 mb-3 tracking-tight">BUILDER</h1>
              <p className="text-slate-500 text-center mb-10 font-medium text-sm leading-relaxed">
                A masterpiece of architecture. <br/>
                Tap to drop and stack the tower!
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); handleInteraction(); }}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-indigo-200"
              >
                <Play fill="currentColor" size={20} />
                START
              </button>
            </div>
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
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-8">
                <RefreshCw size={40} className="animate-spin-slow" />
              </div>
              <h1 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight text-center">Tower Collapsed</h1>
              <div className="flex flex-col items-center mb-10 bg-slate-50 w-full py-6 rounded-2xl">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Total Floors</span>
                <span className="text-6xl font-black text-indigo-600">{score}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleInteraction(); }}
                className="w-full py-5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xl"
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
          className="absolute bottom-12 left-0 right-0 z-10 flex justify-center pointer-events-none"
        >
          <div className={`px-6 py-2 rounded-full transition-colors duration-500 ${weatherTransition > 0.4 ? 'bg-white/10' : 'bg-slate-800/10'} backdrop-blur-sm`}>
            <div className={`text-[10px] font-bold tracking-[0.2em] uppercase transition-colors duration-500 ${weatherTransition > 0.4 ? 'text-slate-200' : 'text-slate-500'}`}>
              Tap anywhere to drop
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
