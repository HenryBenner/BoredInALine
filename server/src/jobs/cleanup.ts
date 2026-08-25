import cron from 'node-cron';
import pool from '../config/database';

export const runCleanup = async () => {
  try {
    console.log('🧹 Starting cleanup...');

    const checkInsResult = await pool.query(`
      UPDATE check_ins SET checked_out_at = NOW() 
      WHERE checked_out_at IS NULL 
      RETURNING id
    `);
    console.log(`✓ Checked out ${checkInsResult.rowCount} users`);

    const messagesResult = await pool.query(`
      DELETE FROM chat_messages 
      RETURNING id
    `);
    console.log(`✓ Deleted ${messagesResult.rowCount} chat messages`);

    const likesResult = await pool.query(`
      DELETE FROM post_likes 
      WHERE post_id IN (
        SELECT id FROM posts WHERE created_at < NOW() - INTERVAL '7 days'
      )
      RETURNING post_id
    `);
    console.log(`✓ Deleted ${likesResult.rowCount} post likes from old posts`);
    
    const postsResult = await pool.query(`
      DELETE FROM posts 
      WHERE created_at < NOW() - INTERVAL '7 days'
      RETURNING id
    `);
    console.log(`✓ Deleted ${postsResult.rowCount} posts older than 7 days`);

    console.log('✅ Cleanup completed successfully');
    
    return {
      checkedOut: checkInsResult.rowCount,
      messagesDeleted: messagesResult.rowCount,
      likesDeleted: likesResult.rowCount,
      postsDeleted: postsResult.rowCount
    };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
};

export const startCleanupJobs = () => {
  // Delay startup cleanup by 60 seconds to avoid interfering with health checks
  setTimeout(() => {
    console.log('🚀 Running delayed startup cleanup...');
    runCleanup().catch(err => console.error('Startup cleanup failed:', err));
  }, 60000);

  cron.schedule('0 4 * * *', async () => {
    try {
      await runCleanup();
    } catch (error) {
      console.error('❌ Scheduled cleanup failed:', error);
    }
  }, {
    timezone: 'America/New_York'
  });

  console.log('⏰ Cleanup job scheduled for 4 AM daily (America/New_York timezone)');
};
