import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { pollSingleSession } from '@/lib/openclaw/response-poller';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/[id]/execution/poll
 *
 * Manual poll endpoint for a single task's execution session.
 * Checks OpenClaw Gateway for new agent messages and handles
 * completion markers (TASK_COMPLETE, TEST_PASS, etc.).
 *
 * Returns:
 * - hasUpdates: boolean — whether new messages were found
 * - messages: array — all session messages
 * - isComplete: boolean — whether a completion marker was detected
 * - completionType: string — type of completion (if complete)
 * - summary: string — completion summary (if complete)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const result = await pollSingleSession(taskId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Execution Poll] Error:', error);
    return NextResponse.json(
      { error: 'Failed to poll execution session' },
      { status: 500 }
    );
  }
}
