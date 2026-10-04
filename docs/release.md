# Release checklist

How to build, submit and update Q-Learn Mobile with EAS. The repo holds no
credentials and no EAS project id. Everything below marked **(once)** is a manual
step for whoever owns the Apple, Google and Expo accounts.

Run every EAS command with `npx eas-cli@latest` (abbreviated `eas` below).

## 1. One-time setup

- [ ] **(once) Confirm the app identifiers.** `app.json` uses `ai.qphase.qlearn`
  for both the iOS `bundleIdentifier` and the Android `package`, and `qlearn` as
  the URL scheme. They can't be changed after the first store upload, so confirm
  them with the account owner first.
- [ ] **(once) Link the EAS project.** Run `eas init`. It creates the project
  and writes `extra.eas.projectId` (and `owner`, if needed) into `app.json`.
  Commit that change.
- [ ] **(once) Configure EAS Update.** Run `eas update:configure`. It writes
  `updates.url` (`https://u.expo.dev/<projectId>`) into `app.json`. Commit it.
  Until then `expo-updates` is built in but disabled: builds run their embedded
  bundle, and Profile → About shows "Embedded (updates off)". Already configured
  in the repo:
  - `runtimeVersion: { policy: "fingerprint" }`
  - `updates.checkAutomatically: "ON_LOAD"` and `fallbackToCacheTimeout: 0`, so
    launch never waits. An update downloads in the background and applies on the
    next cold start.
  - the `preview` and `production` channels in `eas.json`
- [ ] **(once) Supabase redirect URLs.** Under Supabase → Authentication → URL
  Configuration → Redirect URLs, add `qlearn://auth/callback` and
  `qlearn://reset-password`. Add `exp://**` only for Expo Go development. See
  the README.
- [ ] **(once) EAS environment variables.** Create them for each EAS environment
  (`development`, `preview`, `production`). The build profiles select the
  environment, and `eas update --environment` does the same for updates:

  ```bash
  eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://… --visibility plaintext
  eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://….supabase.co --visibility plaintext
  eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value … --visibility plaintext
  eas env:create --environment production --name EXPO_PUBLIC_CONTENT_SOURCE --value legacy --visibility plaintext
  # EXPO_PUBLIC_CONTENT_URL too, when the source is cms
  ```

  These are public values compiled into the binary. Never add a service key, an
  LLM key or any other secret. The `env` block in `eas.json` (`APP_ENV`) applies
  to builds only. `eas update` doesn't see it.
- [ ] **(once) Store credentials.**
  - iOS: let `eas build` create or manage the distribution certificate and
    profile. Create the app in App Store Connect, then put its numeric Apple ID
    in `eas.json` → `submit.production.ios.ascAppId` (now
    `REPLACE_WITH_ASC_APP_ID`).
  - Android: create a Google Play service account with release access and upload
    its JSON key with `eas credentials` (Android → Google Service Account), so
    it lives on EAS. Never commit the key file. Google requires the first
    Android upload to be made by hand in the Play Console. After that,
    `eas submit` uses the `internal` track as a `draft` release (see `eas.json`).

## 2. Before each store release

- [ ] `npm run lint`, `npm run type-check` and `npm test` pass. CI also runs the
  iOS and Android `expo export`.
- [ ] Update `version` in `app.json` for a public release. Build numbers are
  managed remotely (`appVersionSource: remote`, `autoIncrement` in the
  production profile).
- [ ] Run `npx expo-doctor@latest` and `npx expo install --check`.
- [ ] Check what the config will produce (use placeholder env values locally):
  `npx expo config --type introspect`. Expected:
  - iOS entitlements `{}`. There is no `aps-environment`. See "Push
    entitlement" below.
  - Android `blockedPermissions`: `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`
    and `WRITE_EXTERNAL_STORAGE` show up as `tools:node="remove"`.

## 3. Build, submit, update

```bash
# Internal test builds (preview channel, Android APK)
eas build --profile preview --platform all

# Store builds (production channel)
eas build --profile production --platform all
eas submit --profile production --platform ios      # TestFlight
eas submit --profile production --platform android  # Play internal track, draft
# or in one go: eas build --profile production --platform all --auto-submit

# Over-the-air JS update to builds on a channel
eas update --channel production --environment production --message "Fix lesson search"
eas update --channel preview --environment preview --message "…"
```

**What an OTA update can reach.** The fingerprint policy hashes everything that
affects the native app at build time: native dependencies, `app.json`, config
plugins and the like. An update only goes to builds with the same fingerprint.
After adding a native module, changing a config plugin or editing most of
`app.json`, `eas update` publishes to a new runtime that no installed build has.
That needs a new store build. `eas.json`, `.gitignore` and the icon and splash
images also count. Compare `npx expo-updates runtimeversion:resolve --platform ios`
(and `android`) with the runtime of the build you are targeting, or read the
runtime version `eas update` prints. JS-only changes keep the runtime.

## 4. Rollback

- `eas update:rollback`: guided. It republishes an earlier update, or tells
  clients to go back to the update embedded in their build.
- `eas update:republish --group <update-group-id>`: republish a known-good
  group to the channel's branch. `eas update:list` shows the ids.

Clients pick up a rollback the same way as an update: on the next launch, and it
applies after the following cold start. Profile → About shows the running
channel and update id, which helps to confirm what a tester is on.

## 5. Store listing assets

- [ ] App icon (`assets/images/icon.png`, `assets/expo.icon`), Android adaptive
  icon layers and splash image. Several are still the Expo template artwork,
  so replace them with Q-Learn branding.
- [ ] **Android notification icon:** `assets/images/android-icon-monochrome.png`
  (set in the `expo-notifications` plugin) is the template's monochrome glyph,
  used as a placeholder. Replace it with a white-on-transparent Q-Learn
  silhouette.
- [ ] Screenshots (iPhone 6.9" and 6.5", iPad if `supportsTablet` stays on,
  Android phone), short and full descriptions, keywords, support URL, privacy
  policy URL.
- [ ] App Store privacy "nutrition label" and Play Data safety form: account
  email and learning progress (stored by the Q-Learn backend), tutor messages.
  No tracking and no ads.
- [ ] Demo account for App Review (Apple requires one because the app has
  sign-in).
- [ ] Export compliance: `ios.config.usesNonExemptEncryption: false` is already
  set (HTTPS only).

## Decisions recorded in config

### Push entitlement (iOS `aps-environment`)

The `expo-notifications` config plugin always adds `aps-environment`. The app
only schedules **local** study reminders, which don't need it. With it, the App
ID would have to enable the Push Notifications capability, and App Review may
ask about push that doesn't exist. `plugins/withoutPushEntitlement.js` removes
it after the rest of the plugin chain has run, so its place in `plugins`
doesn't matter. Verified with `npx expo config --type introspect` (entitlements
are `{}`).

**When remote push is built** (backend needs `POST /api/v1/devices` plus
server-side sending, audit §13):
1. Delete `./plugins/withoutPushEntitlement` from `app.json` `plugins` and
   delete the file.
2. Set the `expo-notifications` plugin `mode` to `production` for store builds.
3. Let EAS set up the push key (`eas credentials`).

### Android permissions

The prebuild template adds these, and none of them is used:
`SYSTEM_ALERT_WINDOW` (dev overlay), and `READ_EXTERNAL_STORAGE` /
`WRITE_EXTERNAL_STORAGE` (≤ API 32). Library manifests also ask for the storage
ones: expo-file-system, and expo-image through Glide for local-file images. The
app loads only remote and bundled images. All three are in
`android.blockedPermissions`. These stay, because something uses them:
- `INTERNET`
- `ACCESS_NETWORK_STATE` (expo-network, expo-updates, expo-image)
- `ACCESS_WIFI_STATE` (expo-network)
- `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED` (expo-notifications)
- `VIBRATE` (notification channel defaults)

### iOS privacy manifest

`ios.privacyManifests` lists the required-reason APIs declared by the native
code that ships in the app:

| Category | Reasons | Declared by |
|---|---|---|
| UserDefaults | CA92.1 | React Native core, expo-constants, expo-notifications, expo-system-ui |
| FileTimestamp | C617.1, 0A2A.1, 3B52.1 | React Native core and boost (C617.1), expo-application (C617.1), expo-file-system (0A2A.1, 3B52.1) |
| SystemBootTime | 35F9.1 | React Native core and boost |
| DiskSpace | E174.1, 85F4.1 | expo-file-system |

React Native's `pod install` already merges pod privacy manifests into the
app's manifest (`privacy_file_aggregation_enabled`, on by default). Listing the
reasons in `app.json` makes them explicit, and keeps them if that aggregation
ever changes. When a native dependency is added, check
`node_modules/<pkg>/ios/PrivacyInfo.xcprivacy` and add its reasons here. Apple
emails after an upload when a reason is missing.

## Future

- **Universal links** (`https://…` opening the app). They need the Q-Learn web
  domain to serve `/.well-known/apple-app-site-association` and
  `/.well-known/assetlinks.json` (Q-Learn frontend). The app also needs
  `ios.associatedDomains` and Android `intentFilters` with `autoVerify`. Until
  then only `qlearn://` links work (audit §13/§14).
- **Remote push**: see "Push entitlement" above.
