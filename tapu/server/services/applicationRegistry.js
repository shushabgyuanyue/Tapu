import {
  buildApplicationLifecycleExtra,
  getManifestLifecycle,
} from './applicationLifecycle.js';
import { getAppManifests } from '../contracts/appManifests.js';
import { stringifyJson } from './coreStore.js';

const BUILT_IN_APPLICATIONS = [
  {
    name: '纸巾小狗',
    code: 'tissue-puppy',
    app_type: 'meaning',
    interaction_type: 'tap_to_comfort_ar',
    description: '触碰纸巾小狗，在现实画面里召唤一段温柔、克制的陪伴内容。',
  },
  {
    name: '桌面秘境',
    code: 'desktop-secret',
    app_type: 'meaning',
    interaction_type: 'tap_to_reveal_desktop_realm',
    description: '触碰桌面贴纸，打开摄像头，在桌面锚点上召唤一处悬浮小秘境。',
  },
];

const manifestByCode = new Map(getAppManifests().map(manifest => [manifest.code, manifest]));

export function getBuiltInApplications() {
  return BUILT_IN_APPLICATIONS;
}

export function ensureApplicationRegistry(db) {
  for (const app of BUILT_IN_APPLICATIONS) {
    const manifest = manifestByCode.get(app.code);
    const lifecycle = getManifestLifecycle(manifest);
    db.run(
      `INSERT INTO application_definitions
       (id, name, code, version_no, app_type, interaction_type, description, extra_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         name = excluded.name,
         version_no = excluded.version_no,
         app_type = excluded.app_type,
         interaction_type = excluded.interaction_type,
         description = excluded.description,
         extra_json = excluded.extra_json,
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
      [
        app.code,
        app.name,
        app.code,
        lifecycle.activeVersion,
        app.app_type,
        app.interaction_type,
        app.description,
        stringifyJson(buildApplicationLifecycleExtra(manifest)),
        lifecycle.status,
      ]
    );
  }
}
