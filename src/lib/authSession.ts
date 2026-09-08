const activeSessions = new Set<string>();

export function hasSession(key: string): boolean {
  return activeSessions.has(key);
}

export function startSession(key: string): void {
  activeSessions.add(key);
}

export function endSession(key: string): void {
  activeSessions.delete(key);
}