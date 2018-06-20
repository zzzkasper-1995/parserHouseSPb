const winston = require('winston');

const logger = module =>
  winston.createLogger({
    transports: [
      new winston.transports.File({
        filename: `${process.cwd()}/log/all.log`,
        handleException: true,
        json: true,
        maxSize: 5242880,
        maxFiles: 2,
        colorize: false,
      }),
      new winston.transports.File({
        level: 'error',
        filename: `${process.cwd()}/log/error.log`,
        handleException: true,
        json: true,
        maxSize: 5242880,
        maxFiles: 2,
        colorize: false,
      }),
      new winston.transports.Console({
        format: winston.format.simple(),
        label: getFilePath(module),
        handleException: true,
        json: false,
        colorize: true,
      }),
    ],
    exitOnError: false,
  });

const getFilePath = module =>
    // using filename in log statements
    module.filename.split('/').slice(-2).join('/');

module.exports = logger;
