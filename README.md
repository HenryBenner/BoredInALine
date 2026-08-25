<div align="center">
  <img src="assets/logo.png" alt="Bored in Line" width="180" />

# Bored in Line

A mobile-first nightlife social app for discovering venues, checking crowd activity, seeing what friends are doing, and chatting with people at the same bar.

Built with Expo, React Native, Express, PostgreSQL, and Socket.IO.
</div>

## Overview

Bored in Line helps college students see what is happening around them before choosing where to go. The app combines venue discovery with real-time social activity.

Users can browse nearby bars, check in when they arrive, post updates, see friend activity, react to posts, and join live bar-specific chats. Bar admins can manage venue information, deals, and events. Moderation tools support reports, blocking, bans, and content filtering.

## Features

### Venue discovery

- Browse and search bars.
- Sort venues by distance using device location.
- View crowd indicators, cover information, deals, and events.
- Open detailed venue pages.

### Check-ins and social feed

- Check in to a venue with location verification.
- See active friend check-ins.
- Create posts and replies.
- Like posts and add emoji reactions.
- Upload images and media.
- Share posts through the native share sheet.

### Real-time bar chat

- Join a Socket.IO room for the current venue.
- Send messages and images.
- Reply to messages.
- React to chat messages.
- Persist chat history in PostgreSQL.

### Accounts and authentication

- Email and password authentication with JWTs.
- Google sign-in.
- Apple sign-in.
- Password reset by email.
- Profile editing and profile images.
- Friend requests and friend management.
- Account deletion.

### Safety and moderation

- Report posts, chat messages, and users.
- Block users.
- Server-side banned-word filtering.
- Ban enforcement.
- Admin moderation dashboard.
- Terms of Service, privacy policy, EULA, and support screens.

### Admin tools

- Venue admin dashboard.
- Edit venue profile information.
- Manage deals and events.
- Upload venue images.
- Review reports.
- Super-admin broadcast push notifications.

## Tech stack

Frontend:

- Expo SDK 54
- React 19
- React Native 0.81
- Expo Router
- TypeScript
- Socket.IO Client
- Expo Location
- Expo Notifications
- Expo Image Picker
- AsyncStorage

Backend:

- Node.js
- Express
- TypeScript
- PostgreSQL
- Socket.IO
- JWT authentication
- bcrypt
- node-cron
- Expo Server SDK
- Resend
- Replit Object Storage

## Architecture

```text
Expo / React Native app
        |
        | HTTP / REST
        v
Express API server  <---->  PostgreSQL
        |
        | Socket.IO
        v
Real-time venue chat
        |
        +----> Expo push notifications
        +----> Object storage for media
        +----> Resend for password-reset email
```

The mobile client stores the JWT locally and sends it with authenticated API requests. Socket connections also authenticate with the JWT. Venue chats use bar-specific Socket.IO rooms.

The server runs database migrations at startup and uses a night-cycle system to clean up time-sensitive nightlife data.

## Project structure

```text
app/                  Expo Router screens
components/           Reusable React Native UI
contexts/             Authentication and Socket.IO state
hooks/                Location, notifications, media, theme hooks
data/                 Local nightlife and crowd data
assets/               App icons, splash assets, logo, fonts
utils/                API client and shared helpers
server/src/            Express and Socket.IO backend
server/src/routes/     REST API routes
server/src/controllers Business logic
server/src/db/         Schema and migrations
server/src/services/   Email, uploads, and push notifications
```

## Local setup

### 1. Requirements

Install:

- Node.js 20 or newer
- npm
- PostgreSQL
- Expo Go, an iOS simulator, or an Android emulator for mobile testing

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Configure the frontend

Copy the example environment file:

```bash
cp .env.example .env
```

Set the API URL:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

For Google sign-in, also set:

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

For a physical phone, replace `localhost` with a URL or LAN address that the phone can reach.

### 4. Install backend dependencies

```bash
cd server
npm install
```

### 5. Configure the backend

Copy the backend example file:

```bash
cp .env.example .env
```

At minimum, configure:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/bored_in_line
PORT=5000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
```

Optional integrations use these variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_NAME=
SUPER_ADMIN_PASSWORD=
```

### 6. Start the backend

From `server/`:

```bash
npm run dev
```

The backend runs on port 5000 by default.

### 7. Start the Expo app

From the repository root:

```bash
npm start
```

You can also run:

```bash
npm run ios
npm run android
npm run web
```

## Useful scripts

Repository root:

```bash
npm start
npm run ios
npm run android
npm run web
npm run lint
npm run build:server
npm run start:server
npm run build:prod
npm run start:prod
```

Backend:

```bash
cd server
npm run dev
npm run build
npm start
npm run build:prod
npm run start:prod
```

## API highlights

Main API groups include:

- `/api/auth` for registration, login, social auth, and password reset.
- `/api/users` for profiles, friends, activity, push tokens, and account deletion.
- `/api/bars` for venue data, crowd levels, deals, and events.
- `/api/check-ins` for venue check-ins and current attendance.
- `/api/posts` for the social feed, replies, likes, and reactions.
- `/api/chat` for chat history, reporting, and reactions.
- `/api/uploads` for media and profile images.
- `/api/moderation` for reports, blocks, and moderation records.
- `/api/admin` for venue administration.
- `/api/super-admin` for broadcast notifications.

## Production notes

The repository includes EAS configuration for Expo builds and Replit configuration for the backend deployment used by the project.

Do not commit production secrets. Keep `.env` and `server/.env` local or store secrets in your deployment platform.
