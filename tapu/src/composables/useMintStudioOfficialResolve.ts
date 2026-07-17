import type { Ref } from 'vue';
import {
  resolveOfficialIpStudio,
  type MintStudioRecipe,
} from '../api';
import { studioCopy } from '../copy';

export function useMintStudioOfficialResolve(params: {
  phase: Ref<string>;
  addMessage: (role: 'assistant' | 'user', text: string) => void;
  applyResolvedStudio: (result: MintStudioRecipe, query: Record<string, string>) => void;
}) {
  async function resolveOfficialStudioByIpDefinitionId(ipDefinitionId: string, announce = false) {
    const id = ipDefinitionId.trim();
    if (!id) return;

    params.phase.value = 'resolving';
    if (announce) params.addMessage('user', studioCopy.sidebar.newMint);

    let result: MintStudioRecipe;
    try {
      result = await resolveOfficialIpStudio(id);
    } catch {
      params.phase.value = 'token';
      params.addMessage('assistant', studioCopy.messages.resolveFailed);
      return;
    }

    if ((result as any).error) {
      params.phase.value = 'token';
      params.addMessage('assistant', [String((result as any).error || ''), String((result as any).hint || '')].filter(Boolean).join(' '));
      return;
    }

    params.applyResolvedStudio(result, { official_ip_definition_id: id });
  }

  return { resolveOfficialStudioByIpDefinitionId };
}
