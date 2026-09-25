// Importing CSS from JavaScript looks wrong the first time you see it.
// It works because Vite intercepts the import: in dev it injects a <style>
// tag for instant hot reload, and in the production build it extracts the
// CSS into its own hashed file and adds a <link> to the HTML for you.
import './styles.css'

import { steps, progress } from './steps.js'

// ---------------------------------------------------------------
// Render the progress ladder, if this page has a slot for it.
// Both index.html and 404.html load this same bundle, so guard first.
// ---------------------------------------------------------------
const list = document.querySelector('[data-steps]')

if (list) {
  list.innerHTML = steps
    .map(
      (s) => `
      <li class="${s.done ? 'done' : ''}">
        <span class="step-n">${s.n}</span>${s.label}
      </li>`
    )
    .join('')
}

const meter = document.querySelector('[data-progress]')

if (meter) {
  const { done, total, pct } = progress()
  meter.querySelector('[data-progress-bar]').style.width = `${pct}%`
  meter.querySelector('[data-progress-label]').textContent =
    `${done} of ${total} steps · ${pct}%`
}

// ---------------------------------------------------------------
// import.meta.env is replaced at BUILD time, not read at runtime.
// Look at dist/assets/*.js after building and you'll find the literal
// string sitting where this expression used to be.
// ---------------------------------------------------------------
const stamp = document.querySelector('[data-build]')

if (stamp) {
  stamp.textContent = import.meta.env.PROD
    ? 'production build'
    : 'dev server (hot reload on)'
}
