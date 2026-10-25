(function () {
  "use strict";
  const $ = s => document.querySelector(s), E = window.Engine, I = window.I18N;
  const LS = { hist: "am2.history", theme: "am2.theme", lang: "am2.lang" };
  const S = { lang: "en", sym: new Set(), ans: {}, qi: 0, method: "forward", goal: "P_R01", rules: E.cloneRules(), last: null };
  const t = k => (I[S.lang] && I[S.lang][k]) || I.en[k] || k;
  // Questions, symptom names, medical explanations and recommendations are always bilingual.
  // The rest of the interface continues to follow the selected language.
  const bi = k => {
    const en = (I.en && I.en[k]) || k;
    const mr = (I.mr && I.mr[k]) || en;
    return en === mr ? en : en + " / " + mr;
  };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const symLabel = k => bi("s_" + k);
  const factLabel = k => I.en["s_" + k] ? symLabel(k) : bi("f_" + k);
  const ruleTitle = id => bi("r_" + id + "_t");
  const specLabel = k => bi("spec_" + k);
  function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function toast(m) { const n = $("#toast"); n.textContent = m; n.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(() => n.classList.remove("show"), 2200); }

  // ---------- static i18n ----------
  function applyLang() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll("[data-i18n]").forEach(n => { n.textContent = t(n.dataset.i18n); });
    $("#lang").value = S.lang;
    document.title = t("title");
    const fl = $("#flow"); fl.replaceChildren(); t("flow").forEach(x => fl.append(el("li", "", x)));
    const lb = $("#learn-body"); lb.replaceChildren();
    t("learn").forEach(([h, p]) => { lb.append(el("h3", "", h), el("p", "", p)); });
    renderHistory(); setStep(S.step || 1);
  }
  function setStep(n) {
    S.step = n; const p = $("#progress"); p.replaceChildren();
    t("steps").forEach((s, i) => { const li = el("li", i + 1 < n ? "done" : i + 1 === n ? "now" : "", (i + 1) + ". " + s); if (i + 1 === n) li.setAttribute("aria-current", "step"); p.append(li); });
  }

  // ---------- chat helpers ----------
  const log = () => $("#chat");
  function scrollDown() { const c = log(); c.scrollTop = c.scrollHeight; }
  function userSays(text) { log().append(el("div", "msg user", text)); scrollDown(); }
  function botSays(content, cb) {
    const m = el("div", "msg bot typing", "…"); m.setAttribute("aria-label", t("typing")); log().append(m); scrollDown();
    setTimeout(() => { m.classList.remove("typing"); m.removeAttribute("aria-label"); m.textContent = ""; if (typeof content === "string") m.textContent = content; else m.append(content); scrollDown(); if (cb) cb(); }, 400);
  }
  function replies(opts) {
    const box = el("div", "qr");
    opts.forEach(([label, fn]) => { const b = el("button", "btn ghost", label); b.type = "button"; b.addEventListener("click", () => { box.remove(); userSays(label); fn(); }); box.append(b); });
    log().append(box); scrollDown(); const f = box.querySelector("button"); if (f) f.focus({ preventScroll: true });
  }

  // ---------- conversation ----------
  function start() {
    S.sym = new Set(); S.ans = {}; S.qi = 0; S.last = null;
    log().replaceChildren(); $("#results").hidden = true; setStep(1);
    botSays(bi("greet"), () => botSays(bi("askSym"), showPicker));
  }

  function showPicker() {
    const form = el("form", "picker"); form.noValidate = true;
    const fs = el("fieldset"); const lg = el("legend", "mut", bi("askSym")); fs.append(lg);
    const grid = el("div", "sgrid");
    E.SYMPTOMS.forEach(k => {
      const lab = el("label", "sym"), cb = el("input"); cb.type = "checkbox"; cb.name = "sym"; cb.value = k; cb.checked = S.sym.has(k);
      lab.append(cb, el("span", "", symLabel(k))); grid.append(lab);
    });
    fs.append(grid); form.append(fs);
    form.append(voiceBlock(form));
    const err = el("p", "err"); err.setAttribute("role", "alert");
    const go = el("button", "btn", t("cont")); go.type = "submit";
    form.append(err, go);
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      const chosen = [...form.querySelectorAll("input[name=sym]:checked")].map(i => i.value);
      if (!chosen.length) { err.textContent = bi("err_none"); return; }
      S.sym = new Set(chosen); form.querySelectorAll("input,button").forEach(n => n.disabled = true);
      userSays(chosen.map(symLabel).join(", ")); setStep(2); askNext();
    });
    const wrap = el("div", "msg bot"); wrap.append(form); log().append(wrap); scrollDown();
  }

  function voiceBlock(form) {
    const box = el("div", "voice"), b = el("button", "btn ghost", "🎤 " + t("voice")); b.type = "button";
    const txt = el("input"); txt.type = "text"; txt.placeholder = t("voice_ph"); txt.setAttribute("aria-label", t("voice_ph"));
    const find = el("button", "btn ghost", t("voice_find")); find.type = "button";
    const out = el("div", "chips"), info = el("p", "note"); info.setAttribute("aria-live", "polite");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const langs = { en: "en-IN", mr: "mr-IN", hi: "hi-IN" };
    b.addEventListener("click", () => {
      if (!SR) { info.textContent = t("voice_na"); txt.focus(); return; }
      try {
        const r = new SR(); r.lang = langs[S.lang]; r.interimResults = false; r.maxAlternatives = 1;
        info.textContent = t("voice_listen");
        r.onresult = e => { txt.value = e.results[0][0].transcript; info.textContent = ""; txt.focus(); };
        r.onerror = () => { info.textContent = t("voice_err"); };
        r.onend = () => { if (info.textContent === t("voice_listen")) info.textContent = ""; };
        r.start();
      } catch (e) { info.textContent = t("voice_err"); }
    });
    find.addEventListener("click", () => {
      out.replaceChildren(); const q = txt.value.toLowerCase().trim(); if (!q) return;
      // Matches are only suggestions: the user must tap to add each symptom.
      const hits = E.SYMPTOMS.filter(k => [I.en, I.mr, I.hi].some(d => q.includes(d["s_" + k].toLowerCase())));
      if (!hits.length) { info.textContent = t("voice_none"); return; }
      info.textContent = t("voice_add");
      hits.forEach(k => { const c = el("button", "chip", "+ " + symLabel(k)); c.type = "button"; c.addEventListener("click", () => { const i = form.querySelector('input[value="' + k + '"]'); if (i) i.checked = true; c.remove(); }); out.append(c); });
    });
    box.append(b, txt, find, info, out); return box;
  }

  function questions() {
    const q = [{ id: "duration", k: "q_dur", o: [["today", "o_today"], ["2to3", "o_2to3"], ["4plus", "o_4plus"], ["unknown", "o_unk"]] }];
    if (S.sym.has("fever")) q.push({ id: "temp", k: "q_temp", o: [["below38", "o_b38"], ["38to39", "o_38"], ["above39", "o_39"], ["unknown", "o_unk"]] });
    q.push({ id: "trend", k: "q_trend", o: [["better", "o_better"], ["same", "o_same"], ["worse", "o_worse"]] });
    if (S.sym.has("breathingDifficulty")) q.push({ id: "breath", k: "q_breath", o: [["mild", "o_mild"], ["severe", "o_severe"]] });
    return q;
  }
  function askNext() {
    const qs = questions().filter(q => !S.ans[q.id]);
    if (!qs.length) return summary();
    const q = qs[0];
    botSays(bi(q.k), () => replies(q.o.map(([v, lk]) => [bi(lk), () => { S.ans[q.id] = v; askNext(); }])));
  }
  const optLabel = (id, v) => { const q = questions().find(x => x.id === id); const o = q && q.o.find(x => x[0] === v); return o ? bi(o[1]) : bi("res_noans"); };
  function answerRows() {
    const m = { duration: "k_dur", temp: "k_temp", trend: "k_trend", breath: "k_breath" };
    return questions().map(q => [bi(m[q.id]), optLabel(q.id, S.ans[q.id])]);
  }
  function summary() {
    setStep(3);
    const box = el("div"); box.append(el("p", "", bi("sum_h")));
    box.append(el("p", "", [...S.sym].map(symLabel).join(", ")));
    const dl = el("dl", "kv"); answerRows().forEach(([k, v]) => dl.append(el("dt", "", k), el("dd", "", v))); box.append(dl);
    botSays(box, () => replies([
      [t("a_analyze"), analyze],
      [t("a_editSym"), () => { botSays(bi("askSym"), showPicker); }],
      [t("a_editAns"), () => { S.ans = {}; askNext(); }],
      [t("a_restart"), start]
    ]));
  }
  function analyze() {
    S.last = { date: new Date().toISOString(), sym: [...S.sym], ans: Object.assign({}, S.ans) };
    setStep(4); botSays(t("res_ready"), () => { renderResults(S.last, false); $("#results").scrollIntoView({ block: "start" }); });
  }

  // ---------- results ----------
  function dlist(rows) { const dl = el("dl", "kv"); rows.forEach(([k, v]) => dl.append(el("dt", "", k), el("dd", "", v))); return dl; }
  function renderResults(rec, readonly) {
    const root = $("#results"); root.replaceChildren(); root.hidden = false;
    const facts = E.buildFacts(rec.sym, rec.ans);
    const saved = S.last; S.last = rec;
    root.append(el("h2", "", t("res_h") + " — " + t("title")));
    root.append(dlist([[bi("res_date"), new Date(rec.date).toLocaleString(S.lang === "en" ? "en-IN" : S.lang + "-IN")], [bi("res_sym"), rec.sym.map(symLabel).join(", ")]]));
    const saf = E.safety(facts);   // safety layer runs first, independent of the editable rule base
    if (saf.length) {
      const a = el("div", "alert"); a.setAttribute("role", "alert"); a.append(el("h3", "", "⚠ " + bi("emerg_h")));
      saf.forEach(r => a.append(el("p", "", "• " + bi(r.msg.replace(".", "_")))));
      a.append(el("p", "", bi("emerg_act"))); root.append(a);
    }
    const answers = questions().filter(q => rec.ans[q.id]).map(q => [bi({ duration: "k_dur", temp: "k_temp", trend: "k_trend", breath: "k_breath" }[q.id]), optLabel(q.id, rec.ans[q.id])]);
    root.append(el("h3", "", t("res_ans")), answers.length ? dlist(answers) : el("p", "mut", t("res_noans")));

    // method controls
    const ctl = el("div", "row noprint");
    const ms = el("select"); ms.setAttribute("aria-label", t("res_method"));
    [["forward", "res_fwd"], ["backward", "res_bwd"]].forEach(([v, k]) => { const o = el("option", "", t(k)); o.value = v; ms.append(o); }); ms.value = S.method;
    const gs = el("select"); gs.setAttribute("aria-label", t("res_goal"));
    S.rules.filter(r => r.kind === "pattern").forEach(r => { const o = el("option", "", r.id + " — " + ruleTitle(r.id)); o.value = r.concl; gs.append(o); }); gs.value = S.goal; gs.hidden = S.method !== "backward";
    ms.addEventListener("change", () => { S.method = ms.value; renderResults(rec, readonly); });
    gs.addEventListener("change", () => { S.goal = gs.value; renderResults(rec, readonly); });
    ctl.append(ms, gs); root.append(el("h3", "", t("res_method") + ": " + t(S.method === "forward" ? "res_fwd" : "res_bwd")), ctl);

    let patterns = [], traceLines = [];
    if (S.method === "forward") {
      const fw = E.forward(facts, S.rules);
      patterns = fw.fired.filter(r => r.kind === "pattern");
      traceLines = fw.history.map(h => h.step + ". " + h.rule.id + " " + t("t_fire") + ": " + h.matched.map(factLabel).join(" + ") + " ⇒ " + (h.rule.kind === "pattern" ? ruleTitle(h.rule.id) : factLabel(h.rule.concl)));
    } else {
      const bw = E.backward(S.goal, facts, S.rules);
      if (bw.ok && bw.rule) patterns = [bw.rule];
      const gl = g => g.startsWith("P_") ? ruleTitle(g.slice(2)) : factLabel(g);
      traceLines = bw.trace.map(x => "\u00a0\u00a0".repeat(x.d) + gl(x.goal) + " — " + t("t_" + x.s) + (x.rule ? " " + x.rule.id : ""));
      root.append(el("p", bw.ok ? "" : "caut", bw.ok ? bi("res_proved") : bi("res_notproved") + " " + (bw.missing.length ? bw.missing.map(factLabel).join(", ") : "—")));
    }

    root.append(el("h3", "", t("res_pat")), el("p", "note", t("res_note")));
    if (!patterns.length) root.append(el("div", "empty", bi("res_none")));
    patterns.forEach(r => {
      const c = el("div", "card"); const h = el("h4"); h.append(el("span", "tag", r.id), document.createTextNode(ruleTitle(r.id))); c.append(h);
      c.append(el("p", "", bi("r_" + r.id + "_e")));
      c.append(dlist([[bi("res_matched"), r.req.map(factLabel).join(", ")]]));
      const sup = (r.opt || []).filter(x => facts.has(x)), miss = (r.opt || []).filter(x => !facts.has(x));
      if (sup.length) c.append(dlist([[bi("res_support"), sup.map(factLabel).join(", ")]]));
      (r.caution || []).filter(x => facts.has(x)).forEach(x => c.append(el("p", "caut", bi("res_caution") + ": " + bi(x === "fever" ? "cFever" : "cVomit"))));
      if (miss.length) c.append(dlist([[bi("res_missing"), miss.map(symLabel).join(", ")]]));
      c.append(dlist([[bi("res_spec"), (r.spec && r.spec.length ? r.spec : ["GP"]).map(specLabel).join(" / ")]]));
      root.append(c);
    });
    if (!patterns.length && !saf.length) root.append(dlist([[bi("res_spec"), specLabel("GP")]]));
    if (traceLines.length) { root.append(el("h3", "", t("res_trace"))); const ol = el("ol", "trace"); traceLines.forEach(x => ol.append(el("li", "", x))); root.append(ol); }
    root.append(el("h3", "", bi("res_next")), el("p", "", bi("next_default")));
    root.append(el("h3", "", bi("res_warn")), el("p", "", bi("warn_list")));
    root.append(el("div", "disc", bi("disc")));
    const row = el("div", "row noprint");
    if (!readonly) { const sv = el("button", "btn", t("res_save")); sv.addEventListener("click", () => { saveHistory(rec) ? toast(t("res_saved")) : toast("localStorage unavailable"); }); row.append(sv); }
    const pr = el("button", "btn ghost", t("res_print")); pr.addEventListener("click", () => window.print());
    const nw = el("button", "btn ghost", t("res_new")); nw.addEventListener("click", () => { showView("chat"); start(); window.scrollTo(0, 0); });
    row.append(pr, nw); root.append(row);
    if (readonly && saved) S.last = saved;
  }

  // ---------- history (localStorage, no personal data) ----------
  const readHist = () => { try { return JSON.parse(lsGet(LS.hist, "[]")) || []; } catch (e) { return []; } };
  function saveHistory(rec) { const h = readHist(); h.unshift({ id: Date.now(), date: rec.date, sym: rec.sym, ans: rec.ans }); return lsSet(LS.hist, JSON.stringify(h.slice(0, 50))) && (renderHistory(), true); }
  function renderHistory() {
    const box = $("#hist-list"); box.replaceChildren(); const h = readHist();
    if (!h.length) box.append(el("div", "empty", t("hist_empty")));
    h.forEach(e => {
      const r = el("div", "hist"), info = el("div"); info.append(el("strong", "", new Date(e.date).toLocaleString(S.lang === "en" ? "en-IN" : S.lang + "-IN")), el("div", "mut", e.sym.map(symLabel).join(", ")));
      const acts = el("div", "row"); acts.style.marginTop = "0";
      const o = el("button", "btn ghost", t("hist_open")); o.addEventListener("click", () => { showView("chat"); S.ans = e.ans; S.sym = new Set(e.sym); renderResults(e, true); $("#results").scrollIntoView(); });
      const d = el("button", "btn danger", t("hist_del")); d.addEventListener("click", () => { lsSet(LS.hist, JSON.stringify(readHist().filter(x => x.id !== e.id))); renderHistory(); });
      acts.append(o, d); r.append(info, acts); box.append(r);
    });
  }
  $("#hist-clear").addEventListener("click", () => { if (confirm(t("hist_confirm"))) { lsSet(LS.hist, "[]"); renderHistory(); } });
  $("#hist-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(readHist(), null, 2)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "arogya-mitra-history.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });

  // ---------- views, theme, language ----------
  function showView(v) {
    document.querySelectorAll(".view").forEach(n => n.hidden = n.id !== "view-" + v);
    document.querySelectorAll(".tab").forEach(b => { if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  }
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  $("#theme").addEventListener("click", () => { const d = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = d; lsSet(LS.theme, d); });
  $("#lang").addEventListener("change", e => { S.lang = e.target.value; lsSet(LS.lang, S.lang); applyLang(); start(); });  // changing language restarts the conversation
  const th = lsGet(LS.theme, window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = th;
  S.lang = I[lsGet(LS.lang, "en")] ? lsGet(LS.lang, "en") : "en";
  applyLang(); start();
})();
