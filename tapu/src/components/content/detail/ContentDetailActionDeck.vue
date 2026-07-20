<script setup lang="ts">
import { contentCopy } from '../../../copy';

defineProps<{
  entityToken: string;
  entityBinding: boolean;
  entityBindMsg: string;
  entityBindError: boolean;
  officialBinding: boolean;
  officialDefaultSet: boolean;
  officialBindMsg: string;
  officialBindError: boolean;
  deleting: boolean;
  canEdit: boolean;
  canBindToEntity: boolean;
  canSetOfficialDefault: boolean;
  canDelete: boolean;
  isSingleResource: boolean;
}>();

defineEmits<{
  (event: 'update:entityToken', value: string): void;
  (event: 'edit'): void;
  (event: 'bind-entity'): void;
  (event: 'set-official-default'): void;
  (event: 'delete'): void;
}>();
</script>

<template>
  <div class="operation-panel">
    <section v-if="canBindToEntity" class="operation-hero">
      <div class="operation-copy">
        <span>{{ contentCopy.detail.entityBind.eyebrow }}</span>
        <strong>{{ contentCopy.detail.entityBind.title }}</strong>
        <p>{{ contentCopy.detail.entityBind.body }}</p>
      </div>
      <div class="entity-bind-row">
        <input
          :value="entityToken"
          :placeholder="contentCopy.detail.entityBind.placeholder"
          @input="$emit('update:entityToken', ($event.target as HTMLInputElement).value)"
          @keyup.enter="$emit('bind-entity')"
        />
        <button class="act-btn act-btn-bind" :disabled="entityBinding" @click="$emit('bind-entity')">
          {{ entityBinding ? contentCopy.detail.entityBind.binding : contentCopy.detail.entityBind.action }}
        </button>
      </div>
      <p v-if="entityBindMsg" :class="['detail-action-hint', { 'detail-action-hint--error': entityBindError }]">
        {{ entityBindMsg }}
      </p>
    </section>

    <div class="operation-paths">
      <button v-if="canEdit" type="button" class="path-entry" @click="$emit('edit')">
        <small>01</small>
        <span>
          <strong>{{ isSingleResource ? contentCopy.detail.actions.replaceResource : contentCopy.detail.actions.revise }}</strong>
          <em>{{ contentCopy.detail.actions.manageHint }}</em>
        </span>
      </button>

      <button
        v-if="canSetOfficialDefault"
        type="button"
        class="path-entry path-entry--official"
        :disabled="officialBinding || officialDefaultSet"
        @click="$emit('set-official-default')"
      >
        <small>02</small>
        <span>
          <strong>
            {{
              officialBinding
                ? contentCopy.detail.officialDefault.setting
                : (officialDefaultSet ? contentCopy.detail.officialDefault.setDone : contentCopy.detail.officialDefault.set)
            }}
          </strong>
          <em>{{ contentCopy.detail.officialDefault.body }}</em>
        </span>
      </button>

      <button
        v-if="canDelete"
        type="button"
        class="path-entry path-entry--danger"
        :disabled="deleting"
        @click="$emit('delete')"
      >
        <small>99</small>
        <span>
          <strong>{{ deleting ? contentCopy.detail.actions.deleting : contentCopy.detail.actions.delete }}</strong>
          <em>{{ contentCopy.detail.actions.deleteHint }}</em>
        </span>
      </button>
    </div>

    <p
      v-if="canSetOfficialDefault && officialBindMsg"
      :class="['detail-action-hint', { 'detail-action-hint--error': officialBindError }]"
    >
      {{ officialBindMsg }}
    </p>
  </div>
</template>
