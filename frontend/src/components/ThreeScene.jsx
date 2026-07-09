import React, { useEffect, useRef } from 'react';
import * as THREE from 'three'; // Ensure you have three installed: npm install three

export default function ThreeScene({ initFunction }) {
  const mountRef = useRef(null);

  useEffect(() => {
    // Call your specific Three.js setup from your HTML/JS
    const cleanup = initFunction(mountRef.current);
    return () => {
      if (cleanup) cleanup();
    };
  }, [initFunction]);

  return <div ref={mountRef} className="glass-panel" style={{ padding: 0, height: '400px', overflow: 'hidden' }} />;
}
