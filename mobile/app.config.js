// Everything about the app lives in app.json. This file only changes where an
// EAS build finds google-services.json (Firebase, for Android push).
//
// The file is not committed: the repository is public and the file carries an
// API key that secret scanners flag (README "Push notifications"). EAS Build
// uploads only what git tracks, so on Expo's servers it comes from the EAS
// file variable GOOGLE_SERVICES_JSON, which holds the path of the uploaded
// copy. On this machine, with the variable unset, the local file is used.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
  },
});
