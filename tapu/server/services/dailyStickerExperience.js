import { resultToObjects } from './tokens.js';
import { upsertMeaningfulState } from './contentOperation.js';

export function assembleDailyStickerExperience(blocks, runtimeContext = {}) {
  const hasGuestCharacterStory = runtimeContext.unlockedSkills?.some(skill => skill.key === 'guest_character_story');
  if (!hasGuestCharacterStory) return blocks;

  const comfortState = runtimeContext.states?.find(state => state.key === 'comfort.action_active');
  const sourceLabel = comfortState?.sourceObjectLabel || '纸巾小狗';
  const crossoverBlock = {
    id: 'content-operation-guest-character-story',
    kind: 'card',
    role: 'crossover',
    tag: '联动剧情',
    title: `${sourceLabel}来过`,
    body: `今天遇到了${sourceLabel}。\n它说，最近好像有人需要一点安慰，所以带来了一张特别的纸巾。`,
    caption: '你的 Mint 之间开始认识彼此。',
    emphasis: 'quiet',
    metadata: {
      operation: 'guest_character_story',
      sourceState: comfortState?.key,
      sourceAppCode: comfortState?.sourceAppCode,
    },
  };

  const insertAt = Math.min(2, blocks.length);
  return [...blocks.slice(0, insertAt), crossoverBlock, ...blocks.slice(insertAt)];
}

export function ensureDailyStickerExperienceDemoSeed(db) {
  const tokenRow = resultToObjects(db.exec(
    `SELECT id, token, label FROM daily_sticker_tokens
     WHERE id = ? OR label LIKE ?
     ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    ['seed-jasmine-rain-earphones-token', '%耳机小姐%', 'seed-jasmine-rain-earphones-token']
  ))[0] || null;
  if (!tokenRow) return;

  upsertMeaningfulState(db, {
    id: 'seed-content-operation-earphones-comfort-state',
    stateKey: 'comfort.action_active',
    subjectType: 'object',
    subjectId: tokenRow.id,
    subjectToken: tokenRow.token,
    sourceAppCode: 'emotion-ip',
    sourceObjectType: 'mint-entity',
    sourceObjectId: 'seed-tissue-puppy-demo',
    sourceObjectLabel: '纸巾小狗',
    category: 'comfort',
    strength: 15,
    evidence: {
      taps_7d: 15,
      active_period: 'evening',
      sample: true,
    },
  });
}
