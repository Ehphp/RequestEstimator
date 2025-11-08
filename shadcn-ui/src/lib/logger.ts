// Logger utility per gestire logging in development vs production
const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args: unknown[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    error: (...args: unknown[]) => {
        // Sempre logga errori, anche in produzione
        console.error(...args);
    },

    warn: (...args: unknown[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    debug: (...args: unknown[]) => {
        if (isDev) {
            console.debug(...args);
        }
    },

    info: (...args: unknown[]) => {
        if (isDev) {
            console.info(...args);
        }
    }
};

// Helper per loggare operazioni CRUD
export const logCrud = {
    create: (entity: string, id: string) => {
        logger.log(`✅ Created ${entity}:`, id);
    },

    read: (entity: string, count?: number) => {
        logger.log(`📖 Read ${entity}${count !== undefined ? ` (${count} records)` : ''}`);
    },

    update: (entity: string, id: string) => {
        logger.log(`✏️  Updated ${entity}:`, id);
    },

    delete: (entity: string, id: string) => {
        logger.log(`🗑️  Deleted ${entity}:`, id);
    },

    error: (operation: string, entity: string, error: unknown) => {
        logger.error(`❌ Error ${operation} ${entity}:`, error);
    }
};
