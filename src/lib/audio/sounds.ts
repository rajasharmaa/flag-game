// Audio context for game sounds
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

export const playCollisionSound = (intensity: number = 0.5) => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(80 + intensity * 100, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3 * intensity, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.log('Audio not available');
  }
};

export const playEliminationSound = () => {
  try {
    const ctx = getAudioContext();
    
    // Whoosh sound
    const noise = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    noise.frequency.setValueAtTime(800, ctx.currentTime);
    noise.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    noise.type = 'sawtooth';
    
    noiseGain.gain.setValueAtTime(0.2, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.3);

    // Bass hit
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    
    bass.frequency.setValueAtTime(60, ctx.currentTime + 0.05);
    bass.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);
    bass.type = 'sine';
    
    bassGain.gain.setValueAtTime(0.4, ctx.currentTime + 0.05);
    bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    bass.start(ctx.currentTime + 0.05);
    bass.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.log('Audio not available');
  }
};

export const playNearMissSound = () => {
  try {
    const ctx = getAudioContext();
    
    // Heartbeat-like thump
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(50, ctx.currentTime + i * 0.2);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15);
      
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.15);
    }
  } catch (e) {
    console.log('Audio not available');
  }
};



export const playVictorySound = () => {
  try {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 fanfare
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const startTime = ctx.currentTime + idx * 0.15;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.type = 'triangle';

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  } catch (e) {
    console.log('Audio not available');
  }
};

export const initAudio = () => {
  try {
    getAudioContext();
  } catch (e) {
    console.log('Audio initialization failed');
  }
};

