import mailgun from 'mailgun-js';
import { StateMachineContext } from '../stateMachineContext';

export class MailGunService {
  static sendReportAndExit = async (context: StateMachineContext) => {
    const subject = `❌ ${context.process_name} Failed for ${context.memberId}`;
    const body = `
      ❌ The process encountered a critical error and was unable to complete.
  
      🚨 Errors Encountered:
      ${context.errors.join('\n') || 'No detailed errors recorded.'}
  
      ❗ Stopping execution.
    `;

    await MailGunService.sendEmail(subject, body);
    console.error(
      `❌ Critical failure: ${context.process_name} stopping for ownerId=${context.memberId}`
    );
    process.exit(1);
  };

  static sendEmail = async (subject: string, body: string) => {
    try {
      const mg = mailgun({
        apiKey: process.env.MAILGUN_API_KEY!,
        domain: process.env.MAILGUN_DOMAIN!
      });
      console.log(`📧 Sending email: ${subject}`);

      const emailData = {
        from: `Verascore Platform <${process.env.PLATFORM_EMAIL_SENDER}>`,
        to: process.env.RECIPIENT_EMAIL!,
        subject,
        text: body
      };

      await mg.messages().send(emailData);
      console.log('✅ Email sent successfully.');
    } catch (error) {
      console.error('❌ Failed to send email:', error);
    }
  };
}
