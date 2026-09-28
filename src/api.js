const request = async (path, options = {}) => {
  const res = await fetch(`/api/${path}`, options)

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

export const getHistory = () => request('history')

export const getStats = (values) =>
  request('stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
