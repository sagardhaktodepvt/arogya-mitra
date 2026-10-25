(function (g) {
  "use strict";
  const SYMPTOMS = ["fever","cough","runnyNose","sneezing","headache","bodyPain","fatigue","soreThroat","itchyEyes","chills","sweating","nausea","vomiting","diarrhea","abdominalPain","skinRash","burningUrination","dizziness","breathingDifficulty","stiffNeck","confusion","chestPain"];

  // Emergency rules: fixed in code, never part of the editable rule base, always evaluated first.
  const SAFETY = [
    { id: "E01", all: ["breathingSevere"], msg: "emerg.breath" },
    { id: "E02", all: ["confusion"], msg: "emerg.conf" },
    { id: "E03", all: ["fever", "stiffNeck"], msg: "emerg.neck" },
    { id: "E04", all: ["chestPain"], msg: "emerg.chest" }
  ];

  // Modular rule base. kind "derive" makes intermediate facts; kind "pattern" makes P_<id> conclusions.
  const RULES = [
    { id: "D01", kind: "derive", req: ["fever", "longDuration"], concl: "prolongedFever", enabled: true },
    { id: "R01", kind: "pattern", req: ["fever", "cough", "bodyPain"], opt: ["headache", "fatigue", "chills", "soreThroat"], caution: [], concl: "P_R01", spec: ["GP"], enabled: true },
    { id: "R02", kind: "pattern", req: ["runnyNose", "sneezing"], opt: ["cough", "soreThroat", "headache"], caution: ["fever"], concl: "P_R02", spec: ["ENT", "GP"], enabled: true },
    { id: "R03", kind: "pattern", req: ["sneezing", "runnyNose", "itchyEyes"], opt: ["cough"], caution: ["fever"], concl: "P_R03", spec: ["ENT", "Ophth"], enabled: true },
    { id: "R04", kind: "pattern", req: ["burningUrination"], opt: ["fever", "abdominalPain", "chills"], caution: ["vomiting"], concl: "P_R04", spec: ["Uro", "GP"], enabled: true },
    { id: "R05", kind: "pattern", req: ["vomiting", "diarrhea"], opt: ["nausea", "abdominalPain", "fever", "dizziness"], caution: [], concl: "P_R05", spec: ["Gastro", "GP"], enabled: true },
    { id: "R06", kind: "pattern", req: ["fever", "chills", "sweating"], opt: ["headache", "bodyPain", "fatigue"], caution: [], concl: "P_R06", spec: ["GP"], enabled: true },
    { id: "R07", kind: "pattern", req: ["fever", "skinRash"], opt: ["headache", "bodyPain"], caution: [], concl: "P_R07", spec: ["Derm", "GP"], enabled: true },
    { id: "R08", kind: "pattern", req: ["soreThroat", "fever"], opt: ["cough", "headache", "fatigue"], caution: [], concl: "P_R08", spec: ["ENT", "GP"], enabled: true },
    { id: "R09", kind: "pattern", req: ["prolongedFever"], opt: ["chills", "sweating", "fatigue", "bodyPain"], caution: [], concl: "P_R09", spec: ["GP"], enabled: true },
    { id: "R10", kind: "pattern", req: ["cough", "breathingDifficulty"], opt: ["fever", "fatigue"], caution: [], concl: "P_R10", spec: ["Pulm", "GP"], enabled: true }
  ];

  const cloneRules = () => JSON.parse(JSON.stringify(RULES));

  function buildFacts(sym, ans) {
    const f = new Set(sym);
    ans = ans || {};
    if (f.has("fever") && ans.duration === "4plus") f.add("longDuration");
    if (f.has("fever") && ans.temp === "above39") f.add("highFever");
    if (ans.trend === "worse") f.add("worsening");
    if (f.has("breathingDifficulty") && ans.breath === "severe") f.add("breathingSevere");
    return f;
  }

  const safety = facts => SAFETY.filter(r => r.all.every(x => facts.has(x)));

  // Forward chaining: data-driven. Start from known facts, fire every rule whose conditions hold,
  // add its conclusion to working memory, and repeat until nothing new can be derived.
  function forward(facts, rules) {
    const wm = new Set(facts), done = new Set(), fired = [], history = [];
    let step = 0, changed = true;
    while (changed) {
      changed = false;
      for (const r of rules) {
        if (!r.enabled || done.has(r.id)) continue;
        if (r.req.every(x => wm.has(x))) {
          done.add(r.id); wm.add(r.concl); fired.push(r);
          history.push({ step: ++step, rule: r, matched: r.req.slice() });
          changed = true;
        }
      }
    }
    return { wm, fired, history };
  }

  // Backward chaining: goal-driven. Start from a goal, find rules that conclude it,
  // and recursively try to prove each required fact (known fact, derivable, or missing).
  function backward(goal, facts, rules) {
    const wm = new Set(facts), trace = [], stack = new Set(), missing = new Set();
    function prove(gl, d) {
      if (wm.has(gl)) { trace.push({ d, goal: gl, s: "known" }); return true; }
      if (stack.has(gl)) { trace.push({ d, goal: gl, s: "cycle" }); return false; }
      const cands = rules.filter(r => r.enabled && r.concl === gl);
      if (!cands.length) { trace.push({ d, goal: gl, s: "missing" }); missing.add(gl); return false; }
      stack.add(gl);
      let ok = false;
      for (const r of cands) {
        trace.push({ d, goal: gl, s: "try", rule: r });
        const res = r.req.map(x => prove(x, d + 1));
        if (res.every(Boolean)) { trace.push({ d, goal: gl, s: "proved", rule: r }); wm.add(gl); ok = true; break; }
        trace.push({ d, goal: gl, s: "failed", rule: r });
      }
      stack.delete(gl);
      return ok;
    }
    const ok = prove(goal, 0);
    return { ok, trace, missing: [...missing], rule: rules.find(r => r.concl === goal) };
  }

  const api = { SYMPTOMS, SAFETY, RULES, cloneRules, buildFacts, safety, forward, backward };
  g.Engine = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
