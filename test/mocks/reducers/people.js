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
            return state.filter(model => model.id !== action.model.id);

        default:
            return state;

    }

}
