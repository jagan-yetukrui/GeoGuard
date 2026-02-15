"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

export function LoadingScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 85) {
          return prev + Math.random() * 30;
        }
        return prev;
      });
    }, 200);

    // Hide after 3 seconds
    const timer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background bg-mesh pointer-events-auto overflow-hidden"
        >
          {/* Floating hearts decoration */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[
              { left: "10%", top: "15%" },
              { left: "85%", top: "20%" },
              { left: "25%", top: "75%" },
              { left: "75%", top: "80%" },
              { left: "50%", top: "10%" },
              { left: "5%", top: "50%" },
              { left: "92%", top: "45%" },
            ].map((pos, i) => (
              <motion.div
                key={i}
                className="absolute text-rose-300/35"
                style={{ left: pos.left, top: pos.top }}
                animate={{ y: [0, -10, 0], opacity: [0.25, 0.5, 0.25] }}
                transition={{ duration: 2.5 + i * 0.2, repeat: Infinity, delay: i * 0.15 }}
              >
                <Heart className="size-5 fill-current" />
              </motion.div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-8 w-80 relative z-10">
            {/* GeoGuard Logo and Title */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <h1 className="text-4xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">Geo</span>
                <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Guard</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-2 font-medium">Real-Time Emergency Response</p>
              <p className="text-rose-400/80 text-xs mt-1">Protecting what you love 💕</p>
            </motion.div>

            {/* Progress Bar */}
            <div className="w-full space-y-3">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary via-rose-500 to-emerald-500"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center font-medium">
                {progress < 100 ? "Loading..." : "Ready 💕"}
              </p>
            </div>

            {/* Animated hearts */}
            <div className="flex gap-3">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.6, 1, 0.6] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                >
                  <Heart className="size-4 fill-rose-500 text-rose-500" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}