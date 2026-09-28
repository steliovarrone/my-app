import './styles.css'

import { steps, progress } from './steps.js'
import { getStatus, getStats, getHistory } from './api.js'

// ---------------------------------------------------------------
// Progress ladder
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
if (stamp) stamp.textContent = import.meta.env.PROD ? 'production build' : 'dev server'

// ---------------------------------------------------------------
// Server status
// ---------------------------------------------------------------
const statusOut = document.querySelector('[data-status]')

if (statusOut) {
  statusOut.textContent = 'asking the server…'

  getStatus()
    .then((d) => {
      statusOut.textContent = `${d.runtime} on ${d.platform} · database ${d.database}`
    })
    .catch((err) => {
      statusOut.textContent = `couldn't reach the API — ${err.message}`
    })
}

// ---------------------------------------------------------------
// Shared history
// ---------------------------------------------------------------
const historyOut = document.querySelector('[data-history]')

// Anything a stranger typed is rendered as text, never as markup. These
// values came out of a database that anyone on the internet can write to.
const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

const time = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

const renderHistory = async () => {
  if (!historyOut) return

  try {
    const { runs, count } = await getHistory()

    if (count === 0) {
      historyOut.innerHTML = `<p class="muted">Nothing calculated yet today. Be first.</p>`
      return
    }

    historyOut.innerHTML = `
      <table class="stats">
        <thead><tr><th>time (UTC)</th><th>n</th><th>mean</th><th>std. dev.</th></tr></thead>
        <tbody>
          ${runs
            .map(
              (r) => `<tr>
                <td>${escape(time(r.ts))}</td>
                <td>${escape(r.n)}</td>
                <td>${escape(r.mean)}</td>
                <td>${escape(r.stdev)}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <p class="muted">${count} run${count === 1 ? '' : 's'} today, newest first.</p>`
  } catch (err) {
    historyOut.innerHTML = `<p class="err">History unavailable — ${escape(err.message)}</p>`
  }
}

renderHistory()

// ---------------------------------------------------------------
// Statistics form
// ---------------------------------------------------------------
const form = document.querySelector('[data-stats-form]')

if (form) {
  const input = form.querySelector('textarea')
  const button = form.querySelector('button')
  const output = document.querySelector('[data-stats-out]')

  const parse = (raw) => raw.split(/[\s,;]+/).filter(Boolean).map(Number)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    const values = parse(input.value)

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
        </table>
        ${r.saved ? '' : '<p class="err">Calculated, but not saved — the database write failed.</p>'}`

      // The shared list just changed. Pull it again so this visitor sees
      // their own entry appear alongside everyone else's.
      renderHistory()
    } catch (err) {
      output.innerHTML = `<p class="err">${escape(err.message)}</p>`
    } finally {
      button.disabled = false
    }
  })
}
