const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Shapes = require("./el-systema-shapes.js");

const nineVoices = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "liturgy.nine-voices.json"), "utf8")
);

assert.ok(Shapes.isReservedTarget("MUSUBI"), "MUSUBI should be a reserved target");
assert.ok(Shapes.isReservedTarget("nagare"), "nagare should be a reserved target alias");
assert.ok(!Shapes.isReservedTarget("stone-beats"), "instrument ids are not reserved targets");

assert.ok(Shapes.isLiturgy(nineVoices), "nine voices liturgy should validate with MUSUBI targets");

const aliasLiturgy = {
  track: "alias",
  duration: 1,
  音楽: {
    key: "F",
    mode: "琉球",
    bpm: 84,
    register: 0,
    転調策: []
  },
  楽器: ["stone-beats"],
  祭次: [
    { 時: 0, 揺: 0, target: "nagare", command: "setParam", param: "境地", value: "流" }
  ],
  応答: [
    {
      名: "alias response",
      時: { 信号: "presence:stone-beats", 演算: ">", 値: 0.1 },
      為: { target: "MUSUBI", command: "setParam", param: "seed", value: 0.42 }
    }
  ]
};
assert.ok(Shapes.isLiturgy(aliasLiturgy), "reserved targets should validate in sequence and response actions");
assert.ok(Shapes.isMusicKey("F#"), "note-name music keys should validate");
assert.ok(Shapes.isMusicKey(7), "numeric music keys should validate");
assert.ok(
  Shapes.isLiturgy({
    ...aliasLiturgy,
    音楽: {
      ...aliasLiturgy.音楽,
      転調策: [{ 時: 8, key: "A", mode: "陰旋", bpm: 72, register: -1, policy: "voice-led", duration: 12 }]
    }
  }),
  "valid modulation policy entries should validate"
);

const broken = JSON.parse(JSON.stringify(aliasLiturgy));
broken.祭次[0].target = "ghost";
const errs = Shapes.explainLiturgy(broken);
assert.ok(errs.some((line) => line.indexOf("予約 target") >= 0), "invalid target should mention reserved targets in error");

const brokenMusic = JSON.parse(JSON.stringify(aliasLiturgy));
brokenMusic.音楽.mode = "unknown";
const musicErrs = Shapes.explainLiturgy(brokenMusic);
assert.ok(musicErrs.some((line) => line.indexOf("音楽.mode") >= 0), "invalid music.mode should be rejected");

const brokenPolicy = JSON.parse(JSON.stringify(aliasLiturgy));
brokenPolicy.音楽.転調策 = [{ 時: 4, policy: "sideways" }];
const policyErrs = Shapes.explainLiturgy(brokenPolicy);
assert.ok(
  policyErrs.some((line) => line.indexOf("音楽.転調策[0].policy") >= 0),
  "invalid modulation policy should be rejected"
);

console.log("shapes ok");
