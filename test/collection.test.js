import 'babel-core/register';
import test from 'ava';

test('it can create a model', t => {

    const {store} = t.context;
    store.dispatch(createPerson({ name: 'Adam', age: 30 }));

    store.subscribe(() => {

        const {people, people: [person]} = store.getState();

        t.is(people.length, 1);
        t.is(person.name, 'Adam');
        t.is(person.age, 30);
        t.end();

    });

});
