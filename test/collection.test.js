import test from 'ava';
import {create, collections, Collection} from '../build/collection';

test('it can create a collection', t => {

    const person = create('person', { name: '', age: '' });

    t.true(person instanceof Collection);
    t.is(collections[person].name, 'person');
    t.end();

});
