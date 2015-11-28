import {actionsFor, attachSchema} from '../../../src/index';
import {string} from '../../../src/field';

function reducer(state = [], action) {

    const {READ} = actionsFor(reducer);

    switch (action.type) {

        case READ:
            return [...state, ...[action.model]];

        default:
            return state;

    }

}

export default attachSchema(reducer, {
    name: string()
});
