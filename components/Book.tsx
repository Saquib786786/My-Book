"use client";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import en from "@/data/book.en.json";
import ur from "@/data/book.ur.json";

type Pg = { h: string; t: string; c: string };
type Toc = { k: string; t: string; p: number };
type Lang = "en" | "ur";

const R = 0.705;
const BLANK = '<div class="pg blank"></div>';
const ENDP = '<div class="pg endp"></div>';
const COVER = '<div class="cover"></div>';
const UDG = "۰۱۲۳۴۵۶۷۸۹";

const LB = {
  en: { toc: "Contents", mark: "Bookmark", marked: "Bookmarked", night: "Night", full: "Fullscreen", close: "Close book", open: "Open Book", cont: (n: string) => `Continue · page ${n}`, srch: "Search poem titles", rst: "Restart reading", bm: "Bookmarks", none: "No matching poem.", lang: "اردو" },
  ur: { toc: "فہرست", mark: "نشان لگائیں", marked: "نشان زد", night: "رات", full: "مکمل اسکرین", close: "کتاب بند کریں", open: "کتاب کھولیں", cont: (n: string) => `جاری رکھیں · صفحہ ${n}`, srch: "نظم کا عنوان تلاش کریں", rst: "دوبارہ شروع کریں", bm: "نشانات", none: "کوئی نظم نہیں ملی۔", lang: "English" },
};

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const Face = memo(
  function Face({ html, cls }: { html: string; cls: string }) {
    return <div className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
  },
  (a, b) => a.html === b.html && a.cls === b.cls
);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const store = {
  get<T>(k: string, d: T): T {
    try { const v = JSON.parse(localStorage.getItem(k) ?? "null"); return v ?? d; } catch { return d; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const barBtn = "px-2 py-1 opacity-85 hover:opacity-100 hover:text-[#e8c58a] disabled:opacity-25 disabled:cursor-default disabled:hover:text-inherit";
const pill = "border border-gold/60 bg-[#140a06]/60 px-6 py-2 text-[0.85rem] uppercase tracking-[0.2em] text-cream backdrop-blur-sm hover:bg-wine/70 rounded-sm";

export default function Book() {
  const [lang, setLang] = useState<Lang>("en");
  const [mobile, setMobile] = useState(false);
  const [dims, setDims] = useState({ pw: 400, ph: 567 });
  const [f, setFState] = useState(0);
  const [night, setNight] = useState(false);
  const [fs, setFs] = useState(1);
  const [marks, setMarks] = useState<number[]>([]);
  const [panel, setPanel] = useState(false);
  const [q, setQ] = useState("");
  const [last, setLast] = useState(-1);
  const [loaded, setLoaded] = useState(false);

  const data = lang === "ur" ? ur : en;
  const P = data.pages as Pg[];
  const TOC = data.toc as Toc[];
  const N = P.length;
  const D = (s: string | number) => (lang === "ur" ? String(s).replace(/\d/g, (d) => UDG[+d]) : String(s));
  const L18 = LB[lang];

  const pairs = useMemo(() => {
    const pg = P.map((p) => p.h);
    if (mobile) return [[COVER, ENDP], ...pg.map((h) => [h, ENDP])];
    const A = [COVER, ENDP, ...pg, BLANK];
    const out: string[][] = [];
    for (let i = 0; i < A.length; i += 2) out.push([A[i], A[i + 1]]);
    return out;
  }, [P, mobile]);
  const L = pairs.length;
  const maxF = L - 1;

  const fRef = useRef(0);
  const busy = useRef(false);
  const queue = useRef<number[]>([]);
  const swiped = useRef(false);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);
  const leaves = useRef<(HTMLDivElement | null)[]>([]);
  const shR = useRef<HTMLDivElement>(null);
  const shL = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const mobRef = useRef(false);
  mobRef.current = mobile;

  const fForPage = (p: number) => (mobile ? p + 1 : Math.ceil(p / 2) + 1);
  const curP = (ff: number) => {
    if (ff < 1) return -1;
    const raw = mobile ? ff - 1 : 2 * ff - 2 < N ? 2 * ff - 2 : 2 * ff - 3;
    return raw >= 0 && raw < N ? raw : -1;
  };
  const p = curP(f);
  const setF = (n: number) => { fRef.current = n; setFState(n); };

  const setLeaf = (j: number, a: number) => {
    const l = leaves.current[j]; if (!l) return;
    l.style.transform = `rotateY(${a}deg)`;
    l.style.setProperty("--s", Math.sin((Math.abs(a) * Math.PI) / 180).toFixed(3));
  };
  const rest = (j: number) => {
    const l = leaves.current[j]; if (!l) return;
    const fl = j < fRef.current;
    setLeaf(j, fl ? -180 : 0);
    l.style.zIndex = String(fl ? j + 1 : L - j);
    l.style.visibility = mobRef.current && fl ? "hidden" : "visible";
  };
  const shade = (a: number) => {
    const u = -a / 180, s = Math.sin(Math.PI * u);
    if (shR.current) shR.current.style.opacity = (0.5 * s * (1 - u)).toFixed(3);
    if (shL.current) shL.current.style.opacity = (0.5 * s * u).toFixed(3);
  };
  const fit = useCallback(() => {
    bookRef.current?.querySelectorAll<HTMLElement>(".pg[data-fit]").forEach((pg) => {
      const i = pg.firstElementChild as HTMLElement | null; if (!i) return;
      let k = 1; pg.style.setProperty("--k", "1");
      while (i.scrollHeight > i.clientHeight + 1 && k > 0.4) { k -= 0.03; pg.style.setProperty("--k", k.toFixed(2)); }
    });
  }, []);

  const turn = (d: number) => {
    if (busy.current) { if (queue.current.length < 2) queue.current.push(d); return; }
    const nf = fRef.current + d;
    if (nf < 0 || nf > maxF) return;
    busy.current = true;
    const j = d > 0 ? fRef.current : fRef.current - 1;
    const l = leaves.current[j]; if (!l) { busy.current = false; return; }
    l.style.zIndex = "200"; l.style.visibility = "visible";
    const from = d > 0 ? 0 : -180, to = d > 0 ? -180 : 0, dur = queue.current.length ? 520 : 820;
    setF(nf);
    let t0: number | null = null;
    const step = (ts: number) => {
      if (t0 == null) t0 = ts;
      const pr = Math.min(1, (ts - t0) / dur), a = from + (to - from) * ease(pr);
      setLeaf(j, a); shade(a);
      if (pr < 1) requestAnimationFrame(step);
      else {
        rest(j); shade(0); busy.current = false;
        const n = queue.current.shift(); if (n) turn(n);
      }
    };
    requestAnimationFrame(step);
  };
  const inst = (nf: number) => { setF(nf); leaves.current.forEach((_, j) => rest(j)); shade(0); };
  const goF = (t: number) => {
    if (busy.current || t === fRef.current || t < 0 || t > maxF) return;
    if (Math.abs(t - fRef.current) === 1) return turn(t - fRef.current);
    if (t > fRef.current) { inst(t - 1); turn(1); } else { inst(t + 1); turn(-1); }
  };
  const goP = (pg: number) => { setPanel(false); goF(fForPage(pg)); };

  // always-fresh handlers for global listeners
  const api = useRef({ turn, goP });
  api.current = { turn, goP };

  // load prefs
  useEffect(() => {
    const pr = store.get("bn-prefs", { night: false, fs: 1, marks: [] as number[], lang: "en" });
    setNight(!!pr.night); setFs(pr.fs || 1); setMarks(pr.marks || []); setLang(pr.lang === "ur" ? "ur" : "en");
    setLast(store.get("bn-last", -1)); setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) store.set("bn-prefs", { night, fs, marks, lang }); }, [night, fs, marks, lang, loaded]);
  useEffect(() => { if (p >= 0) { store.set("bn-last", p); setLast(p); } }, [p]);

  // body classes + css vars
  useEffect(() => { document.body.classList.toggle("night", night); }, [night]);
  useEffect(() => { document.body.classList.toggle("closed", f === 0); }, [f]);
  useEffect(() => { document.body.classList.toggle("m", mobile); }, [mobile]);
  useEffect(() => { document.documentElement.lang = lang === "ur" ? "ur" : "en"; }, [lang]);
  useIso(() => {
    const r = document.documentElement.style;
    r.setProperty("--pw", dims.pw + "px"); r.setProperty("--ph", dims.ph + "px"); r.setProperty("--fs", String(fs));
  }, [dims, fs]);

  // sizing
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const size = () => {
      const m = innerWidth < 820;
      const ratio = m ? 0.66 : R;
      const aH = innerHeight - (m ? 95 : 120);
      const aW = m ? Math.min(innerWidth - 20, 480) : (innerWidth - 70) / 2;
      const ph = Math.min(aH, aW / ratio, m ? 740 : 900);
      const pw = Math.round(ph * ratio);
      setMobile(m);
      setDims({ pw, ph: Math.round(ph) });
    };
    size();
    const onR = () => { clearTimeout(t); t = setTimeout(size, 150); };
    addEventListener("resize", onR);
    return () => { removeEventListener("resize", onR); clearTimeout(t); };
  }, []);

  // after every rebuild (mode / language / size): restore position, refit
  const pageRef = useRef(-1);
  pageRef.current = p;
  const prevMode = useRef<{ mobile: boolean; lang: Lang } | null>(null);
  useIso(() => {
    const prev = prevMode.current;
    if (prev && prev.mobile !== mobile) {
      const pp = pageRef.current;
      fRef.current = pp >= 0 ? fForPage(pp) : 0; setFState(fRef.current);
    }
    prevMode.current = { mobile, lang };
    leaves.current.length = L;
    leaves.current.forEach((_, j) => rest(j));
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, lang, pairs, dims.ph]);
  useEffect(() => {
    document.fonts?.ready.then(fit);
    if (lang === "ur") document.fonts?.load('16px "Noto Nastaliq Urdu"').then(fit);
  }, [lang, fit]);
  useIso(() => { fit(); }, [fs, fit]);

  // keyboard + touch
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") { if (e.key === "Escape") setPanel(false); return; }
      if (e.key === "ArrowRight") api.current.turn(1);
      else if (e.key === "ArrowLeft") api.current.turn(-1);
      else if (e.key === "Escape") setPanel(false);
    };
    addEventListener("keydown", kd);
    return () => removeEventListener("keydown", kd);
  }, []);

  const onBookClick = (e: React.MouseEvent) => {
    if (swiped.current) return;
    if (fRef.current === 0) { turn(1); return; }
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left;
    const ratio = x / r.width;

    // Edge tap zones: tapping near the outer edges always flips pages safely
    if (mobile) {
      if (ratio > 0.78) { turn(1); return; }
      if (ratio < 0.22) { turn(-1); return; }
    } else {
      if (ratio > 0.85) { turn(1); return; }
      if (ratio < 0.15) { turn(-1); return; }
    }

    // Inside reading area: check if user specifically clicked a chapter/poem link
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-go]");
    if (a) { e.preventDefault(); goP(+a.dataset.go!); return; }

    if (mobile) (ratio < 0.3 ? turn(-1) : turn(1));
    else ratio < 0.5 ? turn(-1) : turn(1);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || !mobile || fRef.current === 0) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = touchY.current != null ? e.changedTouches[0].clientY - touchY.current : 0;
    touchX.current = null;
    touchY.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped.current = true;
      setTimeout(() => (swiped.current = false), 450);
      turn(dx < 0 ? 1 : -1);
    }
  };

  const toggleLang = (l: Lang) => { if (!busy.current && l !== lang) setLang(l); };
  const fullscreen = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch {} };
  const toggleMark = () => { if (p < 0) return; setMarks((m) => (m.includes(p) ? m.filter((x) => x !== p) : [...m, p])); };
  const closePanel = () => setPanel(false);

  // indicator
  let ind = "";
  if (f > 0) {
    if (mobile) ind = `${p + 1} / ${N}`;
    else { const l = 2 * f - 3, r = 2 * f - 2; ind = f === 1 ? `1 / ${N}` : r < N ? `${l + 1}–${r + 1} / ${N}` : `${l + 1} / ${N}`; }
  }
  const closed = f === 0;
  const sR = closed ? 0 : Math.max(2, Math.round((11 * (maxF - f)) / maxF) + 2);
  const sL = closed ? 0 : Math.max(2, Math.round((11 * f) / maxF) + 2);
  const filtered = TOC.filter((e) => !q.trim() || (e.k === "poem" && e.t.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <>
      <main className="flex h-full items-center justify-center pb-[70px]">
        <div
          id="book"
          ref={bookRef}
          className={closed ? "closed" : ""}
          onClick={onBookClick}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
            touchY.current = e.touches[0].clientY;
          }}
          onTouchEnd={onTouchEnd}
        >
          <div className="board" id="bL" />
          <div className="board" id="bR" />
          <div className="stk" id="sL" style={{ width: sL, left: `calc(50% - var(--pw) - ${sL}px)` }} />
          <div className="stk" id="sR" style={{ width: sR }} />
          <div className="sh" id="shL" ref={shL} />
          <div className="sh" id="shR" ref={shR} />
          {pairs.map(([a, b], j) => (
            <div className="leaf" key={`${lang}-${mobile}-${j}`} ref={(el) => { leaves.current[j] = el; }}>
              <Face cls="face front" html={a} />
              <Face cls="face back" html={b} />
            </div>
          ))}
        </div>
      </main>

      {/* cover actions */}
      <div className={`fixed inset-x-0 bottom-[max(20px,calc(env(safe-area-inset-bottom)+12px))] flex flex-wrap justify-center gap-3 transition-opacity duration-500 ${closed ? "" : "pointer-events-none opacity-0"}`} dir="ltr">
        <div className="mb-0.5 flex w-full justify-center gap-1">
          {(["en", "ur"] as Lang[]).map((l) => (
            <button key={l} onClick={() => toggleLang(l)} className={`border-b px-3 py-1 tracking-wider ${lang === l ? "border-gold opacity-100" : "border-transparent opacity-60"}`}>
              {l === "en" ? "English" : "اردو"}
            </button>
          ))}
        </div>
        <button className={pill} onClick={() => turn(1)}>{L18.open}</button>
        {last > 0 && last < N && <button className={pill} onClick={() => inst(fForPage(last))}>{L18.cont(D(last + 1))}</button>}
      </div>

      {/* chapter label */}
      <div className={`pointer-events-none fixed inset-x-0 bottom-[max(56px,calc(env(safe-area-inset-bottom)+46px))] text-center text-xs uppercase tracking-[0.18em] opacity-55 transition-opacity ${closed ? "opacity-0" : ""}`}>
        {p >= 0 && p < N && P[p] ? P[p].c : ""}
      </div>

      {/* controls */}
      <nav
        aria-label="Reading controls"
        dir="ltr"
        className={`fixed bottom-[max(10px,env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100%-12px)] -translate-x-1/2 flex-nowrap items-center justify-center gap-0.5 rounded-full border border-gold/30 bg-[#120905]/85 px-2.5 py-1 text-[0.82rem] backdrop-blur-md shadow-xl transition-opacity duration-500 sm:rounded sm:px-2 sm:text-[0.88rem] ${closed ? "pointer-events-none opacity-0" : ""}`}
      >
        <div className="absolute -top-px left-0 h-0.5 bg-gold transition-[width] duration-500" style={{ width: `${p >= 0 && p < N ? (p / (N - 1)) * 100 : 0}%` }} />
        <button className={`${barBtn} text-xl leading-none px-1.5`} disabled={f < 1} onClick={() => turn(-1)} aria-label="Previous page">‹</button>
        <span className="min-w-[68px] sm:min-w-[92px] text-center tabular-nums text-xs sm:text-sm font-medium" aria-live="polite">{D(ind)}</span>
        <button className={`${barBtn} text-xl leading-none px-1.5`} disabled={f >= maxF} onClick={() => turn(1)} aria-label="Next page">›</button>
        <button className={barBtn} onClick={() => setPanel(true)}>{L18.toc}</button>
        <button className={`${barBtn} hidden sm:inline-block`} onClick={toggleMark}>{p >= 0 && marks.includes(p) ? L18.marked : L18.mark}</button>
        <button className={`${barBtn} px-1`} onClick={() => setFs((v) => Math.max(0.8, +(v - 0.07).toFixed(2)))} aria-label="Smaller text">A−</button>
        <button className={`${barBtn} px-1`} onClick={() => setFs((v) => Math.min(1.3, +(v + 0.07).toFixed(2)))} aria-label="Larger text">A+</button>
        <button className={barBtn} onClick={() => setNight((v) => !v)}>{L18.night}</button>
        <button className={barBtn} onClick={() => toggleLang(lang === "ur" ? "en" : "ur")}>{L18.lang}</button>
        <button className={`${barBtn} hidden sm:inline-block`} onClick={fullscreen}>{L18.full}</button>
        <button className={`${barBtn} hidden sm:inline-block`} onClick={() => goF(0)}>{L18.close}</button>
      </nav>

      {/* contents panel */}
      {panel && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#080402]/60" onClick={(e) => e.target === e.currentTarget && closePanel()} role="dialog" aria-label="Contents">
          <div dir={lang === "ur" ? "rtl" : "ltr"} className="max-h-[84vh] w-[min(440px,92vw)] overflow-auto rounded border border-gold/40 bg-[#22140d] p-5 shadow-2xl">
            <h4 className="font-serif text-xl font-semibold text-[#e8c58a]">{L18.toc}</h4>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L18.srch} aria-label={L18.srch} className="my-2 w-full border border-gold/35 bg-[#150b07] px-3 py-2 outline-none" />
            {filtered.length ? filtered.map((e, i) => (
              <button key={i} onClick={() => goP(e.p)} className={`flex w-full justify-between border-b border-white/5 px-1 py-1.5 text-start hover:text-[#e8c58a] ${e.k === "part" ? "mt-1 font-serif font-semibold text-[#e8c58a]" : ""}`}>
                <span>{e.t}</span><span className="opacity-50">{D(e.p + 1)}</span>
              </button>
            )) : <p>{L18.none}</p>}
            {marks.length > 0 && (
              <>
                <h4 className="mt-4 font-serif text-xl font-semibold text-[#e8c58a]">{L18.bm}</h4>
                {[...marks].filter((m) => m >= 0 && m < N && P[m]).sort((a, b) => a - b).map((m) => (
                  <button key={m} onClick={() => goP(m)} className="flex w-full justify-between border-b border-white/5 px-1 py-1.5 text-start hover:text-[#e8c58a]">
                    <span>{P[m]?.t ?? ""}</span><span className="opacity-50">{D(m + 1)}</span>
                  </button>
                ))}
              </>
            )}
            <button className="mt-3 flex w-full justify-between border-b border-white/5 px-1 py-1.5 text-start hover:text-[#e8c58a]" onClick={() => { store.set("bn-last", -1); setLast(-1); closePanel(); goF(0); }}>
              <span>{L18.rst}</span><span />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
