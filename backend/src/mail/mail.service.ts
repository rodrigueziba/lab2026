import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'chimoibarra@gmail.com',
        pass: 'skdm hfif ldky shgf', // Tu contraseña de aplicación
      },
    });
  }

  // Método genérico base (el que ya tenías)
  async enviarCorreo(
    destinatario: string,
    asunto: string,
    mensajeHtml: string,
  ) {
    try {
      const info = await this.transporter.sendMail({
        from: '"Tierra del Fuego Film" <chimoibarra@gmail.com>', // Gmail suele forzar el remitente real
        to: destinatario,
        subject: asunto,
        html: mensajeHtml,
      });
      console.log('📧 Correo enviado: ' + info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return false;
    }
  }

  async sendSolicitudContacto(destinatario: string, nombrePrestador: string, nombreSolicitante: string, emailSolicitante: string) {
    const asunto = `🔔 Nueva solicitud de contacto para ${nombrePrestador}`;
    
    // HTML con diseño profesional
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <div style="background-color: #ea580c; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 24px;">¡Tienes un interesado!</h2>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 16px; line-height: 1.5; color: #52525b;">
              Hola, el usuario <strong>${nombreSolicitante}</strong> quiere acceder a los datos de contacto de tu perfil profesional:
            </p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin: 0 0 5px 0; color: #b45309;">Perfil Solicitado:</h3>
              <p style="margin: 0; font-weight: bold; font-size: 18px;">${nombrePrestador}</p>
            </div>

            <p style="font-size: 16px; margin-bottom: 5px;">Datos del solicitante:</p>
            <ul style="background-color: #f8fafc; padding: 15px 30px; border-radius: 8px; margin-top: 0;">
              <li style="margin-bottom: 5px;"><strong>Nombre:</strong> ${nombreSolicitante}</li>
              <li><strong>Email:</strong> <a href="mailto:${emailSolicitante}" style="color: #ea580c;">${emailSolicitante}</a></li>
            </ul>

            <p style="color: #71717a; font-size: 14px; margin-top: 30px; text-align: center;">
              Puedes responder directamente a este correo para contactar al interesado.
            </p>
          </div>
          
          <div style="background-color: #18181b; padding: 15px; text-align: center; color: #71717a; font-size: 12px;">
            &copy; 2026 Tierra del Fuego Film Commission
          </div>
        </div>
      </div>
    `;

    return this.enviarCorreo(destinatario, asunto, html);
  }
}