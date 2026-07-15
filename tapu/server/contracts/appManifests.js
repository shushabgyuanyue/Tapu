export const APP_TYPES = ['meaning', 'behavior', 'state'];

export const CONTENT_CONTAINER_CAPABILITIES = [
  'text',
  'image',
  'video',
  'audio',
  'link',
  'mixed',
  'interactive',
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
      primaryActions: ['open_preview', 'use_current_content', 'upload_custom_video', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'view:preview', 'content:token_update', 'content:account_create', 'asset:claim'],
    producesStates: [
      {
        key: 'comfort.action_active',
        category: 'comfort',
        fromEvents: ['tap_open', 'emotion_content_tap', 'media_play'],
        meaning: 'This object is being used as active comfort or companionship.',
      },
      {
        key: 'companion.used_30_days',
        category: 'companion',
        fromEvents: ['tap_open', 'emotion_content_tap'],
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
    code: 'daily-sticker',
    type: 'state',
    objectPrinciple: 'A sticker opens a small slow world that updates over time.',
    behavior: 'touch_to_read_today_story',
    meaningQuestion: 'How does this small world accompany this moment?',
    defaultRoutes: {
      open: '/sticker',
      studio: '/mint-studio',
      admin: '/official/daily-stickers',
    },
    mintStudio: {
      profile: 'daily-sticker',
      primaryActions: ['open_app', 'collect_asset'],
    },
    permissionOperations: ['view:open', 'asset:claim', 'asset:owner_manage'],
    producesStates: [
      {
        key: 'story.returning_touch',
        category: 'continuity',
        fromEvents: ['daily_sticker_tap'],
        meaning: 'The user keeps returning to this slow story world.',
      },
    ],
    skills: [
      {
        key: 'guest_character_story',
        label: 'Guest Character Story',
        trigger: {
          states: ['comfort.action_active'],
        },
        effect: {
          contentAssembly: 'daily_sticker_guest_character_story',
          role: 'crossover',
        },
      },
    ],
    contentContainer: {
      capabilities: ['text', 'image', 'mixed'],
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
      primaryActions: ['open_app', 'save_moment_by_token', 'collect_asset'],
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
