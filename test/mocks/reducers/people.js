import {createSchema, actionsFor} from '../../../src/catwalk';
import {field, cast, option} from '../../../src/field';

const schema = createSchema({
    name: field(cast.integer())
});

export default function people(state = [], action) {

    const event = actionsFor(people);

    switch (action.type) {

        case event.CREATE:
            return [...state, ...[action.model]];

        case event.DELETE:
            return state.filter(model => model.name !== action.model.name);

        case event.UPDATE:
            return [
                ...state.slice(0, action.index),
                Object.assign({}, state[action.index], action.model),
                ...state.slice(action.index + 1)
            ];

        default:
            return state;

    }

}
