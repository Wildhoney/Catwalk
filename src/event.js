/**
 * @constant event
 * @type {Object}
 */
export const event = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    SUBSCRIBE: 'subscribe'
};

/**
 * @property list
 * @type {Map}
 */
export const list = new Map()
    .set(event.CREATE, () => {})
    .set(event.READ,   () => {})
    .set(event.UPDATE, () => {})
    .set(event.DELETE, () => {})
    .set(event.SUBSCRIBE, () => {});
