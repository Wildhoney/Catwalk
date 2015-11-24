import {createSchema, actionsFor} from '../../../src/catwalk';
import {field, cast, option} from '../../../src/field';

const schema = createSchema({
    name: field(cast.integer(), options.PRIMARY_KEY)
});

export default function(state = [], action) {

    const event = actionsFor(schema);

    switch (action.type) {

        case event.CREATE:
            return [...state, ...action.model];

        case event.DELETE:
            return state.filter(model => model.id !== action.model.id);

        default:
            return state;

    }

}
