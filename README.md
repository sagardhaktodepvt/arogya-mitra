# Arogya Mitra 2.0

Educational, rule-based symptom guidance in plain HTML, CSS and JavaScript. No backend, no paid API, no external AI. It is **not** a diagnosis tool.

## Features
- Chatbot-style assessment with typing indicator, quick replies, summary, edit and restart
- 22 symptoms; follow-ups (duration, temperature, trend, breathing severity) asked one at a time and only when relevant
- Rule engine with forward chaining, backward chaining, rule IDs, explanations, specialist categories and reasoning trace
- Emergency safety layer that runs first and cannot be disabled by rules
- English, मराठी, हिंदी interface options; symptom names, assessment questions, answer choices, rule explanations, emergency guidance and recommendations are always shown in English + मराठी; dark/light mode; sticky nav; responsive layout
- Optional voice input (browser speech recognition, text fallback, you confirm every suggested symptom)
- Local history (localStorage), delete, clear all, JSON export; print / save as PDF report
- "How it works" section with flow diagram

## Files
- `index.html` structure
- `style.css` styling, dark mode, print styles
- `engine.js` facts, rules, safety checks, forward and backward chaining (no DOM code)
- `i18n.js` English / Marathi / Hindi dictionary (UI, symptoms, rules)
- `script.js` chat flow, results, history, voice, theme

## Run
Open `index.html` in a modern browser. For Vercel: upload all files to the repository root, framework preset **Other**, no build command.

## Forward chaining
Starts from known facts. Any enabled rule whose required facts are all present fires, its conclusion is added to working memory, and the loop repeats until no new rule can fire. Example: fever + 4+ days fires D01 (adds `prolongedFever`), which then fires R09.

## Backward chaining
Starts from a goal (a pattern such as `P_R01`). It finds rules that conclude the goal and tries to prove each required fact: already known, derivable by another rule, or missing. Missing facts are reported.

## Add an educational rule
Add an object to `RULES` in `engine.js`, then add its text to all three languages in `i18n.js` as `r_<ID>_t` and `r_<ID>_e`:

```js
{ id: "R11", kind: "pattern", req: ["dizziness", "fatigue"], opt: ["nausea"], caution: [], concl: "P_R11", spec: ["GP"], enabled: true }
```
Emergency rules live in the separate `SAFETY` list and are not editable from the UI.

## Known limitations
- Rules are simple, medically unvalidated demos; matched-rule counts are not probabilities.
- Changing language restarts the conversation.
- Voice recognition depends on the browser (often needs Chrome/Edge and an internet connection).
- History is browser-local, not secure, not synced.
- The admin / rule-management screen is not built yet.

## Medical safety disclaimer
This tool is for education. It does not diagnose, prescribe or replace a qualified healthcare professional. For severe breathing difficulty, chest pain, confusion, or fever with stiff neck, contact local emergency services (India: 112) immediately.


## Bilingual questions and recommendations
Assessment questions, answer choices, symptom labels, rule explanations, specialist recommendations, emergency messages, next steps, warnings and medical disclaimer are displayed in English + Marathi together. The language selector still controls the rest of the interface (English, Marathi or Hindi).
