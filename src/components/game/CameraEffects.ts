// CameraEffects.ts - Utility for cinematic camera effects

export class CameraEffects {
  private container: HTMLElement | null = null;
  private originalTransform = '';
  private isShaking = false;
  private isFrozen = false;
  private shakeTimeout: NodeJS.Timeout | null = null;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.originalTransform = container.style.transform || '';
  }
  
  // Screen shake effect for impacts
  shake(intensity: number = 1) {
    if (this.isShaking || !this.container) return;
    
    this.isShaking = true;
    const shakeIntensity = Math.min(intensity, 1) * 8; // Increased max intensity
    
    const startTime = Date.now();
    const duration = 300; // ms
    
    const shake = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 1 && !this.isFrozen) {
        // Exponential decay for natural feel
        const decay = Math.exp(-progress * 5);
        const offsetX = (Math.random() - 0.5) * shakeIntensity * decay;
        const offsetY = (Math.random() - 0.5) * shakeIntensity * decay;
        const rotation = (Math.random() - 0.5) * shakeIntensity * 0.2 * decay;
        
        this.container!.style.transform = `${this.originalTransform} translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;
        
        requestAnimationFrame(shake);
      } else {
        if (!this.isFrozen) {
          this.container!.style.transform = this.originalTransform;
        }
        this.isShaking = false;
      }
    };
    
    shake();
  }
  
  // Slow motion effect
  slowMotion(duration: number = 500) {
    if (!this.container) return;
    
    this.container.classList.add('slow-motion');
    
    setTimeout(() => {
      this.container!.classList.remove('slow-motion');
    }, duration);
  }
  
  // Zoom pulse for dramatic moments
  zoomPulse(scale: number = 1.1, duration: number = 300) {
    if (!this.container) return;
    
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth zoom curve (ease in/out)
      const zoomProgress = 1 - Math.pow(Math.sin(progress * Math.PI), 2) * (1 - scale);
      
      this.container!.style.transform = `${this.originalTransform} scale(${zoomProgress})`;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.container!.style.transform = this.originalTransform;
      }
    };
    
    animate();
  }
  
  // Dramatic final moment freeze
  timeFreeze(duration: number = 150) {
    if (!this.container) return;
    
    this.isFrozen = true;
    this.container.classList.add('time-frozen');
    
    setTimeout(() => {
      this.isFrozen = false;
      this.container!.classList.remove('time-frozen');
    }, duration);
  }
  
  // Create shockwave effect
  createShockwave(x: number, y: number) {
    if (!this.container) return;
    
    const shockwave = document.createElement('div');
    shockwave.className = 'shockwave';
    shockwave.style.left = `${x - 2}px`; // Center on point
    shockwave.style.top = `${y - 2}px`;
    
    this.container.appendChild(shockwave);
    
    // Remove after animation completes
    setTimeout(() => {
      if (shockwave.parentNode) {
        shockwave.parentNode.removeChild(shockwave);
      }
    }, 1000);
  }
  
  // Arena glow effect that intensifies as flags are eliminated
  updateArenaGlow(remainingFlags: number, totalFlags: number) {
    if (!this.container) return;
    
    const eliminationProgress = 1 - (remainingFlags / totalFlags);
    const glowIntensity = Math.min(eliminationProgress * 2, 1); // Cap at 2x intensity
    
    // Update CSS custom properties for dynamic glow
    this.container.style.setProperty('--arena-glow-strength', (20 + glowIntensity * 30).toString());
    this.container.style.setProperty('--arena-glow-color', `rgba(59, 130, 246, ${0.3 + glowIntensity * 0.4})`);
    this.container.style.setProperty('--arena-inner-glow-strength', (10 + glowIntensity * 20).toString());
    this.container.style.setProperty('--arena-inner-glow-color', `rgba(59, 130, 246, ${0.1 + glowIntensity * 0.2})`);
  }
  
  // Tilt effect for 3D camera feel
  tilt(options: { x?: number; y?: number; duration?: number } = {}) {
    if (!this.container) return;
    
    const { x = 0, y = 0, duration = 300 } = options;
    
    // Apply tilt transformation
    this.container.style.transform = `${this.originalTransform} rotateX(${y}deg) rotateY(${x}deg)`;
    
    // Reset to original after duration
    setTimeout(() => {
      if (this.container && !this.isFrozen) {
        this.container.style.transform = this.originalTransform;
      }
    }, duration);
  }
  
  // Cleanup
  destroy() {
    if (this.shakeTimeout) {
      clearTimeout(this.shakeTimeout);
    }
    if (this.container) {
      this.container.style.transform = this.originalTransform;
      this.container.classList.remove('slow-motion', 'time-frozen');
      // Reset custom properties
      this.container.style.removeProperty('--arena-glow-strength');
      this.container.style.removeProperty('--arena-glow-color');
      this.container.style.removeProperty('--arena-inner-glow-strength');
      this.container.style.removeProperty('--arena-inner-glow-color');
    }
  }
}
