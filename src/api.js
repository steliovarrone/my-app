// Every call to your own server goes through here.
//
// The URL is a plain relative path — "/api/stats", not a full domain. That
// works because Static Web Apps serves your files and your functions from
// the same origin. No CORS, no second hostname, no configuration.

const request = async (path, options = {}) => {
  const res = await fetch(`/api/${path}`, options)

  // A response arriving is not the same as it succeeding. fetch() only
  // rejects on network failure — a 400 or a 500 resolves normally, so the
  // status has to be checked explicitly. This trips up almost everyone once.
  let body = null
  try {
    body = await res.json()
  } catch {
    throw new Error(`Server returned ${res.status} with a non-JSON body.`)
  }

  if (!res.ok) {
    throw new Error(body?.error ?? `Server returned ${res.status}.`)
  }

  return body
}

export const getStatus = () => request('status')

export const getStats = (values) =>
  request('stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
