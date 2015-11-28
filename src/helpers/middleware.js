import {findSchemaByActionType} from './registry';

/**
 * @method serialize
 * @return {Function}
 */
export function serialize() {

    return next => action => {

        const {type, model} = action;

        if (type && model) {

            const schema = findSchemaByActionType(type);

            if (schema) {

                // Typecast the model according to its schema.
                const modifiedModel = Object.keys(model).reduce((accumulator, key) => {
                    const {cast} = schema[key];
                    accumulator[key] = cast(model[key]);
                    return accumulator;
                }, {});

                next(Object.assign({}, action, { model: modifiedModel }));
                return;

            }

        }

        next(action);

    };

}
