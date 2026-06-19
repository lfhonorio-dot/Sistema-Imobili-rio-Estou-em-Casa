'use client';
import { useAuthStore } from '@/stores/auth.store';

export function useWorkspace() {
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  return { workspaceId: currentWorkspaceId, workspace: currentWorkspace };
}
