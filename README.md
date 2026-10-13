# us.exe ♡ — our little world

A private, pastel scrapbook for two people. It is a React + TypeScript + Vite site. Without Firebase setup it works as a local scrapbook in one browser. Configure Firebase Authentication and Firestore to synchronize memories, letters, profile settings, and the bucket list between your two authorized accounts.

## Run it on your computer

1. Install Node.js 22 or newer.
2. In this folder run `npm install`.
3. Run `npm run dev` and open the local URL Vite prints.
4. Add your names, anniversary date, favorite photo URL, and welcome note using the small settings button on the home page.

Without Firebase, scrapbook entries and preferences stay in that browser's local storage. That mode is device-only and is not an authenticated/private shared site.

## Add MP3s to the `public/audio` folder

1. Copy MP3 files into `public/audio/` (the folder already has a `playlist.json`).
2. Open `public/audio/playlist.json` and add one entry per MP3, matching its filename:

   ```json
   {
     "songs": [
       { "title": "Our song", "file": "our-song.mp3" },
       { "file": "another-song.mp3" }
     ]
   }
   ```

3. Save the file and refresh the site. While developing, run `npm run dev`; the tracks appear in the player playlist as **site folder**.

MP3s in `public/audio/` are included in the built website and are publicly accessible to anyone who can access the site. There is no in-browser music upload, local-file player, or private music sharing. Only add music that you own or have permission to publish. After adding tracks, rebuild and push the changes to GitHub to update the deployed site.

Memory photos are added using an image URL, not an upload. The image host controls access to the image, so use links you are comfortable sharing.

## Set up private, shared Firebase data

Create a Firebase project at [Firebase Console](https://console.firebase.google.com/). This project uses **Authentication** and **Cloud Firestore** only; it does not use Firebase Storage or require configuring Storage or Storage rules. The web API key in a Vite app is a client identifier, not an admin credential. Privacy is enforced by Firebase Authentication and Firestore security rules. Never add a service-account key to this project.

1. In **Authentication → Sign-in method**, enable **Email/Password**. The site has sign-in only and does not allow public registration.
2. In **Authentication → Users**, manually create exactly your two accounts with email and password. Both account owners need access to their inboxes to verify their addresses.
3. In **Firestore Database**, create a database. Open **Rules**, replace both placeholder email addresses in `firestore.rules` with the two verified account emails, then publish the rules.
4. Add a Web app in **Project settings** and copy its Firebase configuration.
5. In the workspace, copy `.env.example` to `.env.local`. In VS Code you can right-click `.env.example` and choose **Copy**, then paste and rename the copy to `.env.local`. Fill in the five Firebase values from the Web app settings. Set `VITE_ALLOWED_EMAILS` to the same two comma-separated verified addresses, for example `you@example.com,girlfriend@example.com`.
6. Save `.env.local`, stop and restart `npm run dev`, and click **sign in**. Sign in with either manually-created account. If that account is not verified yet, the site sends a verification link to its inbox and asks you to sign in again after opening the link. The client email list improves the sign-in experience; Firestore rules are the actual database access control.
7. For deployment, add the same `VITE_FIREBASE_*` values and `VITE_ALLOWED_EMAILS` as GitHub Actions variables, as described below. Also add `localhost` and your GitHub Pages domain to Firebase **Authentication → Settings → Authorized domains**.

The app never creates accounts. Firebase's rules independently reject all accounts except the two exact, verified emails you put in the rules. Do not publish the app until you have replaced the example emails in `firestore.rules`.

### What gets shared

Firestore stores profile settings, memories, love notes, and bucket-list items under `couples/main`. The rules permit only the `settings`, `memories`, `letters`, and `bucket` collections for the two verified accounts; playlist metadata and uploaded files are not stored in Firebase. Once Firebase settings are present, signing in is required before the scrapbook or music player is shown. Shared scrapbook data is read from and written to Firestore; it is not cached in local storage. Sign in before adding content you want to share. Content created in local-only mode before Firebase is configured is not automatically migrated; re-add it after signing in.

The audio player only plays files in `public/audio/`. Those files are public website assets and are not protected by Firebase rules. Photo URLs stored with memories are hosted elsewhere and are not uploaded to Firebase; the image host determines their privacy. Local browser preferences (such as muted game sounds) use local storage and do not synchronize.

## Publish on GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
3. In **Settings → Secrets and variables → Actions → Variables**, add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_ALLOWED_EMAILS`. Use the Firebase Web app values and your two account emails. For a local-only site, leave these unset.
4. Push to `main` or manually run **Deploy to GitHub Pages** under Actions.

The workflow builds the app and deploys `dist`. Vite uses relative asset paths so the app also works when the repository is published at a project subpath. In Firebase Authentication settings, add the deployed GitHub Pages host under **Authorized domains**.

## Features

- Responsive cozy scrapbook UI, editable names/date/welcome, live day counter, and little surprise note.
- Editable memory cards, photo links, love letters, monthsary messages, and bucket list.
- Date-night wheel and pickers, customizable quiz questions, playable match game, and touch/keyboard heart-catching game.
- Non-autoplaying MP3 player for songs in `public/audio`, with track controls, shuffle, repeat, progress, and volume.
- Optional Firebase email/password sign-in with two-account Firestore rules.
- GitHub Actions deployment to GitHub Pages.

## Useful commands

- `npm run dev` — local development
- `npm run build` — TypeScript check and production build
- `npm run preview` — serve the production build locally
