import { computed, type Ref } from 'vue';
import {
  bindAssetInstance,
  isLoggedIn,
  setIpInstanceContentByToken,
  type MintStudioRecipe,
} from '../api';
import { studioCopy } from '../copy';

type Toast = { show: (text: string, duration?: number, type?: string) => void };
type MessageRole = 'assistant' | 'user';

export function useMintStudioEntityConnection(params: {
  studio: Ref<MintStudioRecipe | null>;
  phase: Ref<string>;
  isEntityStudio: Ref<boolean>;
  assetBound: Ref<boolean>;
  mintedContentId: Ref<string>;
  pendingLoginAction: Ref<string>;
  showLogin: Ref<boolean>;
  toast?: Toast;
  addMessage: (role: MessageRole, text: string) => void;
}) {
  const canConnectEntity = computed(() => (
    params.isEntityStudio.value
    && (!params.assetBound.value || !!params.mintedContentId.value)
  ));
  const connectEntityLabel = computed(() => (
    params.mintedContentId.value
      ? studioCopy.actions.setEntityDefaultContent
      : studioCopy.actions.claimEntity
  ));

  async function connectEntity() {
    const studio = params.studio.value;
    if (!studio || params.phase.value === 'saving') return;
    if (!isLoggedIn()) {
      params.pendingLoginAction.value = 'connect_entity';
      params.showLogin.value = true;
      return;
    }

    params.phase.value = 'saving';
    params.addMessage('user', params.mintedContentId.value
      ? studioCopy.messages.setEntityDefaultContent
      : studioCopy.messages.claimEntity);

    if (params.mintedContentId.value) {
      const result = await setIpInstanceContentByToken(studio.token.token, params.mintedContentId.value);
      params.phase.value = 'done';
      if (!result.success) {
        params.addMessage('assistant', result.error || studioCopy.messages.entityDefaultContentFailed);
        return;
      }

      params.assetBound.value = true;
      params.mintedContentId.value = '';
      params.addMessage('assistant', studioCopy.messages.entityDefaultContentSet);
      params.toast?.show(studioCopy.toast.entityConnected, 1600, 'success');
      return;
    }

    const result = await bindAssetInstance(studio.token.token);
    params.phase.value = 'done';
    if (!result.success) {
      params.addMessage('assistant', result.error || studioCopy.messages.claimEntityFailed);
      return;
    }

    params.assetBound.value = true;
    params.addMessage('assistant', studioCopy.messages.entityClaimed);
    params.toast?.show(studioCopy.toast.entityConnected, 1600, 'success');
  }

  return {
    canConnectEntity,
    connectEntityLabel,
    connectEntity,
  };
}
