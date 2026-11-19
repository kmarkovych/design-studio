// A neutral system font stack is the deliberate choice: this page frames other people's
// design work, so it stays offline (no font downloads) and has no visual style of its own.
export const GALLERY_CSS = `
:root {
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --bg: #fbfbfa; --text: #1b1b1a; --muted: #5a5a55; --rule: #d6d6d0; --accent: #1f4fd8;
  --pass: #1b6a38; --fail: #a3261d; --frame: #ffffff;
  --gutter: clamp(1rem, 4vw, 3rem); --measure: 52ch; --gap: clamp(3rem, 8vw, 6rem);
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #141413; --text: #ecece8; --muted: #a6a6a0; --rule: #3a3a35; --accent: #93b2ff;
    --pass: #78d69b; --fail: #ff948a; --frame: #1d1d1b; }
}
* { box-sizing: border-box; }
body { overflow-wrap: anywhere; margin: 0; background: var(--bg); color: var(--text); font: 1rem/1.55 var(--font); }
header, main, footer { padding-inline: var(--gutter); max-width: 96rem; margin-inline: auto; }
header { padding-block: clamp(2rem, 6vw, 4rem) 1rem; }
h1 { font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.75rem; }
.summary, .reasons li, .tie { text-wrap: pretty; }
.brief { font-size: clamp(1.25rem, 1rem + 1.2vw, 1.75rem); line-height: 1.35; max-width: var(--measure); margin: 0; }
.tie { max-width: var(--measure); margin: 1.25rem 0 0; padding-left: 1rem; border-left: 3px solid var(--muted); }
.direction { padding-block: var(--gap) 0; border-top: 1px solid var(--rule); margin-top: var(--gap); }
.direction h2 { margin: 0.25rem 0 0.5rem; font-size: 1.25rem; line-height: 1.2; }
.direction.lead h2 { font-size: clamp(2rem, 1.4rem + 3vw, 3.25rem); letter-spacing: -0.01em; }
.direction.lead { border-top: 3px solid var(--text); }
.rank { margin: 0; font-size: 0.875rem; color: var(--muted); font-weight: 600; }
.summary { max-width: var(--measure); margin: 0 0 1rem; }
.status { margin: 0 0 1.25rem; font-weight: 600; }
.status.pass { color: var(--pass); } .status.fail { color: var(--fail); }
.shots { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; margin: 0 0 1.25rem; align-items: start; }
.shots figure { margin: 0; }
.shots a { display: block; }
.shots img { display: block; width: 100%; height: auto; background: var(--frame); border: 1px solid var(--rule); transition: opacity 150ms ease; }
.shots figcaption { margin-top: 0.4rem; font-size: 0.8125rem; color: var(--muted); }
.shots .phone { max-width: 16rem; }
@media (min-width: 60rem) { .shots { grid-template-columns: minmax(0, 1fr) clamp(15rem, 22vw, 24.375rem); } .shots .phone { max-width: none; } }
a { color: var(--accent); text-underline-offset: 0.2em; }
a:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 2px; }
.open { display: inline-block; font-weight: 600; transition: transform 150ms ease; }
.open:hover { transform: translateX(3px); }
.shots a:hover img { opacity: 0.88; }
.reasons { max-width: var(--measure); margin: 1.5rem 0 0; padding: 0; list-style: none; }
.reasons li { margin: 0 0 0.75rem; color: var(--muted); }
.reasons strong { color: var(--text); }
footer { padding-block: var(--gap) 4rem; }
footer p { max-width: var(--measure); margin: 0; padding-top: 1rem; border-top: 1px solid var(--rule); }
`;
