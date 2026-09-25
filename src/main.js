import './styles.css'

import { steps, progress } from './steps.js'
import { getStatus, getStats } from './api.js'

// ---------------------------------------------------------------
// Progress ladder (unchanged from step 2)
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

const stamp = document.querySelector('[data-build]')
if (stamp) {
  stamp.textContent = import.meta.env.PROD ? 'production build' : 'dev server'
}

// ---------------------------------------------------------------
// Server status — proves there is a second machine involved
// ---------------------------------------------------------------
const statusOut = document.querySelector('[data-status]')

if (statusOut) {
  statusOut.textContent = 'asking the server…'

  getStatus()
    .then((data) => {
      statusOut.textContent = `${data.runtime} on ${data.platform} · ${data.server_time_utc}`
    })
    .catch((err) => {
      statusOut.textContent = `couldn't reach the API — ${err.message}`
    })
}

// ---------------------------------------------------------------
// Statistics form
// ---------------------------------------------------------------
const form = document.querySelector('[data-stats-form]')

if (form) {
  const input = form.querySelector('textarea')
  const button = form.querySelector('button')
  const output = document.querySelector('[data-stats-out]')

  const parse = (raw) =>
    raw
      .split(/[\s,;]+/)      // split on spaces, commas, semicolons, newlines
      .filter(Boolean)
      .map(Number)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()   // stop the browser doing a full page reload

    const values = parse(input.value)

    // A client-side check for fast feedback. Note that the server checks
    // the same things again — it has to, because this code runs on the
    // user's machine and they can remove it.
    if (values.length < 2 || values.some(Number.isNaN)) {
      output.innerHTML = `<p class="err">Enter at least two numbers, separated by spaces or commas.</p>`
      return
    }

    button.disabled = true
    output.innerHTML = `<p class="muted">calculating on the server…</p>`

    try {
      const r = await getStats(values)

      output.innerHTML = `
        <table class="stats">
          <tr><th>n</th><td>${r.n}</td></tr>
          <tr><th>mean</th><td>${r.mean}</td></tr>
          <tr><th>median</th><td>${r.median}</td></tr>
          <tr><th>std. dev.</th><td>${r.stdev}</td></tr>
          <tr><th>variance</th><td>${r.variance}</td></tr>
          <tr><th>min / max</th><td>${r.min} / ${r.max}</td></tr>
          <tr><th>Q1 / Q3</th><td>${r.q1} / ${r.q3}</td></tr>
        </table>`
    } catch (err) {
      output.innerHTML = `<p class="err">${err.message}</p>`
    } finally {
      button.disabled = false
    }
  })
}
