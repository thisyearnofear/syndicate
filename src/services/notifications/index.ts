/**
 * NOTIFICATIONS — Re-exports both in-app and email notification services.
 */

// In-app notifications (CRUD, used by /api/notifications route)
export { notificationService } from './notificationService';

// Email notifications (yield-earned, draw-results)
export { emailNotificationService } from './emailNotificationService';
export { yieldEarnedEmail, drawResultEmail } from './emailTemplates';
export type { YieldEarnedData, DrawResultData } from './emailTemplates';
