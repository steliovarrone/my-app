// A plain data module. It exports a value; another module imports it.
// This is the thing a bundler exists to handle: at build time Vite follows
// the import, pulls this file into the bundle, and the browser never learns
// that two separate files were involved.

export const steps = [
  { n: 0,  label: 'Publish a static page',            done: true  },
  { n: 1,  label: 'Multiple pages, CSS, routing',     done: true  },
  { n: 2,  label: 'A build step with Vite',           done: true  },
  { n: 3,  label: 'A serverless API',                 done: false },
  { n: 4,  label: 'A database',                       done: false },
  { n: 5,  label: 'Secrets and config',               done: false },
  { n: 6,  label: 'Authentication',                   done: false },
  { n: 7,  label: 'Custom domain and environments',   done: false },
  { n: 8,  label: 'Monitoring and CI tests',          done: false },
  { n: 9,  label: 'Infrastructure as code',           done: false },
  { n: 10, label: 'Graduate to App Service',          done: false },
]

export const progress = () => {
  const done = steps.filter((s) => s.done).length
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) }
}
