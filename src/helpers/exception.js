/**
 * @method throwException
 * @throws {Error}
 * @param {String} message
 * @return {void}
 */
export function throwException(message) {
    throw new Error(`Catwalk: ${message}.`);
}
