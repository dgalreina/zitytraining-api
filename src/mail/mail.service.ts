import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Envío por el SMTP del propio buzón del gimnasio (Hostinger). Se eligió
// así para no tocar los registros DNS del dominio: ese buzón ya está
// autorizado por el SPF y el DKIM que hay puestos, así que los correos
// salen firmados sin configurar nada más.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private get from() {
    return process.env.SMTP_FROM || process.env.SMTP_USER || '';
  }

  // Se construye a la primera, no al arrancar: así la app levanta aunque
  // falte la configuración de correo, y solo falla quien intente enviar.
  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;

    const port = Number(process.env.SMTP_PORT) || 465;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465 va cifrado desde el principio; 587 empieza en claro y sube a
      // TLS con STARTTLS.
      secure: port === 465,
      auth: { user, pass },
    });
    return this.transporter;
  }

  get isConfigured(): boolean {
    return this.getTransporter() !== null;
  }

  async send(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`Correo sin configurar: no se envió "${subject}"`);
      return false;
    }

    try {
      await transporter.sendMail({ from: this.from, to, subject, html, text });
      return true;
    } catch (error) {
      // No se relanza: quien pide recuperar la contraseña no debe notar
      // si el correo salió o no (ver AuthService.forgotPassword).
      this.logger.error(`No se pudo enviar "${subject}" a ${to}`, error as Error);
      return false;
    }
  }
}
