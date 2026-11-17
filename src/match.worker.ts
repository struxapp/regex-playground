import { runMatch } from './matcher';

export interface MatchRequest {
  id: number;
  pattern: string;
  flags: string;
  text: string;
  replacement: string | null;
}

// Runs user patterns off the main thread so a catastrophic pattern can be stopped by terminating the worker.
self.addEventListener('message', (event: MessageEvent<MatchRequest>) => {
  const { id, pattern, flags, text, replacement } = event.data;
  const result = runMatch(pattern, flags, text, replacement);
  self.postMessage({ id, result });
});
