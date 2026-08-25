// PRODUCTION SERVER - Minimal, fast startup, API only
// No Expo proxy, no development tools
import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = Number(process.env.PORT || 5000);

// Track if Express is ready
let expressReady = false;
let expressApp: any = null;

// Create raw HTTP server with Node.js built-ins only
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Health check endpoints - respond IMMEDIATELY with no dependencies
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ready: expressReady }));
    return;
  }
  
  // For all other requests, delegate to Express if ready
  if (expressReady && expressApp) {
    expressApp(req, res);
  } else {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server initializing, please retry' }));
  }
});

// Start listening IMMEDIATELY - this is what the health check needs
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server listening on port ${PORT}`);
  
  // Load Express and routes asynchronously AFTER we're already listening
  initializeExpress().catch(err => {
    console.error('Failed to initialize Express:', err);
  });
});

async function initializeExpress() {
  // Import dependencies
  const [
    { default: express },
    { default: cors },
    { default: morgan },
    { default: path },
    { Server: SocketIOServer },
    { config },
    { errorHandler },
    { default: pool },
    { startCleanupJobs },
    { default: authRoutes },
    { default: adminRoutes },
    { default: barRoutes },
    { default: postRoutes },
    { default: userRoutes },
    { default: chatRoutes },
    { default: checkInRoutes },
    { default: friendRoutes },
    { default: uploadRoutes },
    { default: moderationRoutes },
    { default: superAdminRoutes },
    { serveMedia },
    { notifyChatMessage },
    { checkContent },
  ] = await Promise.all([
    import('express'),
    import('cors'),
    import('morgan'),
    import('path'),
    import('socket.io'),
    import('./config/env'),
    import('./middleware/errorHandler'),
    import('./config/database'),
    import('./jobs/cleanup'),
    import('./routes/auth'),
    import('./routes/admin'),
    import('./routes/bars'),
    import('./routes/posts'),
    import('./routes/users'),
    import('./routes/chat'),
    import('./routes/checkIns'),
    import('./routes/friends'),
    import('./routes/uploads'),
    import('./routes/moderation'),
    import('./routes/superAdmin'),
    import('./controllers/uploadController'),
    import('./services/pushNotificationService'),
    import('./utils/contentFilter'),
  ]);

  console.log('Dependencies loaded, setting up Express...');

  // Run DB migrations before starting the server
  const { runMigrations } = await import('./db/runMigrations');
  await runMigrations();

  const app = express();

  // Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });
  (global as any).io = io;

  // Middleware
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json());
  app.use(morgan('combined'));

  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getLandingPage());
  });
  app.get('/health', (req, res) => res.status(200).send('OK'));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', ready: true }));

  // Public pages (required for App Store compliance)
  app.get('/support', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getSupportPage());
  });
  app.get('/privacy', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getPrivacyPage());
  });
  app.get('/terms', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getTermsPage());
  });
  app.get('/eula', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getEulaPage());
  });
  app.get('/auth/reset-password', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getResetPasswordPage(req.query.token as string | undefined));
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/bars', barRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/check-ins', checkInRoutes);
  app.use('/api/friends', friendRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/moderation', moderationRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.get('/api/media/*', serveMedia);

  // Admin portal static file
  app.get('/admin-portal', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'admin-portal', 'index.html'));
  });

  // Error handler
  app.use(errorHandler);

  // Socket.IO authentication and handlers
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth.token;
      if (!token) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
      }
      if (!token) return next(new Error('Authentication required'));
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, config.jwtSecret) as { id: string; email: string };
      socket.data.userId = decoded.id;
      socket.data.email = decoded.email;
      next();
    } catch { 
      next(new Error('Invalid token')); 
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-bar-chat', async (barId: string) => {
      try {
        const result = await pool.query(
          `SELECT id FROM check_ins WHERE user_id = $1 AND bar_id = $2 AND checked_out_at IS NULL
           AND created_at >= (CURRENT_DATE + INTERVAL '4 hours')::timestamp - INTERVAL '1 day'`,
          [socket.data.userId, barId]
        );
        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Must be checked in to join chat' });
          return;
        }
        socket.join(`bar-${barId}`);
        socket.emit('joined-bar-chat', { barId });
      } catch { 
        socket.emit('error', { message: 'Failed to join chat' }); 
      }
    });

    socket.on('leave-bar-chat', (barId: string) => socket.leave(`bar-${barId}`));

    socket.on('send-message', async (data: { barId: string; message?: string; imageUrl?: string; replyToId?: string }) => {
      try {
        const { barId, message, imageUrl, replyToId } = data;
        const userId = socket.data.userId;

        const checkIn = await pool.query(
          `SELECT id FROM check_ins WHERE user_id = $1 AND bar_id = $2 AND checked_out_at IS NULL
           AND created_at >= (CURRENT_DATE + INTERVAL '4 hours')::timestamp - INTERVAL '1 day'`,
          [userId, barId]
        );
        if (checkIn.rows.length === 0) {
          socket.emit('error', { message: 'Must be checked in to send messages' });
          return;
        }

        if (message) {
          const filterResult = await checkContent(message);
          if (!filterResult.isClean) {
            socket.emit('error', { message: 'Message contains inappropriate content' });
            return;
          }
        }

        const user = await pool.query('SELECT name, profile_image FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) { 
          socket.emit('error', { message: 'User not found' }); 
          return; 
        }

        let replyToMessage = null, replyToUserName = null;
        if (replyToId) {
          const reply = await pool.query(
            `SELECT cm.message, u.name FROM chat_messages cm JOIN users u ON cm.user_id = u.id WHERE cm.id = $1`,
            [replyToId]
          );
          if (reply.rows.length) { 
            replyToMessage = reply.rows[0].message; 
            replyToUserName = reply.rows[0].name; 
          }
        }

        const insert = await pool.query(
          `INSERT INTO chat_messages (bar_id, user_id, message, image_url, reply_to_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
          [barId, userId, message?.trim() || null, imageUrl || null, replyToId || null]
        );

        io.to(`bar-${barId}`).emit('new-message', {
          id: insert.rows[0].id, 
          barId, 
          userId,
          userName: user.rows[0].name, 
          userImage: user.rows[0].profile_image,
          message: message?.trim() || null, 
          imageUrl: imageUrl || null,
          createdAt: insert.rows[0].created_at, 
          replyToId, 
          replyToMessage, 
          replyToUserName,
        });

        const bar = await pool.query('SELECT name FROM bars WHERE id = $1', [barId]);
        notifyChatMessage(barId, userId, user.rows[0].name, message?.trim() || '', bar.rows[0]?.name || 'the bar').catch(() => {});
      } catch { 
        socket.emit('error', { message: 'Failed to send message' }); 
      }
    });

    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
  });

  // Store Express app for the raw HTTP server to use
  expressApp = app;
  expressReady = true;

  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'production';
  console.log(`Production server ready at https://${domain}`);

  // Start cleanup jobs with delay (don't interfere with startup)
  setTimeout(() => {
    startCleanupJobs();
  }, 30000);
}

export const getIO = () => (global as any).io;

function getSupportPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support - Bored in a Line</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0A; color: #FFF; padding: 20px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 40px 0 8px; }
    .subtitle { color: #888; margin-bottom: 32px; }
    h2 { font-size: 20px; margin: 28px 0 16px; color: #FFF; }
    .card { background: #1C1C1C; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .card a { color: #DC143C; text-decoration: none; }
    .question { font-weight: 600; margin-bottom: 8px; }
    .answer { color: #AAA; line-height: 1.6; font-size: 14px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #2A2A2A; color: #666; }
  </style>
</head>
<body>
  <h1>How Can We Help?</h1>
  <p class="subtitle">We're here to assist you with any questions or issues</p>

  <h2>Contact Us</h2>
  <div class="card">
    <p>Email Support</p>
    <a href="mailto:support@boredinaline.com">support@boredinaline.com</a>
  </div>

  <h2>Frequently Asked Questions</h2>
  <div class="card">
    <p class="question">How do I check in to a bar?</p>
    <p class="answer">Navigate to the Discover tab, find your bar, and tap the "Tap In" button. You must be within half a mile of the location to check in.</p>
  </div>
  <div class="card">
    <p class="question">How do I see where my friends are?</p>
    <p class="answer">Once you've added friends, you can see their check-ins on bar profiles and in the Feed tab. Only friends can see your location.</p>
  </div>
  <div class="card">
    <p class="question">How do I use the chat feature?</p>
    <p class="answer">You must be checked in to a bar to access its chat room. Once checked in, go to the Chat tab to message others at the same location.</p>
  </div>
  <div class="card">
    <p class="question">How do I delete my account?</p>
    <p class="answer">Go to your Profile, tap the Settings icon, then scroll down and tap "Delete Account." You'll be asked to confirm with your password. This permanently removes your account and all associated data.</p>
  </div>
  <div class="card">
    <p class="question">Why can't I check in?</p>
    <p class="answer">Make sure location services are enabled for the app. You must be within half a mile of the bar to check in.</p>
  </div>

  <h2>Response Time</h2>
  <div class="card">
    <p class="answer">We aim to respond to all support inquiries within 24-48 hours. For urgent matters, please include "URGENT" in your email subject line.</p>
  </div>

  <div class="footer">
    <p>Bored in a Line</p>
    <p style="font-size: 12px; margin-top: 4px; color: #444;">Version 1.0.0</p>
  </div>
</body>
</html>`;
}

function getTermsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - Bored in a Line</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0A; color: #FFF; padding: 20px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 40px 0 8px; }
    .subtitle { color: #888; margin-bottom: 32px; }
    h2 { font-size: 20px; margin: 28px 0 12px; color: #FFF; }
    p { color: #AAA; line-height: 1.7; margin-bottom: 12px; font-size: 14px; }
    ul { color: #AAA; line-height: 1.7; padding-left: 24px; margin-bottom: 12px; font-size: 14px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #2A2A2A; color: #666; }
  </style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p class="subtitle">Last updated: February 2026</p>

  <h2>Acceptance of Terms</h2>
  <p>By creating an account or using Bored in a Line, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.</p>

  <h2>User Accounts</h2>
  <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account and password. You must be at least 18 years old to use this service.</p>

  <h2>User Conduct</h2>
  <p>You agree not to engage in any of the following prohibited activities:</p>
  <ul>
    <li>Harassment, bullying, or intimidation of other users</li>
    <li>Posting hate speech, discriminatory, or threatening content</li>
    <li>Spamming, including repetitive or unsolicited messages</li>
    <li>Sharing illegal, obscene, or otherwise objectionable content</li>
    <li>Impersonating other users or public figures</li>
    <li>Attempting to manipulate or abuse the check-in system</li>
  </ul>

  <h2>Content Guidelines</h2>
  <p>You are solely responsible for the content you post, including text, images, and messages in bar chats. We reserve the right to remove any content that violates these terms or that we deem inappropriate, without prior notice.</p>
  <p>By posting content, you grant Bored in a Line a non-exclusive license to display that content within the app.</p>

  <h2>Privacy</h2>
  <p>Your use of the app is also governed by our <a href="/privacy" style="color: #DC143C;">Privacy Policy</a>, which describes how we collect, use, and protect your personal information.</p>

  <h2>Termination</h2>
  <p>We reserve the right to suspend or permanently ban any account that violates these Terms of Service, at our sole discretion and without prior notice. You may delete your account at any time through the app's Settings screen.</p>

  <h2>Disclaimer</h2>
  <p>Bored in a Line is provided "as is" without warranties of any kind. We are not responsible for the accuracy of crowd levels, wait times, or other user-generated information.</p>

  <h2>Contact Us</h2>
  <p>If you have questions about these Terms of Service, contact us at <a href="mailto:support@boredinaline.com" style="color: #DC143C;">support@boredinaline.com</a></p>

  <div class="footer">
    <p>Bored in a Line</p>
    <p style="font-size: 12px; margin-top: 4px; color: #444;">Version 1.0.0</p>
  </div>
</body>
</html>`;
}

function getPrivacyPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Bored in a Line</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0A; color: #FFF; padding: 20px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 40px 0 8px; }
    .subtitle { color: #888; margin-bottom: 32px; }
    h2 { font-size: 20px; margin: 28px 0 12px; color: #FFF; }
    p { color: #AAA; line-height: 1.7; margin-bottom: 12px; font-size: 14px; }
    ul { color: #AAA; line-height: 1.7; padding-left: 24px; margin-bottom: 12px; font-size: 14px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #2A2A2A; color: #666; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="subtitle">Last updated: February 2026</p>

  <h2>Information We Collect</h2>
  <p>When you create an account, we collect your email address, name, and optional school affiliation. When you use location features, we collect your device's GPS coordinates to enable bar check-ins.</p>

  <h2>How We Use Your Information</h2>
  <ul>
    <li>To provide and maintain the app's features</li>
    <li>To verify your location for bar check-ins</li>
    <li>To display your activity to your friends</li>
    <li>To send push notifications about friend activity</li>
    <li>To improve our services</li>
  </ul>

  <h2>Data Sharing</h2>
  <p>We do not sell your personal information. Your check-in status and activity are only visible to users you've added as friends, unless you set your profile to public.</p>

  <h2>Data Retention</h2>
  <p>Chat messages and check-in data are automatically cleared each night at 4 AM to ensure fresh starts. Your account information is retained until you delete your account.</p>

  <h2>Account Deletion</h2>
  <p>You can permanently delete your account and all associated data at any time through the app's Settings screen. Go to Profile > Settings > Delete Account.</p>

  <h2>Location Data</h2>
  <p>We only access your location when you actively check in to a bar. Location data is used solely to verify proximity and is not tracked in the background.</p>

  <h2>Device Permissions</h2>
  <p>The app requests access to certain device features only when you actively use a related feature. We do not access these in the background.</p>
  <ul>
    <li><strong>Camera:</strong> Used to take a check-in photo or record a video at a bar to share in the bar's live feed (for example, snapping a photo of the crowd on a Friday night). Only accessed when you tap the camera button.</li>
    <li><strong>Photo Library (read):</strong> Used to let you choose an existing photo or video from your device to post in the bar feed or attach to a check-in. Only accessed when you tap "Choose from Gallery."</li>
    <li><strong>Photo Library (save):</strong> Used to save photos captured inside the app to your device's camera roll. Only triggered if you explicitly choose to save a photo.</li>
    <li><strong>Microphone:</strong> Used to capture audio when you record a video to share in the bar feed. Only active while you are recording a video clip.</li>
  </ul>
  <p>Media captured or selected through these permissions is uploaded to our servers only if you choose to post or share it. You can revoke any permission at any time in your device's Settings app.</p>

  <h2>Contact Us</h2>
  <p>If you have questions about this privacy policy, contact us at <a href="mailto:support@boredinaline.com" style="color: #DC143C;">support@boredinaline.com</a></p>

  <div class="footer">
    <p>Bored in a Line</p>
    <p style="font-size: 12px; margin-top: 4px; color: #444;">Version 1.0.0</p>
  </div>
</body>
</html>`;
}

function getLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bored in a Line</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0A; color: #FFF; display: flex; justify-content: center; align-items: center; min-height: 100vh; text-align: center; }
    .container { max-width: 500px; padding: 40px 20px; }
    h1 { font-size: 42px; font-weight: 900; color: #DC143C; margin-bottom: 4px; letter-spacing: 2px; }
    .tagline { font-size: 14px; color: #DC143C; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 32px; }
    .description { color: #888; line-height: 1.6; margin-bottom: 40px; font-size: 16px; }
    .app-store-btn { display: inline-flex; align-items: center; gap: 10px; background: #fff; border-radius: 12px; padding: 14px 28px; color: #000; font-size: 15px; font-weight: 600; text-decoration: none; margin-bottom: 24px; transition: opacity 0.2s; }
    .app-store-btn:hover { opacity: 0.85; }
    .app-store-btn svg { flex-shrink: 0; }
    .btn-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
    .btn-sub { font-size: 11px; font-weight: 400; opacity: 0.7; }
    .links { margin-top: 32px; }
    .links a { color: #DC143C; text-decoration: none; margin: 0 16px; font-size: 14px; }
    .links a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>BORED</h1>
    <p class="tagline">In a Line</p>
    <p class="description">The social nightlife app for college students. Discover bars, check in, see where your friends are, and chat with people at the same spot.</p>
    <a href="https://apps.apple.com/us/app/bored-in-a-line/id6758163650" class="app-store-btn" target="_blank" rel="noopener noreferrer">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="currentColor"/></svg>
      <span class="btn-text">
        <span class="btn-sub">Download on the</span>
        App Store
      </span>
    </a>
    <div class="links">
      <a href="/support">Support</a>
      <a href="/terms">Terms of Service</a>
      <a href="/privacy">Privacy Policy</a>
      <a href="/eula">EULA</a>
    </div>
  </div>
</body>
</html>`;
}

function getEulaPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>End User License Agreement - Bored in a Line</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0A; color: #FFF; padding: 20px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 40px 0 8px; }
    .subtitle { color: #DC143C; margin-bottom: 4px; }
    .date { color: #888; margin-bottom: 32px; font-size: 14px; }
    h2 { font-size: 20px; margin: 28px 0 12px; color: #FFF; }
    p { color: #AAA; line-height: 1.7; margin-bottom: 12px; font-size: 14px; }
    ul { color: #AAA; line-height: 1.7; padding-left: 24px; margin-bottom: 12px; font-size: 14px; }
    a { color: #DC143C; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #2A2A2A; color: #666; }
  </style>
</head>
<body>
  <h1>End User License Agreement</h1>
  <p class="subtitle">Bored in a Line</p>
  <p class="date">Effective Date: March 4, 2026</p>
  <p>Please read this End User License Agreement ("EULA") carefully before downloading or using the Bored in a Line mobile application ("App"). By downloading, installing, or using the App, you agree to be bound by the terms of this EULA.</p>
  <h2>1. License Grant</h2>
  <p>Subject to your compliance with this EULA, we grant you a limited, non-exclusive, non-transferable, revocable license to download and use the App on any Apple-branded device that you own or control, solely for your personal, non-commercial purposes.</p>
  <h2>2. License Restrictions</h2>
  <ul>
    <li>Copy, modify, or distribute the App or any portion of it</li>
    <li>Reverse engineer, disassemble, or decompile the App</li>
    <li>Rent, lease, lend, sell, or sublicense the App</li>
    <li>Use the App for any commercial purpose</li>
    <li>Remove or alter any proprietary notices on the App</li>
    <li>Use the App in violation of applicable law</li>
  </ul>
  <h2>3. Age Requirement</h2>
  <p>The App is intended exclusively for users who are 18 years of age or older. By using the App, you confirm you are at least 18 years old.</p>
  <h2>4. User-Generated Content</h2>
  <p>You are solely responsible for all content you submit. We have a zero-tolerance policy for objectionable content including hate speech, harassment, sexually explicit material, content depicting violence, and spam. Violations may result in immediate content removal and permanent account termination.</p>
  <h2>5. Maintenance and Support</h2>
  <p>We are solely responsible for providing maintenance and support for the App. Apple has no obligation whatsoever to provide any maintenance or support services with respect to the App. Contact us at <a href="mailto:support@boredinaline.com">support@boredinaline.com</a>.</p>
  <h2>6. Warranty Disclaimer</h2>
  <p>The App is provided "as is" without warranty of any kind. In the event of any failure of the App to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if applicable). Apple will have no other warranty obligation with respect to the App.</p>
  <h2>7. Product Claims</h2>
  <p>We, not Apple, are responsible for addressing any claims relating to the App, including product liability claims, claims that the App fails to conform to any legal or regulatory requirement, and claims arising under consumer protection or similar legislation.</p>
  <h2>8. Intellectual Property</h2>
  <p>In the event of any third-party claim that the App infringes intellectual property rights, we, not Apple, will be solely responsible for the investigation, defense, settlement, and discharge of any such claim.</p>
  <h2>9. Legal Compliance</h2>
  <p>You represent that you are not located in a country subject to a U.S. Government embargo and are not listed on any U.S. Government list of prohibited or restricted parties.</p>
  <h2>10. Termination</h2>
  <p>This EULA is effective until terminated. Your rights will terminate automatically if you fail to comply with any of its terms. We also reserve the right to suspend or terminate your account at any time for violations of this EULA.</p>
  <h2>11. Apple as Third-Party Beneficiary</h2>
  <p>Apple, and Apple's subsidiaries, are third-party beneficiaries of this EULA. Upon your acceptance of this EULA, Apple will have the right to enforce this EULA against you as a third-party beneficiary.</p>
  <h2>12. Contact Information</h2>
  <p>If you have questions about this EULA, contact us at <a href="mailto:support@boredinaline.com">support@boredinaline.com</a>.</p>
  <div class="footer">
    <p>Bored in a Line &copy; 2026</p>
  </div>
</body>
</html>`;
}
function getResetPasswordPage(token?: string): string {
  if (!token) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Bored in a Line</title>
  <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0A0A0A; color:#FFF; padding:20px; display:flex; align-items:center; justify-content:center; min-height:100vh; } .card { background:#1C1C1C; border-radius:16px; padding:32px; max-width:400px; width:100%; text-align:center; } h2 { color:#DC143C; margin-bottom:12px; } p { color:#9CA3AF; line-height:1.6; }</style>
</head>
<body>
  <div class="card">
    <h2>Invalid Link</h2>
    <p>This password reset link is invalid or has expired. Please request a new one from the app.</p>
  </div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Bored in a Line</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0A0A0A; color:#FFF; padding:20px; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#1C1C1C; border-radius:16px; padding:32px; max-width:400px; width:100%; }
    h1 { color:#DC143C; font-size:22px; margin-bottom:8px; }
    .brand { color:#9CA3AF; font-size:14px; margin-bottom:24px; }
    label { display:block; color:#E5E7EB; font-size:14px; font-weight:600; margin-bottom:8px; }
    input { display:block; width:100%; background:#0A0A0A; border:1px solid #2C2C2C; border-radius:10px; padding:14px; font-size:16px; color:#FFF; margin-bottom:16px; outline:none; }
    input:focus { border-color:#DC143C; }
    button { width:100%; background:#DC143C; color:#FFF; border:none; border-radius:10px; padding:16px; font-size:16px; font-weight:600; cursor:pointer; }
    button:disabled { opacity:0.6; cursor:default; }
    .message { margin-top:16px; padding:12px; border-radius:8px; font-size:14px; text-align:center; display:none; }
    .success { background:rgba(34,197,94,0.15); border:1px solid #22c55e; color:#86efac; }
    .error { background:rgba(220,38,38,0.15); border:1px solid #DC143C; color:#f87171; }
    .open-app { margin-top:20px; text-align:center; display:none; }
    .open-app a { color:#DC143C; text-decoration:none; font-weight:600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Reset Password</h1>
    <p class="brand">Bored in a Line</p>
    <div id="form-container">
      <input type="hidden" id="reset-token" value="${token.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" />
      <label for="password">New Password</label>
      <input type="password" id="password" placeholder="At least 6 characters" />
      <label for="confirm">Confirm Password</label>
      <input type="password" id="confirm" placeholder="Re-enter password" />
      <button id="submit-btn" onclick="submitReset()">Set New Password</button>
    </div>
    <div id="message" class="message"></div>
    <div class="open-app" id="open-app">
      <a href="boredinline://login">Open the App to Log In</a>
    </div>
  </div>
  <script>
    async function submitReset() {
      const resetToken = document.getElementById('reset-token').value;
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      const btn = document.getElementById('submit-btn');
      const msg = document.getElementById('message');
      msg.style.display = 'none';
      if (!password || password.length < 6) {
        showMessage('Password must be at least 6 characters.', 'error');
        return;
      }
      if (password !== confirm) {
        showMessage('Passwords do not match.', 'error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password })
        });
        const data = await res.json();
        if (res.ok) {
          document.getElementById('form-container').style.display = 'none';
          showMessage(data.message || 'Password reset successfully!', 'success');
          document.getElementById('open-app').style.display = 'block';
        } else {
          showMessage(data.error || 'Something went wrong. Please try again.', 'error');
          btn.disabled = false;
          btn.textContent = 'Set New Password';
        }
      } catch(e) {
        showMessage('Connection error. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Set New Password';
      }
    }
    function showMessage(text, type) {
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = 'message ' + type;
      msg.style.display = 'block';
    }
  </script>
</body>
</html>`;
}
