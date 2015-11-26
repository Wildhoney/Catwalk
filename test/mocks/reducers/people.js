import {actionsFor, attachSchema} from '../../../src/catwalk';
import {field, cast, option} from '../../../src/field';

function reducer(state = [], action) {

    const event = actionsFor(reducer);

    switch (action.type) {

        case event.CREATE:
        case event.READ:
            return [...state, ...[action.model]];

        case event.UPDATE:
            return [
                ...state.slice(0, action.index),
                Object.assign({}, state[action.index], action.model),
                ...state.slice(action.index + 1)
            ];

        case event.DELETE:
            return state.filter(model => model.name !== action.model.name);

        default:
            return state;

    }

}

export default attachSchema(reducer, {

    id:   field(cast.integer(), option.PRIMARY_KEY),
    name: field(cast.string())

});
