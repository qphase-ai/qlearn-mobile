const { withBaseMod } = require('expo/config-plugins');

/**
 * Removes the iOS push entitlement (`aps-environment`) that the expo-notifications
 * plugin always adds. The app only schedules local notifications, which need no
 * entitlement, and shipping it would make the App ID require the Push capability.
 *
 * Mods registered later run first (`withMod` calls its callback, then the next
 * mod), so a plain `withEntitlementsPlist` listed after expo-notifications would
 * run before the entitlement is added. This one lets the rest of the chain run
 * first and then deletes the key, so its place in `plugins` doesn't matter.
 *
 * Delete this plugin and its app.json entry when remote push is built
 * (audit §13, docs/release.md).
 */
module.exports = function withoutPushEntitlement(config) {
  return withBaseMod(config, {
    platform: 'ios',
    mod: 'entitlements',
    isProvider: false,
    async action({ modRequest: { nextMod, ...modRequest }, ...rest }) {
      const result = await nextMod({ ...rest, modRequest });
      delete result.modResults['aps-environment'];
      return result;
    },
  });
};
