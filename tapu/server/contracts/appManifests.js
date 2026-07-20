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

export const APPLICATION_MANIFESTS = [
  {
    code: 'emotion-ip',
    type: 'meaning',
    objectPrinciple: 'A physical IP figure carries a relationship or emotional expression.',
    behavior: 'touch_to_receive_emotional_content',
    meaningQuestion: 'What feeling do I want to express or receive?',
    defaultRoutes: {
      open: '/play',
      studio: '/mint-studio',
      admin: '/official/applications',
    },
    mintStudio: {
      profile: 'entity-recipe',
      primaryActions: ['open_preview', 'save_definition_content_by_token', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'view:preview', 'content:token_update', 'content:account_create', 'asset:claim'],
    operationDefinitions: [
      {
        key: 'object.touch',
        label: 'Touch Object',
        meaning: 'A user touched or opened the emotional IP object.',
      },
    ],
    eventRules: [
      {
        eventType: 'emotion.frequent_touch',
        sourceOperations: ['object.touch'],
        windowHours: 24,
        countGte: 10,
        relationFocus: 'comfort',
      },
    ],
    producesStates: [
      {
        key: 'comfort.action_active',
        category: 'comfort',
        fromEvents: ['emotion.frequent_touch'],
        meaning: 'This object is being used as active comfort or companionship.',
      },
      {
        key: 'companion.used_30_days',
        category: 'companion',
        fromEvents: ['emotion.long_term_companion'],
        meaning: 'This Mint has become a long-running companion.',
      },
    ],
    skills: [
      {
        key: 'comfort_delivery',
        label: 'Comfort Delivery',
        meaning: 'Can bring a small emotional response into another Mint experience.',
      },
    ],
    contentContainer: {
      capabilities: ['video', 'image', 'text', 'mixed'],
      defaultModality: 'video',
    },
  },
  {
    code: 'tissue-puppy',
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
      primaryActions: ['open_preview', 'save_definition_content_by_token', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'view:preview', 'content:token_update', 'content:account_create', 'asset:claim'],
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
        relationFocus: 'comfort',
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
            },
          ],
        },
        resourceRequirements: [
          {
            role: 'ar_overlay',
            type: 'video',
            label: 'AR 召唤视频',
            required: true,
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
  },
  {
    code: 'earphone-girl',
    type: 'meaning',
    objectPrinciple: 'An earphone sticker opens a traveler-listener who brings back stories from the IP world.',
    behavior: 'touch_to_listen_then_follow_story',
    meaningQuestion: 'Whose story did she bring back today?',
    defaultRoutes: {
      open: '/earphone-girl',
      studio: '/mint-studio',
      admin: '/official/applications',
    },
    mintStudio: {
      profile: 'earphone-girl',
      primaryActions: ['open_app', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'app:token_operate', 'asset:claim', 'asset:owner_manage'],
    operationDefinitions: [
      {
        key: 'object.touch',
        label: 'Touch Earphone Girl',
        meaning: 'A user opened Earphone Girl story space.',
      },
      {
        key: 'story.play_completed',
        label: 'Story Completed',
        meaning: 'A story was completed and the instance sequence can advance.',
      },
    ],
    skills: [
      {
        key: 'repeat_touch_crossover_invite',
        label: 'Crossover Invite',
        trigger: {
          events: ['object.touch'],
        },
        effect: {
          actionType: 'show_gateway',
          contentAssembly: 'earphone_girl_crossover_invite',
          role: 'crossover',
        },
      },
    ],
    contentContainer: {
      capabilities: ['text', 'image', 'audio', 'mixed', 'link'],
      defaultModality: 'mixed',
    },
  },
  {
    code: 'answer-book',
    type: 'state',
    objectPrinciple: 'A touched object returns a restrained answer for the current inner state.',
    behavior: 'touch_to_receive_answer',
    meaningQuestion: 'What answer do I need right now?',
    defaultRoutes: {
      open: '/answer',
      studio: '/mint-studio',
      admin: '/official/answer-book',
    },
    mintStudio: {
      profile: 'answer-book',
      primaryActions: ['open_app', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'asset:claim', 'asset:owner_manage'],
    contentContainer: {
      capabilities: ['text', 'image'],
      defaultModality: 'text',
    },
  },
  {
    code: 'moment',
    type: 'meaning',
    objectPrinciple: 'A concrete keepsake preserves one moment worth returning to.',
    behavior: 'touch_to_revisit_saved_moment',
    meaningQuestion: 'Which moment do I want to keep?',
    defaultRoutes: {
      open: '/moment',
      studio: '/mint-studio',
      admin: '/official/moments',
    },
    mintStudio: {
      profile: 'moment',
      primaryActions: ['open_app', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'content:token_update', 'asset:claim', 'asset:owner_manage'],
    contentContainer: {
      capabilities: ['text', 'image', 'video', 'mixed'],
      defaultModality: 'mixed',
    },
  },
  {
    code: 'travel-trail',
    type: 'state',
    objectPrinciple: 'A moving object such as luggage becomes the carrier of a life journey.',
    behavior: 'touch_before_departure_or_after_return',
    meaningQuestion: 'Which journey am I opening or adding to my life?',
    defaultRoutes: {
      open: '/trail',
      studio: '/mint-studio',
      admin: '/official/travel-trails',
    },
    mintStudio: {
      profile: 'travel-trail',
      primaryActions: ['open_app', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'app:token_operate', 'asset:claim', 'asset:owner_manage'],
    contentContainer: {
      capabilities: ['text', 'interactive', 'mixed'],
      defaultModality: 'interactive',
    },
  },
  {
    code: 'check',
    type: 'behavior',
    objectPrinciple: 'A specific object exposes the checklist needed before using or moving it.',
    behavior: 'touch_to_check_before_action',
    meaningQuestion: 'What should be checked before this object leaves with me?',
    defaultRoutes: {
      open: '/check',
      studio: '/mint-studio',
      admin: '/official/checks',
    },
    mintStudio: {
      profile: 'check',
      primaryActions: ['open_app', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'app:token_operate', 'asset:claim', 'asset:owner_manage'],
    contentContainer: {
      capabilities: ['text', 'interactive'],
      defaultModality: 'interactive',
    },
  },
];

export function getAppManifests() {
  return APPLICATION_MANIFESTS;
}

export function findAppManifest(code) {
  return APPLICATION_MANIFESTS.find(app => app.code === code) || null;
}
