/**
 * Background Response Poller
 *
 * Monitors active OpenClaw Gateway sessions for agent responses.
 * Detects completion markers and triggers appropriate status transitions
 * via MC's own API endpoints (same pattern as planning-poll).
 */

import { queryAll, run } from '@/lib/db';
import { getMessagesFromOpenClaw } from '@/lib/planning-utils';
import { getMissionControlUrl } from '@/lib/config';
import { broadcast } from '@/lib/events';
import type { Task, OpenClawSession } from '@/lib/types';
import { queryOne } from '@/lib/db';

const POLL_INTERVAL_MS = parseInt(process.env.RESPONSE_POLL_INTERVAL_MS || '5000', 10);
const POLL_ENABLED = process.env.RESPONSE_POLL_ENABLED !== 'false';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;

// Completion marker patterns (same as webhook)
const COMPLETION_PATTERNS = [
  { pattern: /TASK_COMPLETE:\s*(.+)/i, type: 'task_complete' as const },
  { pattern: /TEST_PASS:\s*(.+)/i, type: 'test_pass' as const },
  { pattern: /TEST_FAIL:\s*(.+)/i, type: 'test_fail' as const },
  { pattern: /VERIFY_PASS:\s*(.+)/i, type: 'verify_pass' as const },
  { pattern: /VERIFY_FAIL:\s*(.+)/i, type: 'verify_fail' as const },
];

interface ActiveSession {
  session_id: string;
  openclaw_session_id: string;
  agent_id: string;
  agent_name: string;
  task_id: string;
  task_status: string;
  last_message_count: number;
}

/**
 * Find all active sessions that need polling.
 * Joins openclaw_sessions with tasks and agents to get full context.
 */
function getActiveSessions(): ActiveSession[] {
  return queryAll<ActiveSession>(
    `SELECT
       os.id as session_id,
       os.openclaw_session_id,
       os.agent_id,
       a.name as agent_name,
       os.task_id,
       t.status as task_status,
       COALESCE(os.last_message_count, 0) as last_message_count
     FROM openclaw_sessions os
     JOIN agents a ON os.agent_id = a.id
     JOIN tasks t ON os.task_id = t.id
     WHERE os.status = 'active'
       AND a.source = 'gateway'
       AND t.status IN ('in_progress', 'testing', 'verification')`
  );
}

/**
 * Check a message for completion markers.
 * Returns the first match found, or null.
 */
function detectCompletion(content: string): { type: string; summary: string } | null {
  for (const { pattern, type } of COMPLETION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      return { type, summary: match[1].trim() };
    }
  }
  return null;
}

/**
 * Handle a detected completion marker by calling MC's own API endpoints.
 * Uses fetch() on MC endpoints (same pattern as planning-poll).
 */
async function handleCompletion(
  session: ActiveSession,
  completionType: string,
  summary: string
): Promise<void> {
  const missionControlUrl = getMissionControlUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.MC_API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.MC_API_TOKEN}`;
  }

  const now = new Date().toISOString();

  switch (completionType) {
    case 'task_complete': {
      // Agent finished building -> use webhook completion endpoint
      const res = await fetch(`${missionControlUrl}/api/webhooks/agent-completion`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          task_id: session.task_id,
          summary,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[Response Poller] TASK_COMPLETE webhook failed (${res.status}): ${errorText}`);
      } else {
        console.log(`[Response Poller] TASK_COMPLETE handled for task ${session.task_id}`);
      }
      break;
    }

    case 'test_pass': {
      // Test passed -> move to next stage via PATCH
      const res = await fetch(`${missionControlUrl}/api/tasks/${session.task_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'review' }),
      });
      if (!res.ok) {
        console.error(`[Response Poller] TEST_PASS status update failed: ${await res.text()}`);
      } else {
        console.log(`[Response Poller] TEST_PASS: task ${session.task_id} -> review`);
      }
      // Log activity
      logActivity(session.task_id, session.agent_id, `Test passed: ${summary}`);
      break;
    }

    case 'test_fail': {
      // Test failed -> fail loopback
      const res = await fetch(`${missionControlUrl}/api/tasks/${session.task_id}/fail`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: summary }),
      });
      if (!res.ok) {
        console.error(`[Response Poller] TEST_FAIL loopback failed: ${await res.text()}`);
      } else {
        console.log(`[Response Poller] TEST_FAIL: task ${session.task_id} looped back`);
      }
      break;
    }

    case 'verify_pass': {
      // Verification passed -> done
      const res = await fetch(`${missionControlUrl}/api/tasks/${session.task_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'done' }),
      });
      if (!res.ok) {
        console.error(`[Response Poller] VERIFY_PASS status update failed: ${await res.text()}`);
      } else {
        console.log(`[Response Poller] VERIFY_PASS: task ${session.task_id} -> done`);
      }
      logActivity(session.task_id, session.agent_id, `Verification passed: ${summary}`);
      break;
    }

    case 'verify_fail': {
      // Verification failed -> fail loopback
      const res = await fetch(`${missionControlUrl}/api/tasks/${session.task_id}/fail`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: summary }),
      });
      if (!res.ok) {
        console.error(`[Response Poller] VERIFY_FAIL loopback failed: ${await res.text()}`);
      } else {
        console.log(`[Response Poller] VERIFY_FAIL: task ${session.task_id} looped back`);
      }
      break;
    }
  }

  // Set agent back to standby
  run('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?', ['standby', now, session.agent_id]);

  // Mark session as ended
  run(
    'UPDATE openclaw_sessions SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?',
    ['completed', now, now, session.session_id]
  );
}

/**
 * Log an activity entry for a task.
 */
function logActivity(taskId: string, agentId: string, message: string): void {
  run(
    `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
     VALUES (?, ?, ?, 'updated', ?, datetime('now'))`,
    [crypto.randomUUID(), taskId, agentId, message]
  );
}

/**
 * Poll all active sessions for new messages.
 * This is the core polling loop.
 */
async function pollActiveSessions(): Promise<void> {
  if (polling) return; // Prevent overlapping polls
  polling = true;

  try {
    const sessions = getActiveSessions();
    if (sessions.length === 0) return;

    console.log(`[Response Poller] Checking ${sessions.length} active session(s)`);

    for (const session of sessions) {
      try {
        const messages = await getMessagesFromOpenClaw(session.openclaw_session_id);
        const currentCount = messages.length;

        if (currentCount <= session.last_message_count) {
          // Safety fallback: check last assistant message for missed completion markers.
          // Handles edge cases where last_message_count was set too high (session reuse race condition).
          if (currentCount > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'assistant') {
              const completion = detectCompletion(lastMsg.content);
              if (completion) {
                console.log(`[Response Poller] Missed completion found in last message: ${completion.type} — "${completion.summary}"`);
                await handleCompletion(session, completion.type, completion.summary);
              }
            }
          }
          continue;
        }

        // New messages found
        const newMessages = messages.slice(session.last_message_count);
        console.log(`[Response Poller] ${newMessages.length} new message(s) for task ${session.task_id} (agent: ${session.agent_name})`);

        // Update message count
        run(
          'UPDATE openclaw_sessions SET last_message_count = ?, updated_at = datetime(\'now\') WHERE id = ?',
          [currentCount, session.session_id]
        );

        // Check each new message for completion markers
        let completionFound = false;
        for (const msg of newMessages) {
          const completion = detectCompletion(msg.content);
          if (completion) {
            console.log(`[Response Poller] Completion detected: ${completion.type} — "${completion.summary}"`);
            await handleCompletion(session, completion.type, completion.summary);
            completionFound = true;
            break; // Only handle first completion marker per poll cycle
          }
        }

        // If no completion but new messages, log agent activity update
        if (!completionFound) {
          const lastMsg = newMessages[newMessages.length - 1];
          const preview = lastMsg.content.length > 200
            ? lastMsg.content.substring(0, 200) + '...'
            : lastMsg.content;
          logActivity(session.task_id, session.agent_id, `Agent update: ${preview}`);

          // Broadcast so UI shows agent activity
          const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [session.task_id]);
          if (task) {
            broadcast({ type: 'task_updated', payload: task });
          }
        }
      } catch (err) {
        console.error(`[Response Poller] Error polling session ${session.session_id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Response Poller] Poll cycle error:', err);
  } finally {
    polling = false;
  }
}

/**
 * Start the background response poller.
 */
export function startResponsePoller(): void {
  if (!POLL_ENABLED) {
    console.log('[Response Poller] Disabled via RESPONSE_POLL_ENABLED=false');
    return;
  }

  if (pollTimer) {
    console.log('[Response Poller] Already running');
    return;
  }

  console.log(`[Response Poller] Starting (interval: ${POLL_INTERVAL_MS}ms)`);
  pollTimer = setInterval(pollActiveSessions, POLL_INTERVAL_MS);

  // Run once immediately
  pollActiveSessions().catch(err =>
    console.error('[Response Poller] Initial poll failed:', err)
  );
}

/**
 * Stop the background response poller.
 */
export function stopResponsePoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[Response Poller] Stopped');
  }
}

/**
 * Check if the poller is currently running.
 */
export function isPollerRunning(): boolean {
  return pollTimer !== null;
}

/**
 * Manually poll a single session (for the execution/poll endpoint).
 */
export async function pollSingleSession(taskId: string): Promise<{
  hasUpdates: boolean;
  messages: Array<{ role: string; content: string }>;
  isComplete: boolean;
  completionType?: string;
  summary?: string;
}> {
  const session = queryOne<ActiveSession>(
    `SELECT
       os.id as session_id,
       os.openclaw_session_id,
       os.agent_id,
       a.name as agent_name,
       os.task_id,
       t.status as task_status,
       COALESCE(os.last_message_count, 0) as last_message_count
     FROM openclaw_sessions os
     JOIN agents a ON os.agent_id = a.id
     JOIN tasks t ON os.task_id = t.id
     WHERE os.task_id = ?
       AND os.status = 'active'
     ORDER BY os.created_at DESC
     LIMIT 1`,
    [taskId]
  );

  if (!session) {
    return { hasUpdates: false, messages: [], isComplete: false };
  }

  const messages = await getMessagesFromOpenClaw(session.openclaw_session_id);
  const currentCount = messages.length;

  if (currentCount <= session.last_message_count) {
    return { hasUpdates: false, messages, isComplete: false };
  }

  const newMessages = messages.slice(session.last_message_count);

  // Update count
  run(
    'UPDATE openclaw_sessions SET last_message_count = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [currentCount, session.session_id]
  );

  // Check for completion
  for (const msg of newMessages) {
    const completion = detectCompletion(msg.content);
    if (completion) {
      await handleCompletion(session, completion.type, completion.summary);
      return {
        hasUpdates: true,
        messages,
        isComplete: true,
        completionType: completion.type,
        summary: completion.summary,
      };
    }
  }

  // New messages but no completion
  const lastMsg = newMessages[newMessages.length - 1];
  logActivity(
    session.task_id,
    session.agent_id,
    `Agent update: ${lastMsg.content.substring(0, 200)}${lastMsg.content.length > 200 ? '...' : ''}`
  );

  return { hasUpdates: true, messages, isComplete: false };
}
