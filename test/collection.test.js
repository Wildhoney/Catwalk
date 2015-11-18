import test from 'ava';
import {create, Collection} from '../build/collection';

test('it can create a collection', t => {

    t.true(create('name', { name: '', age: '' }) instanceof Collection);
    t.end();

});
