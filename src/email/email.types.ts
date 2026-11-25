export type SendEmailInput = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  tags?: string[];
};

export type SendEmailResult = {
  delivered: boolean;
  driver: 'm365' | 'smtp' | 'webhook' | 'log';
  detail?: string;
};
