import { registerKauvioLiveAiSearch } from './kauvio_live_ai_search.mjs';

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

export function getKauvioServerActivationConfig(env = process.env) {
  return {
    enabled: parseBoolean(env.KAUVIO_AI_SEARCH_ENABLED, true),
    registerSearchAlias: parseBoolean(env.KAUVIO_AI_SEARCH_ALIAS_ENABLED, true),
  };
}

export async function activateKauvioServerFeatures(app, options = {}) {
  const {
    env = process.env,
    logger = console,
  } = options;

  const envConfig = getKauvioServerActivationConfig(env);
  const enabled = options.enabled ?? envConfig.enabled;
  const registerSearchAlias = options.registerSearchAlias ?? envConfig.registerSearchAlias;

  const aiSearch = await registerKauvioLiveAiSearch(app, {
    ...options,
    logger,
    enabled,
    registerSearchAlias,
  });

  return {
    aiSearch,
    config: {
      enabled,
      registerSearchAlias,
    },
  };
}

export default {
  getKauvioServerActivationConfig,
  activateKauvioServerFeatures,
};
