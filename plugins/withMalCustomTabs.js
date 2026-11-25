const { withAndroidManifest } = require('expo/config-plugins');

const CUSTOM_TABS_ACTION = 'android.support.customtabs.action.CustomTabsService';

function ensureCustomTabsQuery(androidManifest) {
  const manifest = androidManifest.manifest || androidManifest;
  if (!Array.isArray(manifest.queries)) {
    manifest.queries = [{}];
  }
  if (manifest.queries.length === 0) {
    manifest.queries.push({});
  }

  const queriesBlock = manifest.queries[0];
  if (!Array.isArray(queriesBlock.intent)) {
    queriesBlock.intent = [];
  }

  const alreadyExists = queriesBlock.intent.some((intentItem) =>
    Array.isArray(intentItem?.action) &&
    intentItem.action.some((a) => a?.$?.['android:name'] === CUSTOM_TABS_ACTION)
  );

  if (!alreadyExists) {
    queriesBlock.intent.push({
      action: [{ $: { 'android:name': CUSTOM_TABS_ACTION } }],
    });
  }

  return androidManifest;
}

module.exports = function withMalCustomTabs(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = ensureCustomTabsQuery(config.modResults);
    return config;
  });
};
module.exports.ensureCustomTabsQuery = ensureCustomTabsQuery;
