const AUTH_KEY = 'nka_admin_authed'

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === '1'
}

export function loginWithPasscode(passcode: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_PASSCODE
  if (!expected) {
    return false
  }
  if (passcode === expected) {
    sessionStorage.setItem(AUTH_KEY, '1')
    return true
  }
  return false
}

export function logout(): void {
  sessionStorage.removeItem(AUTH_KEY)
}
