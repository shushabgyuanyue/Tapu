import { mintStudioCopy } from '../copy/studio.js';
import { parseJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function normalizeAuthoringFields(schema) {
  return (schema?.fields || []).map(field => (
    typeof field === 'string'
      ? { key: field, label: field, prompt: `补充 ${field}。`, required: false }
      : field
  )).filter(field => field?.key);
}

export function getApplicationContentDefinitionGuides(db, applicationDefinitionId) {
  if (!applicationDefinitionId) return [];
  return resultToObjects(db.exec(
    `SELECT d.*, l.relation_role, l.is_primary, l.sort_order
     FROM application_content_definition_links l
     JOIN content_definitions d ON d.id = l.content_definition_id
     WHERE l.application_definition_id = ?
       AND d.status = 'active'
     ORDER BY l.is_primary DESC, l.sort_order ASC, d.created_at ASC`,
    [applicationDefinitionId]
  )).map(row => {
    const authoringSchema = parseJson(row.authoring_schema_json, {});
    const template = parseJson(row.template_json, {});
    const extra = parseJson(row.extra_json, {});
    const fields = normalizeAuthoringFields(authoringSchema);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      relationRole: row.relation_role,
      isPrimary: Boolean(row.is_primary),
      fields,
      resources: authoringSchema.resourceRequirements || [],
      authoringProtocol: authoringSchema.authoringProtocol || null,
      contentShape: authoringSchema.contentShape || authoringSchema.authoringProtocol?.contentShape || null,
      renderer: template.renderer || '',
      layout: template.layout || '',
      toneRule: extra.toneRule || '',
    };
  }).filter(guide => (
    guide.fields.length
    || guide.resources.length
    || guide.authoringProtocol
    || guide.contentShape
  ));
}

export function buildDefinitionDrivenStudioFlow(contentGuides) {
  if (!contentGuides.length) return null;
  const primaryGuide = contentGuides.find(item => item.isPrimary) || contentGuides[0];
  if (primaryGuide.authoringProtocol?.createFlow === 'repeatable_resource_sequence') {
    const slots = primaryGuide.contentShape?.slots || primaryGuide.resources.map(resource => ({
      key: resource.role,
      role: resource.role,
      type: resource.type,
      label: resource.label || resource.role,
      required: !!resource.required,
      accept: resource.type === 'audio' ? 'audio/*' : (resource.type === 'image' ? 'image/*' : '*/*'),
    }));
    const buildUnitSteps = unitIndex => slots.map(slot => ({
      id: `unit_${unitIndex}_${slot.key}`,
      type: 'resource_upload',
      unitIndex,
      slotKey: slot.key,
      relationRole: slot.role || slot.key,
      resourceType: slot.type || 'file',
      accept: slot.accept || (slot.type === 'audio' ? 'audio/*' : (slot.type === 'image' ? 'image/*' : '*/*')),
      label: slot.label || slot.key,
      prompt: mintStudioCopy.definitionFlow.uploadResourcePrompt(
        primaryGuide.authoringProtocol.unitLabel || mintStudioCopy.definitionFlow.defaultUnitLabel,
        unitIndex,
        slot.label || slot.key
      ),
      required: slot.required !== false,
    }));

    return {
      kind: 'definition_resource_sequence',
      source: 'content_definitions',
      submitAction: 'save_definition_content_by_token',
      contentDefinitionId: primaryGuide.id,
      contentDefinitionCode: primaryGuide.code,
      contentTitle: primaryGuide.name,
      unitTemplate: {
        unitName: primaryGuide.contentShape?.unit || 'story_page',
        unitLabel: primaryGuide.authoringProtocol.unitLabel || '第 {index} 段故事',
        slots,
      },
      steps: [
        ...buildUnitSteps(1),
        {
          id: 'continue_or_publish',
          type: 'choice',
          prompt: primaryGuide.authoringProtocol.continuePrompt || mintStudioCopy.definitionFlow.continuePrompt,
          options: [
            {
              id: 'append_unit',
              label: primaryGuide.authoringProtocol.appendLabel || mintStudioCopy.definitionFlow.appendLabel,
              description: mintStudioCopy.definitionFlow.appendDescription,
              action: 'append_unit',
            },
            {
              id: 'publish_definition_content',
              label: primaryGuide.authoringProtocol.publishLabel || mintStudioCopy.definitionFlow.publishLabel,
              description: mintStudioCopy.definitionFlow.publishDescription,
              action: 'publish_definition_content',
            },
          ],
        },
      ],
    };
  }

  const requiredFields = primaryGuide.fields.filter(field => field.required).slice(0, 4);
  const resourceCopy = primaryGuide.resources.length
    ? primaryGuide.resources.map(resource => `${resource.label || resource.role}${resource.required ? '（必需）' : '（可选）'}`).join('、')
    : mintStudioCopy.definitionFlow.resourceFallback;

  return {
    kind: 'definition_driven',
    source: 'content_definitions',
    submitAction: 'continue_guidance',
    steps: [
      {
        id: 'content_definition',
        type: 'choice',
        prompt: mintStudioCopy.definitionFlow.chooseContentDefinition,
        options: contentGuides.map(guide => ({
          id: guide.code,
          label: guide.name,
          description: guide.description || guide.toneRule || mintStudioCopy.definitionFlow.continueByDefinition,
          action: 'continue_guidance',
        })),
      },
      ...requiredFields.map(field => ({
        id: `field_${field.key}`,
        type: 'text',
        answerKey: field.key,
        prompt: field.prompt || `补充${field.label || field.key}。`,
        placeholder: field.label || field.key,
        required: !!field.required,
      })),
      {
        id: 'resource_plan',
        type: 'text',
        answerKey: 'resourcePlan',
        prompt: mintStudioCopy.definitionFlow.resourcePlanPrompt(resourceCopy),
        placeholder: mintStudioCopy.definitionFlow.resourcePlanPlaceholder,
        optional: true,
      },
    ],
  };
}
