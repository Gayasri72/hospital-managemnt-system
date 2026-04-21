// ──────────────────────────────────────────────────────────────────────────────
// Winston Logger — structured, production-ready logging.
//
// • Development: colorized console output
// • Production:  JSON format, file transports for errors and combined logs
// ──────────────────────────────────────────────────────────────────────────────

import winston from 'winston';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Pretty format for development
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${ts as string} ${level}: ${message as string}${stack ? `\n${stack as string}` : ''}${metaStr}`;
  }),
);

// JSON format for production (easy to parse by log aggregators)
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev ? devFormat : prodFormat,
  defaultMeta: { service: 'hospital-api' },
  transports: [
    new winston.transports.Console(),
    // File transports removed for Vercel Serverless compatibility (read-only filesystem)
  ],
  // Do not exit on handled exceptions
  exitOnError: false,
});
