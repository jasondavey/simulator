import mailgun from 'mailgun-js';

export class MailGunService {
  static sendEmail = async (
    recipientEmail: string,
    subject: string,
    body: string
  ) => {
    try {
      const mg = mailgun({
        apiKey: process.env.MAILGUN_API_KEY!,
        domain: process.env.MAILGUN_DOMAIN!
      });
      console.log(`📧 Sending email: ${subject}`);

      const emailData = {
        from: `Verascore Platform <${process.env.PLATFORM_EMAIL_SENDER}>`,
        to: recipientEmail,
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
