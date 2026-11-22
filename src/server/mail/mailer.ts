import nodemailer from "nodemailer";

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
}

export interface Mailer {
  enviar(correo: Correo): Promise<void>;
}

class SmtpMailer implements Mailer {
  async enviar(c: Correo): Promise<void> {
    const url = process.env.SMTP_URL;
    if (!url) {
      console.warn("SMTP_URL no configurado: correo no enviado");
      return;
    }
    const transporte = nodemailer.createTransport(url);
    await transporte.sendMail({
      from: process.env.MAIL_FROM ?? "no-responder@multijunta.local",
      to: c.para,
      subject: c.asunto,
      text: c.texto,
    });
  }
}

let actual: Mailer = new SmtpMailer();

export const mailer = (): Mailer => actual;

/** Permite sustituir el envío (pruebas). */
export function setMailer(m: Mailer): void {
  actual = m;
}
