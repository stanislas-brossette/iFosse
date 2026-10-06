// Shared by operator provisioning and the Edge Function; never includes secrets.
export function normalizeMember(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('expected an object.')
  const keys = Object.keys(row)
  if (keys.length !== 3 || keys.some(key => !['email', 'first_name', 'last_name'].includes(key))) throw new Error('only email, first_name and last_name are accepted; roles are managed separately.')
  if (typeof row.email !== 'string') throw new Error('email is required.')
  const email = row.email.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('email is invalid.')
  const names = {}
  for (const field of ['first_name', 'last_name']) {
    if (typeof row[field] !== 'string') throw new Error(`${field} is required.`)
    const value = row[field].trim()
    if (!value || value.length > 100 || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error(`${field} must contain 1 to 100 printable characters.`)
    names[field] = value
  }
  return { email, ...names }
}
