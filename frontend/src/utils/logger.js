// Frontend Logging Utility
// Provides structured logging with levels and potential remote sync

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

// Set default level based on environment
const currentLogLevel = import.meta.env.DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

const formatMessage = (level, message, data) => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
};

const logger = {
    debug: (message, data) => {
        if (currentLogLevel <= LOG_LEVELS.DEBUG) {
            console.debug(formatMessage('DEBUG', message), data || '');
        }
    },
    info: (message, data) => {
        if (currentLogLevel <= LOG_LEVELS.INFO) {
            console.info(formatMessage('INFO', message), data || '');
        }
    },
    warn: (message, data) => {
        if (currentLogLevel <= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', message), data || '');
        }
    },
    error: (message, data) => {
        if (currentLogLevel <= LOG_LEVELS.ERROR) {
            console.error(formatMessage('ERROR', message), data || '');
        }
    },
};

export default logger;
