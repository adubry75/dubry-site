// AudioWorklet host for the music engine: the same engine tools/render-audio.mjs uses offline.
import { Engine } from './engine.js';

class LofiRadio extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.engine = new Engine({ sampleRate, seed: o.seed >>> 0, mode: o.mode || 'lofi' });
    if (o.weather) { this.engine.setWeather(o.weather); Object.assign(this.engine.weather, o.weather); }
    this.engine.onInfo = (info) => this.port.postMessage({ type: 'info', info });
    this.engine.onFlash = (delay) => this.port.postMessage({ type: 'flash', delay });
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'mode') this.engine.setMode(m.mode);
      else if (m.type === 'weather') this.engine.setWeather(m.weather);
      else if (m.type === 'purr') this.engine.purr();
    };
    this.L = new Float32Array(128); this.R = new Float32Array(128);
  }
  process(inputs, outputs) {
    const out = outputs[0], n = out[0].length;
    if (this.L.length < n) { this.L = new Float32Array(n); this.R = new Float32Array(n); }
    this.engine.process(this.L, this.R, n);
    out[0].set(this.L.subarray(0, n));
    if (out[1]) out[1].set(this.R.subarray(0, n));
    return true;
  }
}
registerProcessor('lofi-radio', LofiRadio);
