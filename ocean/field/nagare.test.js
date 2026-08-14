const assert = require("assert");
const NAGARE = require("./nagare.js");

function collect(seed, mode, active, configPatch) {
  const relays = [];
  NAGARE.stop();
  NAGARE.config.依代別 = Object.assign({}, NAGARE.config.依代別, configPatch || {});
  NAGARE.attachRuntime({
    sendRelay(target, cmd, extra) {
      relays.push({ target, cmd, extra });
    },
    pushKotodama() {},
    getActiveInstruments() {
      return active.slice();
    }
  });
  NAGARE.setMode(mode);
  NAGARE.start(seed);
  NAGARE.stop();
  return relays;
}

const flowRelays = collect(0.5, "流", ["stone-beats", "ocean"]);
assert.ok(flowRelays.some((r) => r.target === "stone-beats" && /^voice\./.test(r.extra.name)), "flow should drive stone voice volume");
assert.ok(flowRelays.some((r) => r.target === "ocean" && r.extra.name === "root"), "flow should modulate ocean root");

const orderRelays = collect(0.5, "整", ["stone-beats"]);
const binaryVolumes = orderRelays
  .filter((r) => r.target === "stone-beats" && /volume$/.test(r.extra.name))
  .map((r) => r.extra.value);
assert.ok(binaryVolumes.length > 0, "order should produce stone volume relays");
assert.ok(binaryVolumes.every((v) => v === 0 || v === 18 || v === 100), "order volumes should be binary or floor-held");

const noOceanRelays = collect(0.5, "流", ["stone-beats", "ocean"], {
  "ocean": { 抜き差し: false, 律動: false, 転調: false }
});
assert.ok(noOceanRelays.every((r) => r.target !== "ocean"), "disabled instrument should not receive relays");

const kagomeRelays = collect(0.5, "流", ["kagome-sound"]);
assert.ok(kagomeRelays.some((r) => r.target === "kagome-sound" && r.extra.name === "tempoSlider"), "kagome should receive rhythm tempo relay");
assert.ok(kagomeRelays.some((r) => r.target === "kagome-sound" && r.extra.name === "scalePreset"), "kagome should receive transposition relay");
assert.ok(kagomeRelays.every((r) => r.extra.name !== "masterVol"), "kagome should not use missing activity window");

const planarianRelays = collect(0.5, "流", ["planarian-drone"]);
assert.ok(planarianRelays.some((r) => r.target === "planarian-drone" && /^layer\.[0-2]\.active$/.test(r.extra.name)), "planarian should toggle layer activity");
assert.ok(planarianRelays.some((r) => r.target === "planarian-drone" && r.extra.name === "targetScale"), "planarian should receive scale relay");

const particleRelays = collect(0.5, "流", ["particle-noise"]);
assert.ok(particleRelays.some((r) => r.target === "particle-noise" && /^Particle\.masterGain$|^Metallic\.masterGain$|^Physical\.masterGain$/.test(r.extra.name)), "particle should target actual engine masterGain params");

const ratioIds = ["mycorrhiza-beat", "stone-beats", "kagome-sound", "moss-reservoir", "particle-noise", "geometry-scanner", "ocean", "planarian-drone", "cell-noise"];
ratioIds.forEach((id) => {
  assert.ok(Object.prototype.hasOwnProperty.call(NAGARE.TEMPO_RATIOS, id), "tempo ratio should exist for " + id);
});

const musicRelays = [];
NAGARE.stop();
NAGARE.config.依代別 = Object.assign({}, NAGARE.config.依代別, {
  "ocean": { 抜き差し: true, 律動: true, 転調: true },
  "geometry-scanner": { 抜き差し: true, 律動: true, 転調: true },
  "planarian-drone": { 抜き差し: true, 律動: true, 転調: true },
  "kagome-sound": { 抜き差し: true, 律動: true, 転調: true },
  "moss-reservoir": { 抜き差し: true, 律動: true, 転調: true },
  "mycorrhiza-beat": { 抜き差し: true, 律動: true, 転調: false },
  "stone-beats": { 抜き差し: true, 律動: true, 転調: false },
  "particle-noise": { 抜き差し: true, 律動: true, 転調: false },
  "cell-noise": { 抜き差し: true, 律動: true, 転調: true }
});
NAGARE.attachRuntime({
  sendRelay(target, cmd, extra) {
    musicRelays.push({ target, cmd, extra });
  },
  pushKotodama() {},
  getActiveInstruments() {
    return ["ocean", "geometry-scanner", "planarian-drone", "kagome-sound", "moss-reservoir", "mycorrhiza-beat", "stone-beats", "particle-noise", "cell-noise"];
  }
});
const musicState = NAGARE.applyMusicState({ key: "F", mode: "平調子", bpm: 120, register: 1 });
assert.strictEqual(musicState.key, 5, "music state should normalize note name to semitone index");
assert.strictEqual(musicState.mode, "平調子", "music state should keep canonical mode");
assert.ok(musicRelays.some((r) => r.target === "ocean" && r.extra.name === "root"), "music key should drive ocean root");
assert.ok(musicRelays.some((r) => r.target === "geometry-scanner" && r.extra.name === "selectedScale" && r.extra.value === "Japanese In"), "music mode should drive geometry scale");
assert.ok(musicRelays.some((r) => r.target === "planarian-drone" && r.extra.name === "targetScale" && r.extra.value === "hirajoshi"), "music mode should drive planarian target scale");
assert.ok(musicRelays.some((r) => r.target === "kagome-sound" && r.extra.name === "tempoSlider" && r.extra.value === 120), "music bpm should drive kagome tempo");
assert.ok(musicRelays.some((r) => r.target === "mycorrhiza-beat" && r.extra.name === "bpm" && r.extra.value === 120), "mycorrhiza should receive master bpm");
assert.ok(musicRelays.some((r) => r.target === "stone-beats" && /bpm$/.test(r.extra.name) && r.extra.value === 120), "stone should receive ratio-scaled bpm");
assert.ok(musicRelays.some((r) => r.target === "moss-reservoir" && r.extra.name === "bpm" && r.extra.value === 60), "moss should receive half-time bpm");
assert.ok(musicRelays.some((r) => r.target === "cell-noise" && r.extra.name === "pulseRate" && r.extra.value === 15), "cell-noise should receive 1/8 pulseRate");
assert.ok(!musicRelays.some((r) => r.target === "planarian-drone" && r.extra.name === "bpm"), "planarian should not receive bpm relays");

assert.deepStrictEqual(NAGARE.pitchClassSet(0, "琉球"), [0, 4, 5, 7, 11], "pitchClassSet should match canonical mode degrees");

const oldMusic = { key: 0, mode: "琉球", bpm: 80, register: 0, 転調策: [] };
const newMusic = { key: 5, mode: "マカーム", bpm: 110, register: 0, 転調策: [] };
const voiceLedPlan = NAGARE.voiceLed(oldMusic, newMusic, 12, ["ocean", "kagome-sound", "planarian-drone", "geometry-scanner"]);
assert.deepStrictEqual(voiceLedPlan.map((step) => step.atSec), [0, 4, 8], "voice-led should produce A/B/C stages at thirds of duration");
assert.ok(voiceLedPlan[0].relays.length > 0, "voice-led stage A should attenuate voices");
assert.ok(voiceLedPlan[1].relays.some((r) => r.target === "ocean" && r.name === "scale"), "voice-led stage B should change scale before root");
assert.ok(voiceLedPlan[2].relays.some((r) => r.target === "ocean" && r.cmd === "ramp" && r.name === "root"), "voice-led stage C should ramp ocean root");

const phrasePlan = NAGARE.planMusicTransition({ mode: "マカーム" }, {
  policy: "phrase-aligned",
  durationSec: 4,
  ids: ["geometry-scanner"],
  elapsedSec: 10
});
assert.ok(Math.abs(phrasePlan[0].atSec - 6) < 0.001, "phrase-aligned should wait until the next 8-bar boundary at bpm 120");

console.log("nagare ok");
