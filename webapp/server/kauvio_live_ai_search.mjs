import { registerKauvioAiSearchRoutes } from './kauvio_ai_search_routes.mjs';
import { registerKauvioPriceAwareSearchRoutes } from './kauvio_price_aware_search_routes.mjs';
import { createKauvioProductProvider } from './kauvio_product_provider.mjs';

const DEFAULT_DATABASE_ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
];

function readDatabaseUrl(env = process.env, keys = DEFAULT_DATABASE_ENV_KEYS) {
  for (const key of keys) {
    const value = env?.[key];
    if (typeof value === 'string' && value.trim()) {
      return { key, value: value.trim() };
    }
  }
  return null;
}

async function importPg() {
  try {
    return await import('pg');
  } catch (error) {
    const wrapped = new Error('Kauvio live AI search requires the pg package when no pool is provided. Install pg or pass an existing pool.');
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function createKauvioLiveAiSearchDependencies(options = {}) {
  const {
    pool,
    env = process.env,
    logger = console,
    databaseEnvKeys = DEFAULT_DATABASE_ENV_KEYS,
    poolOptions = {},
  } = options;

  if (pool) {
    return {
      pool,
      ownsPool: false,
      databaseEnvKey: null,
      productProvider: createKauvioProductProvider({ pool, logger }),
    };
  }

  const databaseUrl = readDatabaseUrl(env, databaseEnvKeys);
  if (!databaseUrl) {
    logger.warn?.('Kauvio live AI search is not enabled: no database URL found.', {
      checked: databaseEnvKeys,
    });
    return {
      pool: null,
      ownsPool: false,
      databaseEnvKey: null,
      productProvider: null,
      disabledReason: 'missing_database_url',
    };
  }

  const pg = await importPg();
  const Pool = pg.Pool ?? pg.default?.Pool;
  if (!Pool) {
    throw new Error('Could not load pg.Pool for Kauvio live AI search.');
  }

  const createdPool = new Pool({
    connectionString: databaseUrl.value,
    max: Number.parseInt(env.KAUVIO_AI_SEARCH_DB_POOL_MAX ?? '5', 10),
    idleTimeoutMillis: Number.parseInt(env.KAUVIO_AI_SEARCH_DB_IDLE_MS ?? '30000', 10),
    connectionTimeoutMillis: Number.parseInt(env.KAUVIO_AI_SEARCH_DB_CONNECT_MS ?? '5000', 10),
    ...poolOptions,
  });

  return {
    pool: createdPool,
    ownsPool: true,
    databaseEnvKey: databaseUrl.key,
    productProvider: createKauvioProductProvider({ pool: createdPool, logger }),
  };
}

export async function registerKauvioLiveAiSearch(app, options = {}) {
  const {
    logger = console,
    registerSearchAlias = true,
    registerPriceSearch = true,
    enabled = true,
  } = options;

  if (!enabled) {
    logger.info?.('Kauvio live AI search registration skipped: disabled by option.');
    return {
      enabled: false,
      reason: 'disabled_by_option',
      handler: null,
      priceHandler: null,
      pool: null,
      ownsPool: false,
    };
  }

  const dependencies = await createKauvioLiveAiSearchDependencies(options);

  if (!dependencies.productProvider) {
    return {
      enabled: false,
      reason: dependencies.disabledReason ?? 'missing_product_provider',
      handler: null,
      priceHandler: null,
      pool: dependencies.pool,
      ownsPool: dependencies.ownsPool,
    };
  }

  const handler = registerKauvioAiSearchRoutes(app, {
    productProvider: dependencies.productProvider,
    registerSearchAlias,
    logger,
  });

  const priceHandler = registerPriceSearch
    ? registerKauvioPriceAwareSearchRoutes(app, {
      ...options,
      pool: dependencies.pool,
      productProvider: dependencies.productProvider,
      registerSearchAlias,
      logger,
    })
    : null;

  logger.info?.('Kauvio live AI search routes registered.', {
    routes: [
      '/api/kauvio/ai-search',
      registerPriceSearch ? '/api/kauvio/ai-search-price' : null,
      registerSearchAlias ? '/api/search/ai' : null,
      registerSearchAlias && registerPriceSearch ? '/api/search/ai-price' : null,
    ].filter(Boolean),
    databaseEnvKey: dependencies.databaseEnvKey,
  });

  return {
    enabled: true,
    handler,
    priceHandler,
    pool: dependencies.pool,
    ownsPool: dependencies.ownsPool,
    databaseEnvKey: dependencies.databaseEnvKey,
  };
}

export function installKauvioLiveAiSearchShutdownHooks(registration, options = {}) {
  const { logger = console, signals = ['SIGINT', 'SIGTERM'] } = options;

  if (!registration?.ownsPool || !registration.pool || typeof registration.pool.end !== 'function') {
    return false;
  }

  for (const signal of signals) {
    process.once(signal, async () => {
      try {
        await registration.pool.end();
        logger.info?.('Kauvio live AI search database pool closed.', { signal });
      } catch (error) {
        logger.error?.('Failed to close Kauvio live AI search database pool.', error);
      } finally {
        process.kill(process.pid, signal);
      }
    });
  }

  return true;
}

export default {
  createKauvioLiveAiSearchDependencies,
  registerKauvioLiveAiSearch,
  installKauvioLiveAiSearchShutdownHooks,
};
