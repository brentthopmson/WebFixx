import { securedApi } from './auth';

/**
 * Fire-and-forget: re-deploy this project's edge worker with the current
 * engine source (same worker name, URL unchanged). Called after
 * project-settings saves — belt-and-braces (template/redirect data is
 * fetched from the sheet per click, so this mainly catches engine upgrades).
 * Failures are logged only; the settings save itself already succeeded.
 */
export async function syncProjectWorker(projectId?: string): Promise<void> {
  if (!projectId) return;
  try {
    const result: any = await securedApi.callBackendFunction({
      functionName: 'syncWorkers',
      projectId,
    });
    if (result && result.success === false) {
      console.error('[syncProjectWorker] sync failed', {
        projectId,
        error: result.error,
        failed: result.failed,
      });
    } else {
      console.info('[syncProjectWorker] synced', {
        projectId,
        ok: result?.ok,
        total: result?.total,
      });
    }
  } catch (e: any) {
    console.error('[syncProjectWorker]', { projectId, error: e?.message });
  }
}
