import {actionsFor, combineReducerSchema} from '../../../src/catwalk';

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

export default combineReducerSchema(reducer, {

    //id: field(cast.integer(), PRIMARY_KEY)

});
