export const APP_TYPES = ['meaning', 'behavior', 'state'];

export const CONTENT_CONTAINER_CAPABILITIES = [
  'text',
  'image',
  'video',
  'audio',
  'link',
  'mixed',
  'interactive',
  'ar',
];

const ACTIVE_APP_LIFECYCLE = {
  status: 'active',
  version: '1.0.0',
  rollout: 'stable',
};

export const APPLICATION_MANIFESTS = [
  {
    code: 'tissue-puppy',
    lifecycle: ACTIVE_APP_LIFECYCLE,
    type: 'meaning',
    objectPrinciple: 'A tissue puppy carries gentle comfort through a physical object and one focused content node.',
    behavior: 'touch_to_summon_comfort_companion',
    meaningQuestion: 'What small comfort should this puppy bring into the room?',
    defaultRoutes: {
      open: '/play',
      studio: '/mint-studio',
      admin: '/official/applications',
    },
    mintStudio: {
      profile: 'tissue-puppy',
      primaryActions: ['open_preview', 'save_definition_content_by_token', 'set_entity_default_content', 'claim_entity'],
    },
    permissionOperations: ['view:open', 'view:preview', 'content:token_update', 'content:entity_default_set', 'content:account_create', 'asset:claim'],
    operationDefinitions: [
      {
        key: 'object.touch',
        label: 'Touch Tissue Puppy',
        meaning: 'A user touched or opened the tissue puppy object.',
      },
    ],
    eventRules: [
      {
        eventType: 'comfort.frequent_touch',
        sourceOperations: ['object.touch'],
        windowHours: 24,
        countGte: 10,
        meaningFocus: 'comfort',
      },
    ],
    producesStates: [
      {
        key: 'comfort.action_active',
        category: 'comfort',
        fromEvents: ['comfort.frequent_touch'],
        meaning: 'This tissue puppy is being used as active comfort or companionship.',
      },
    ],
    contentDefinition: {
      id: 'content-def-tissue-puppy-comfort-video',
      code: 'tissue-puppy-comfort-ar',
      name: '纸巾小狗 AR 召唤',
      description: '为纸巾小狗创建一个 AR 召唤内容节点，触碰后在现实画面里出现一段温柔陪伴。',
      contentKind: 'ar',
      primaryModality: 'video',
      authoringSchema: {
        authoringProtocol: {
          createFlow: 'single_resource_node',
          unitLabel: 'AR 召唤节点',
          publishLabel: '完成铸造',
          publishDescription: '生成纸巾小狗的 AR 内容资产，之后可在内容详情页预览和修改。',
        },
        contentShape: {
          unit: 'comfort_ar_node',
          slots: [
            {
              key: 'comfort_ar_overlay',
              role: 'ar_overlay',
              type: 'video',
              label: 'AR 召唤视频',
              required: true,
              accept: 'video/*',
              resourceProfile: 'ar_alpha_overlay',
              requiresAlpha: true,
            },
          ],
        },
        resourceRequirements: [
          {
            role: 'ar_overlay',
            type: 'video',
            label: 'AR 召唤视频',
            required: true,
            resourceProfile: 'ar_alpha_overlay',
            requiresAlpha: true,
          },
        ],
      },
      template: {
        renderer: 'ar.camera-overlay',
        layout: 'camera_center_overlay',
        nodeType: 'comfort_ar_overlay',
        playback: {
          autoplay: true,
          mutedByDefault: true,
          tapToUnmute: true,
          loop: true,
          replayMode: 'loop',
          objectFit: 'contain',
        },
        ar: {
          mode: 'camera_overlay',
          placement: 'screen_center',
          scale: 0.72,
          cameraFacingMode: 'environment',
          fallbackRenderer: 'video.fullscreen',
        },
      },
      extra: {
        toneRule: '成熟克制、温柔但不煽情，像纸巾小狗递来一张纸。',
      },
    },
    contentContainer: {
      capabilities: ['ar', 'video'],
      defaultModality: 'video',
    },
    entryPrompts: {
      nfc_player: {
        unbound: {
          display: 'bottom_card',
          frequency: 'once_per_token',
        },
        bound: {
          display: 'corner_link',
          frequency: 'always',
        },
      },
    },
  },
  {
    code: 'desktop-secret',
    lifecycle: ACTIVE_APP_LIFECYCLE,
    type: 'meaning',
    objectPrinciple: 'A desktop sticker turns an ordinary desk into a small AR realm anchored in the camera view.',
    behavior: 'tap_to_reveal_desktop_realm',
    meaningQuestion: 'What quiet landscape should appear on this desk right now?',
    defaultRoutes: {
      open: '/play',
      studio: '/mint-studio',
      admin: '/official/applications',
    },
    mintStudio: {
      profile: 'desktop-secret',
      primaryActions: ['open_preview', 'save_definition_content_by_token', 'set_entity_default_content', 'claim_entity'],
    },
    permissionOperations: ['view:open', 'view:preview', 'content:token_update', 'content:entity_default_set', 'content:account_create', 'asset:claim'],
    operationDefinitions: [
      {
        key: 'object.touch',
        label: 'Touch Desktop Secret',
        meaning: 'A user touched a desktop sticker to reveal an AR realm.',
      },
    ],
    eventRules: [
      {
        eventType: 'realm.repeated_reveal',
        sourceOperations: ['object.touch'],
        windowHours: 24,
        countGte: 6,
        meaningFocus: 'space',
      },
    ],
    contentDefinition: {
      id: 'content-def-desktop-secret-ar-realm',
      code: 'desktop-secret-ar-realm',
      name: '桌面秘境 AR 场景',
      description: '为桌面秘境创建一个 AR 图片模型节点，触碰贴纸后在摄像头画面里打开一处悬浮小秘境。',
      contentKind: 'ar',
      primaryModality: 'image',
      authoringSchema: {
        authoringProtocol: {
          createFlow: 'single_resource_node',
          unitLabel: 'AR 秘境节点',
          publishLabel: '完成铸造',
          publishDescription: '生成桌面秘境的 AR 内容资产，之后可在内容详情页预览和替换素材。',
        },
        contentShape: {
          unit: 'desktop_realm_ar_node',
          slots: [
            {
              key: 'realm_ar_model',
              role: 'ar_overlay',
              type: 'image',
              label: 'AR 秘境模型图',
              required: true,
              accept: 'image/png,image/webp,image/jpeg',
              resourceProfile: 'ar_image_overlay',
            },
          ],
        },
        resourceRequirements: [
          {
            role: 'ar_overlay',
            type: 'image',
            label: 'AR 秘境模型图',
            required: true,
            resourceProfile: 'ar_image_overlay',
          },
        ],
      },
      template: {
        renderer: 'ar.camera-overlay',
        layout: 'marker_anchor_overlay',
        nodeType: 'desktop_realm_ar_overlay',
        playback: {
          autoplay: true,
          mutedByDefault: true,
          tapToUnmute: false,
          loop: true,
          replayMode: 'loop',
          objectFit: 'contain',
        },
        ar: {
          mode: 'marker_overlay',
          engine: 'mindar-image-tracking',
          placement: 'marker_anchor',
          tracking: 'marker_image',
          markerImageUrl: '/ar-placeholders/desktop-secret-marker.png',
          scale: 0.58,
          cameraFacingMode: 'environment',
          shadow: true,
          perspective: true,
          fallbackRenderer: 'image.single',
        },
      },
      extra: {
        toneRule: '安静、神秘、克制，像桌面上悄悄出现一片远处的雪山。',
      },
    },
    contentContainer: {
      capabilities: ['ar', 'image'],
      defaultModality: 'image',
    },
    entryPrompts: {
      nfc_player: {
        unbound: {
          display: 'bottom_card',
          frequency: 'once_per_token',
        },
        bound: {
          display: 'corner_link',
          frequency: 'always',
        },
      },
    },
  },
];

export function getAppManifests() {
  return APPLICATION_MANIFESTS;
}

export function findAppManifest(code) {
  return APPLICATION_MANIFESTS.find(app => app.code === code) || null;
}
